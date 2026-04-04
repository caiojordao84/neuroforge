//! typed_nodes.rs     Typed AST nodes for Phase 1B transforms pipeline

#[derive(Debug, Clone)]

pub struct ProgramNode {

    pub globals: Vec<VarDeclNode>,

    pub functions: Vec<FunctionNode>,

    pub setup_body: Vec<StatementNode>,

    pub loop_body: Vec<StatementNode>,

    pub has_loop: bool,

}

impl ProgramNode {

    pub fn empty() -> Self {

        Self { globals: vec![], functions: vec![], setup_body: vec![], loop_body: vec![], has_loop: false }

    }

}



#[derive(Debug, Clone)]

pub struct FunctionNode {

    pub name: String,

    pub params: Vec<ParamNode>,

    pub return_type: Option<String>,

    pub body: Vec<StatementNode>,

}



#[derive(Debug, Clone)]

pub struct ParamNode {

    pub name: String,

    pub param_type: String,

}



#[derive(Debug, Clone)]

pub struct VarDeclNode {

    pub name: String,

    pub var_type: Option<String>,

    pub value: Option<ExprNode>,

    pub is_const: bool,

}



#[derive(Debug, Clone)]

pub struct StatementNode {

    pub kind: StatementKind,

}



#[derive(Debug, Clone)]

pub enum StatementKind {

    VarDecl(VarDeclNode),

    Assign { target: String, value: ExprNode },

    Call(CallNode),

    Expr(ExprNode),

    Block(BlockNode),

    Return(Option<ExprNode>),

    Break,

    Continue,

    Comment(String),

}



#[derive(Debug, Clone)]

pub struct BlockNode {

    pub kind: BlockKind,

}



#[derive(Debug, Clone)]

pub enum BlockKind {

    If { condition: ExprNode, then_body: Vec<StatementNode>, else_body: Option<Vec<StatementNode>> },

    While { condition: ExprNode, body: Vec<StatementNode> },

    DoWhile { condition: ExprNode, body: Vec<StatementNode> },

    For { init: Option<ExprNode>, condition: Option<ExprNode>, update: Option<ExprNode>, body: Vec<StatementNode> },

    ForIn { variable: String, iterable: ExprNode, body: Vec<StatementNode> },

    Switch { discriminant: ExprNode, cases: Vec<SwitchCase>, default: Option<Vec<StatementNode>> },

    Break,

    Continue,

    Return(Option<ExprNode>),

}



#[derive(Debug, Clone)]

pub struct SwitchCase {

    pub value: ExprNode,

    pub body: Vec<StatementNode>,

}



#[derive(Debug, Clone)]

pub struct ExprNode {

    pub kind: ExprKind,

}



#[derive(Debug, Clone)]

pub enum ExprKind {

    IntLiteral(i64),

    FloatLiteral(f64),

    StringLiteral(String),

    BoolLiteral(bool),

    NullLiteral,

    Identifier(String),

    BinaryOp { op: String, left: Box<ExprNode>, right: Box<ExprNode> },

    CompareOp { op: String, left: Box<ExprNode>, right: Box<ExprNode> },

    BoolOp { op: String, left: Box<ExprNode>, right: Box<ExprNode> },

    Not(Box<ExprNode>),

    PostfixInc(String),

    PostfixDec(String),

    Call(CallNode),

    MemberAccess { object: Box<ExprNode>, member: String },

    Cast { target_type: String, expr: Box<ExprNode> },

    Ternary { condition: Box<ExprNode>, then_expr: Box<ExprNode>, else_expr: Box<ExprNode> },

    ArrayAccess { object: Box<ExprNode>, index: Box<ExprNode> },

}



#[derive(Debug, Clone)]

pub struct CallNode {

    pub name: String,

    pub object: Option<String>,

    pub args: Vec<ExprNode>,

    pub result_var: Option<String>,

}











