
import React, { useState, useEffect } from 'react';
import { LucidePlay, LucideCheckCircle, LucideXCircle, LucideLoader2 } from 'lucide-react';
import { IntegrationSuite, TestResult } from '../tests/IntegrationSuite';

export const TestRunner = ({ onClose }: { onClose: () => void }) => {
    const [running, setRunning] = useState(false);
    const [results, setResults] = useState<TestResult[]>([]);
    const [suite] = useState(new IntegrationSuite());

    const run = async () => {
        setRunning(true);
        setResults([]);
        try {
            await suite.init();
            const res = await suite.runAll();
            setResults(res);
        } catch (e) {
            console.error(e);
            setResults([{ name: "Suite Error", status: 'FAIL', details: String(e) }]);
        }
        setRunning(false);
    };

    return (
        <div className="absolute inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-10">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-full">
                <div className="p-4 bg-slate-100 border-b border-slate-200 flex justify-between items-center">
                    <h2 className="font-bold text-slate-800 flex items-center gap-2">
                        Integration Test Suite
                        <span className="text-xs font-normal text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">AST Pipeline Verification</span>
                    </h2>
                    <div className="flex gap-2">
                        <button onClick={run} disabled={running} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded text-sm flex items-center gap-2">
                            {running ? <LucideLoader2 className="animate-spin" size={14}/> : <LucidePlay size={14}/>}
                            Run Tests
                        </button>
                        <button onClick={onClose} className="text-slate-500 hover:text-slate-800 px-2">Close</button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {results.length === 0 && !running && (
                        <div className="text-center text-slate-400 py-10">Ready to run integration tests across C++, Rust, and Python parsers.</div>
                    )}
                    {results.map((r, i) => (
                        <div key={i} className={`p-3 rounded border flex items-start gap-3 ${r.status === 'PASS' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            {r.status === 'PASS' ? <LucideCheckCircle className="text-green-500 mt-0.5" size={18}/> : <LucideXCircle className="text-red-500 mt-0.5" size={18}/>}
                            <div>
                                <div className={`font-bold text-sm ${r.status === 'PASS' ? 'text-green-800' : 'text-red-800'}`}>{r.name}</div>
                                {r.details && <div className="text-xs font-mono mt-1 text-slate-600 bg-white/50 p-1 rounded">{r.details}</div>}
                            </div>
                        </div>
                    ))}
                </div>
                
                <div className="p-2 bg-slate-50 text-xs text-center text-slate-400 border-t">
                    Validating: Parse &rarr; AST &rarr; Analyze &rarr; Optimize &rarr; Codegen
                </div>
            </div>
        </div>
    );
};
