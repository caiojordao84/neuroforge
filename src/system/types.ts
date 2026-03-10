
export type NodeType =
    | 'Program' | 'Function' | 'Block'
    | 'VariableDeclaration' | 'Assignment' | 'IfStatement' | 'WhileLoop' | 'ForLoop' | 'ForIn' | 'DoWhileLoop' | 'Loop'
    | 'GpioConfig' | 'GpioSet' | 'GpioRead' | 'AnalogRead' | 'AnalogWrite' | 'PinMode'
    | 'DelayMs' | 'Print' | 'ReturnStatement' | 'BreakStatement' | 'ContinueStatement'
    | 'LcdPrint' | 'LcdCursor' | 'LcdClear'
    | 'OledText' | 'OledShow' | 'OledClear'
    | 'SevSegPrint' | 'KeypadRead'
    | 'BinaryExpression' | 'UnaryExpression' | 'CallExpression' | 'MemberExpression' | 'SubscriptExpression' | 'ArrayInitializer'
    | 'Identifier' | 'Literal' | 'Empty'
    | 'ExpressionStatement' | 'DesignatedInitializer' | 'ObjectInitializer' | 'Expression'
    // Optimization Nodes
    | 'HardwarePwm' | 'GpioBatch'
    | 'EnumDeclaration'
    | 'StructDeclaration'
    | 'SizeofExpression'
    | 'CastExpression'
    | 'ConditionalExpression'
    | 'SwitchStatement'
    | 'CaseClause';

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
    isMacro?: boolean;
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
