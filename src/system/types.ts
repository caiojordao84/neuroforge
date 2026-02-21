
export type NodeType =
    | 'Program' | 'Function' | 'Block'
    | 'VariableDeclaration' | 'Assignment' | 'IfStatement' | 'WhileLoop' | 'ForLoop'
    | 'GpioConfig' | 'GpioSet' | 'GpioRead' | 'AnalogRead' | 'AnalogWrite'
    | 'DelayMs' | 'Print' | 'ReturnStatement' | 'BreakStatement' | 'ContinueStatement'
    | 'LcdPrint' | 'LcdCursor' | 'LcdClear'
    | 'OledText' | 'OledShow' | 'OledClear'
    | 'SevSegPrint' | 'KeypadRead'
    | 'BinaryExpression' | 'UnaryExpression' | 'CallExpression' | 'MemberExpression' | 'SubscriptExpression' | 'ArrayInitializer'
    | 'Identifier' | 'Literal' | 'Empty'
    | 'ExpressionStatement'
    // Optimization Nodes
    | 'HardwarePwm' | 'GpioBatch'
    | 'EnumDeclaration';

export interface BaseNode {
    nodeType: NodeType;
    id: string;
    attributes: Record<string, any>;
    children: BaseNode[];
    leadingComments?: string[];
    metadata?: {
        line?: number;
        [key: string]: any;
    };
}

export interface ProgramNode extends BaseNode { nodeType: 'Program'; }

export interface Symbol {
    name: string;
    type: string;
    scopeLevel: number;
    declaredLine: number;
    usageCount: number;
    value?: any;
}

export interface AnalysisIssue {
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    message: string;
    line?: number;
}

export interface PatternMatch {
    type: 'PWM_BITBANG' | 'POLLING_LOOP' | 'STATE_MACHINE' | 'LONG_DELAY';
    description: string;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    location?: string;
    line?: number;
}

export interface SourceMapEntry {
    generatedLine: number;
    sourceLine: number;
}
