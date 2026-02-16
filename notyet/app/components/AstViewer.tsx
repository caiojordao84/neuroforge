
import React, { useState } from 'react';
import { LucideChevronRight, LucideChevronDown, LucideBox, LucideCpu, LucideLayers } from 'lucide-react';
import { BaseNode } from '../system/types';

const NodeView = ({ node, depth = 0 }: { node: BaseNode, depth?: number }) => {
    const [expanded, setExpanded] = useState(true);
    const hasChildren = node.children && node.children.length > 0;
    
    // Color coding based on node type
    let icon = <LucideBox size={12} className="text-slate-400"/>;
    let labelColor = "text-slate-600";
    
    if (node.nodeType === 'Program') { icon = <LucideLayers size={12} className="text-blue-500"/>; labelColor = "text-blue-600 font-bold"; }
    if (node.nodeType === 'Function') { icon = <LucideBox size={12} className="text-purple-500"/>; labelColor = "text-purple-600 font-bold"; }
    if (node.nodeType === 'HardwarePwm' || node.nodeType === 'GpioBatch') { 
        icon = <LucideCpu size={12} className="text-emerald-500"/>; 
        labelColor = "text-emerald-600 font-bold bg-emerald-100 px-1 rounded"; 
    }
    
    // Format attributes for display
    const attrs = Object.entries(node.attributes || {})
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(' ');

    return (
        <div className="font-mono text-xs select-none">
            <div 
                className={`flex items-center gap-1 hover:bg-slate-100 cursor-pointer py-0.5 rounded ${depth === 0 ? 'bg-slate-50' : ''}`}
                style={{ paddingLeft: `${depth * 12}px` }}
                onClick={() => setExpanded(!expanded)}
            >
                <div className="w-4 h-4 flex items-center justify-center text-slate-400">
                    {hasChildren && (expanded ? <LucideChevronDown size={10}/> : <LucideChevronRight size={10}/>)}
                </div>
                {icon}
                <span className={labelColor}>{node.nodeType}</span>
                {attrs && <span className="text-slate-400 text-[10px] ml-2 truncate max-w-[200px]">{attrs}</span>}
                {node.metadata?.line && <span className="ml-auto mr-2 text-[9px] text-slate-300">L{node.metadata.line}</span>}
            </div>
            
            {expanded && hasChildren && (
                <div>
                    {node.children.map((child, i) => (
                        <NodeView key={child.id || i} node={child} depth={depth + 1} />
                    ))}
                </div>
            )}
        </div>
    );
};

export const AstViewer = ({ ast }: { ast: BaseNode | null }) => {
    if (!ast) return <div className="text-slate-400 italic p-4">No AST generated</div>;
    return (
        <div className="p-2 overflow-auto h-full bg-white">
            <NodeView node={ast} />
        </div>
    );
};
