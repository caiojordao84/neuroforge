
import React, { useState, useRef, useEffect } from 'react';
import { LucideAlertCircle, LucideAlertTriangle, LucideInfo } from 'lucide-react';

const highlight = (code: string) => {
    let html = code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const tokens: string[] = [];
    const save = (match: string) => { tokens.push(match); return `___TOKEN${tokens.length-1}___`; };
    
    html = html.replace(/\/\/.*/g, save);
    html = html.replace(/\/\*[\s\S]*?\*\//g, save);
    html = html.replace(/"([^"\\]|\\.)*"/g, save);
    html = html.replace(/'([^'\\]|\\.)*'/g, save);
    
    html = html.replace(/\b(void|int|float|bool|String|File|if|else|while|for|return|fn|let|mut|loop|use|struct|impl|import|from|def|class)\b/g, '<span class="text-purple-600 font-bold">$1</span>');
    html = html.replace(/\b(true|false|HIGH|LOW|INPUT|OUTPUT|WL_CONNECTED)\b/g, '<span class="text-orange-600 font-bold">$1</span>');
    html = html.replace(/\b(digitalWrite|digitalRead|analogWrite|analogRead|delay|pinMode|Serial|begin|print|println|available|readString|oled|lcd|dht|wifi|servo|neopixel|gpio_set|delay_ms)\b/g, '<span class="text-blue-600">$1</span>');
    html = html.replace(/\b\d+(\.\d+)?\b/g, '<span class="text-red-500">$1</span>');
    
    html = html.replace(/___TOKEN(\d+)___/g, (_, i) => {
        const t = tokens[parseInt(i)];
        if (t.startsWith('//') || t.startsWith('#') || t.startsWith('/*')) return `<span class="text-slate-400 italic">${t}</span>`;
        if (t.startsWith('"') || t.startsWith("'")) return `<span class="text-green-600">${t}</span>`;
        return t;
    });

    return html;
};

interface Issue {
    line: number;
    message: string;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

export const CodeEditor = ({ code, onChange, issues = [] }: { code: string, onChange: (v: string) => void, issues?: Issue[] }) => {
    const lines = code.split('\n').length;
    const scrollRef = useRef<HTMLTextAreaElement>(null);
    const preRef = useRef<HTMLPreElement>(null);

    const handleScroll = () => {
        if (scrollRef.current && preRef.current) {
            preRef.current.scrollTop = scrollRef.current.scrollTop;
            preRef.current.scrollLeft = scrollRef.current.scrollLeft;
        }
    };

    // Group issues by line
    const issuesByLine = issues.reduce((acc, issue) => {
        if (!issue.line) return acc;
        if (!acc[issue.line]) acc[issue.line] = [];
        acc[issue.line].push(issue);
        return acc;
    }, {} as Record<number, Issue[]>);

    return (
        <div className="flex-1 relative flex font-mono text-sm overflow-hidden bg-white">
            <div className="bg-slate-50 text-slate-300 select-none border-r border-slate-100 leading-6 z-10 w-12 flex-shrink-0 flex flex-col items-end py-4 pr-2">
                {Array.from({length: Math.max(lines, 10)}).map((_, i) => {
                    const lineNum = i + 1;
                    const lineIssues = issuesByLine[lineNum];
                    const worstSeverity = lineIssues ? (lineIssues.some(i => i.severity === 'CRITICAL') ? 'CRITICAL' : lineIssues.some(i => i.severity === 'WARNING') ? 'WARNING' : 'INFO') : null;
                    
                    return (
                        <div key={i} className="h-6 w-full flex items-center justify-end gap-1 relative group">
                            <span className="text-[10px]">{lineNum}</span>
                            {worstSeverity && (
                                <div className="cursor-help">
                                    {worstSeverity === 'CRITICAL' && <LucideAlertCircle size={10} className="text-red-500" />}
                                    {worstSeverity === 'WARNING' && <LucideAlertTriangle size={10} className="text-yellow-500" />}
                                    {worstSeverity === 'INFO' && <LucideInfo size={10} className="text-blue-500" />}
                                    
                                    {/* Tooltip */}
                                    <div className="absolute left-10 top-0 hidden group-hover:flex flex-col bg-slate-800 text-white text-xs p-2 rounded shadow-xl z-50 whitespace-nowrap min-w-[200px]">
                                        {lineIssues.map((issue, idx) => (
                                            <div key={idx} className={`flex gap-2 items-center ${idx>0?'border-t border-slate-700 pt-1 mt-1':''}`}>
                                                <span className={`font-bold text-[10px] ${issue.severity === 'CRITICAL' ? 'text-red-400' : issue.severity === 'WARNING' ? 'text-yellow-400' : 'text-blue-400'}`}>
                                                    {issue.severity}
                                                </span>
                                                <span>{issue.message}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            
            <div className="relative flex-1 h-full overflow-hidden">
                {/* Syntax Highlight Layer */}
                <pre
                    ref={preRef}
                    className="absolute inset-0 p-4 m-0 bg-transparent pointer-events-none whitespace-pre font-mono leading-6 text-transparent z-0 overflow-hidden"
                    aria-hidden="true"
                    dangerouslySetInnerHTML={{ __html: highlight(code) + '<br/>' }} 
                />
                
                {/* Input Layer */}
                <textarea 
                    ref={scrollRef}
                    className="absolute inset-0 w-full h-full p-4 resize-none focus:outline-none bg-transparent text-slate-900/0 caret-slate-900 leading-6 whitespace-pre z-10"
                    value={code} 
                    onChange={(e) => onChange(e.target.value)} 
                    onScroll={handleScroll}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoComplete="off"
                />
            </div>
        </div>
    );
};
