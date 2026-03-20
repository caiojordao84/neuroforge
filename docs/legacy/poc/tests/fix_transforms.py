import os
import re

base_dir = r"d:\Documents\NeuroForge\neuroforge\crates\neuroforge-asl\src"

# 1. Create typed_nodes.rs
typed_nodes_code = """//! typed_nodes.rs — Typed AST nodes for Phase 1B transforms pipeline
#[derive(Debug, Clone)]
pub struct ProgramNode {
    pub globals: Vec<VarDeclNode>,
    pub functions: Vec<FunctionNode>,
    pub body: Vec<StatementNode>,
    pub has_loop: bool,
}
impl ProgramNode {
    pub fn empty() -> Self {
        Self { globals: vec![], functions: vec![], body: vec![], has_loop: false }
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
    If { condition: ExprNode, then_body: Vec<BlockNode>, else_body: Option<Vec<BlockNode>> },
    While { condition: ExprNode, body: Vec<BlockNode> },
    DoWhile { condition: ExprNode, body: Vec<BlockNode> },
    For { init: Option<ExprNode>, condition: Option<ExprNode>, update: Option<ExprNode>, body: Vec<BlockNode> },
    ForIn { variable: String, iterable: ExprNode, body: Vec<BlockNode> },
    Switch { discriminant: ExprNode, cases: Vec<SwitchCase>, default: Option<Vec<BlockNode>> },
    Break,
    Continue,
    Return(Option<ExprNode>),
}

#[derive(Debug, Clone)]
pub struct SwitchCase {
    pub value: ExprNode,
    pub body: Vec<BlockNode>,
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
"""
with open(os.path.join(base_dir, "types", "typed_nodes.rs"), "w", encoding="utf-8") as f:
    f.write(typed_nodes_code)

# 2. Update types/mod.rs
with open(os.path.join(base_dir, "types", "mod.rs"), "r", encoding="utf-8") as f:
    types_mod = f.read()
if "pub mod typed_nodes;" not in types_mod:
    types_mod += "\npub mod typed_nodes;\n"
with open(os.path.join(base_dir, "types", "mod.rs"), "w", encoding="utf-8") as f:
    f.write(types_mod)

# 3. Add PostfixInc, PostfixDec, Cast to asl_types.rs
asl_types_path = os.path.join(base_dir, "types", "asl_types.rs")
with open(asl_types_path, "r", encoding="utf-8") as f:
    asl_types = f.read()
if "PostfixInc(" not in asl_types:
    asl_types = asl_types.replace(
        """    #[serde(rename = "serialReadString")]\n    SerialReadString,""",
        """    #[serde(rename = "serialReadString")]\n    SerialReadString,\n    #[serde(rename = "postfixInc")]\n    PostfixInc(String),\n    #[serde(rename = "postfixDec")]\n    PostfixDec(String),\n    #[serde(rename = "cast")]\n    Cast { target_type: String, expr: Box<AslExpr> },"""
    )
with open(asl_types_path, "w", encoding="utf-8") as f:
    f.write(asl_types)

# Helper function to process transforms
def process_transform(filename, replacements):
    path = os.path.join(base_dir, "transforms", filename)
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Global replace for node imports
    content = content.replace("crate::types::nodes", "crate::types::typed_nodes")
    
    for old, new in replacements:
        content = content.replace(old, new)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

# 4. Fix postfix_utils.rs
process_transform("postfix_utils.rs", [
    ("AslBinOp, AslVar", ""),
    ("AslVarRef, ", ""),
])

# 5. Fix expr_transform.rs (we have to deal with the mapped nodes and imports)
process_transform("expr_transform.rs", [
    ("AslBinOp, AslCompareOp, AslBoolOp, AslVar", ""),
    ("AslExpr::IntLiteral", "AslExpr::int"),
    ("AslExpr::FloatLiteral", "AslExpr::float"),
    ("AslExpr::BoolLiteral", "AslExpr::bool_val"),
    ("AslExpr::StringLiteral(v.clone())", "AslExpr::str_val(&v)"),
    ("AslExpr::StringLiteral", "AslExpr::str_val"),
    ("ExprKind::Identifier(name) => AslExpr::Var(AslVar { name: name.clone(), index: None })", "ExprKind::Identifier(name) => AslExpr::var(name)"),
    ("AslExpr::Var(AslVar { name: name.clone() })", "AslExpr::var(name)"),
])

# 6. Fix block_transform.rs
process_transform("block_transform.rs", [
    ("AslCase", "AslSwitchCase"),
    ("AslStatement::If {", "AslStatement::If(Box::new(AslIf {"), ("else_body: if else_stmts", "else_branch: if else_stmts"), ("then_body: then_stmts", "then_branch: then_stmts"), ("}]", "}))]"),
    ("AslStatement::While {", "AslStatement::While(Box::new(AslWhile {"),
    ("AslStatement::DoWhile {", "AslStatement::DoWhile(Box::new(AslDoWhile {"),
    ("AslStatement::For {", "AslStatement::For(Box::new(AslFor {"),
    ("AslStatement::ForIn {", "AslStatement::ForIn(Box::new(AslForIn {"), ("variable: variable.clone(),", "var_name: variable.clone(),"),
    ("AslStatement::Switch {", "AslStatement::Switch(Box::new(AslSwitch {"),
    ("AslStatement::Return { value }", "AslStatement::Return(AslReturn { value })"),
    ("value: transform_expr(&c.value, ctx),", "test: Some(transform_expr(&c.value, ctx)),"),
])

# 7. Fix call_transform.rs
process_transform("call_transform.rs", [
    ("AslStatement::PinMode { pin, mode }", "AslStatement::PinMode(AslPinMode { pin, mode: if mode == AslExpr::str_val(\"OUTPUT\") { PinModeKind::Output } else { PinModeKind::Input } })"),
    ("AslExpr::StringLiteral(\"OUTPUT\".into())", "AslExpr::str_val(\"OUTPUT\")"),
    ("AslExpr::IntLiteral(0)", "AslExpr::int(0)"),
    ("AslExpr::IntLiteral(9600)", "AslExpr::int(9600)"),
    ("AslExpr::IntLiteral(1000)", "AslExpr::int(1000)"),
    ("AslExpr::StringLiteral(\"\".into())", "AslExpr::str_val(\"\")"),
    ("AslStatement::DigitalWrite { pin, value }", "AslStatement::DigitalWrite(AslDigitalWrite { pin, value: DigitalValue::Expr(value) })"),
    ("AslStatement::AnalogWrite { pin, value }", "AslStatement::AnalogWrite(AslAnalogWrite { pin, value })"),
    ("AslStatement::Read { pin, mode, result }", "AslStatement::Read(AslRead { pin, mode, target: result })"),
    ("AslStatement::SerialBegin { baud }", "AslStatement::SerialBegin(AslSerialBegin { baud })"),
    ("AslStatement::Print { value, newline }", "AslStatement::Print(AslPrint { args: vec![value], newline })"),
    ("AslStatement::Delay { ms }", "AslStatement::Delay(AslDelay { milliseconds: ms })"),
    ("AslStatement::ServoAttach { name, pin }", "AslStatement::ServoAttach(AslServoAttach { var_name: name, pin, min_pulse: None, max_pulse: None, continuous: None })"),
    ("AslStatement::ServoWrite { name, angle }", "AslStatement::ServoWrite(AslServoWrite { var_name: name, angle, raw_microseconds: None })"),
    ("AslStatement::ServoDetach { name }", "AslStatement::ServoDetach(AslServoDetach { var_name: name })"),
    ("AslStatement::I2cWrite { addr, value }", "AslStatement::I2cWrite(AslI2cWrite { bus: AslExpr::int(0), address: addr, data: value })"),
    ("AslStatement::I2cRead { addr, result }", "AslStatement::I2cRead(AslI2cRead { bus: AslExpr::int(0), address: addr, target: result, length: AslExpr::int(1) })"),
    ("AslStatement::PwmInit { pin, freq }", "AslStatement::PwmInit(AslPwmInit { pin, freq, duty: AslExpr::int(0) })"),
    ("AslStatement::PwmSetDuty { pin, duty }", "AslStatement::PwmSetDuty(AslPwmSetDuty { pin, duty })"),
    ("AslStatement::RgbSet { pin, r, g, b }", "AslStatement::RgbSet(AslRgbSet { pin_r: pin, pin_g: r, pin_b: g, r: AslExpr::int(0), g: AslExpr::int(0), b: AslExpr::int(0) })"),
    ("AslStatement::Call {", "AslStatement::Expr(AslExpressionStmt { expr: AslExpr::Call(Box::new(AslCall {"), ("args,", "args, })) })"),
    ("AslStatement::SpiTransfer { value, result }", "AslStatement::SpiTransfer(AslSpiTransfer { bus: AslExpr::int(0), cs_pin: AslExpr::int(0), tx_data: value, target: Some(result) })"),
    ("Some(AslStatement::DelayMicros { us })", "Some(AslStatement::Delay(AslDelay { milliseconds: us }))") # DelayMicros not directly supported, fallback to delay
])

# 8. Fix statement_registry.rs
process_transform("statement_registry.rs", [
    ("Vec<AslVar>", "Vec<AslGlobalVar>"),
    ("AslVar {", "AslGlobalVar {"),
    ("is_global: true,", "initial_value: None, struct_type: None, comments: None,"),
    ("StatementKind::VarDecl { name, var_type, value }", "StatementKind::VarDecl(crate::types::typed_nodes::VarDeclNode { name, var_type, value, is_const })"),
    ("AslStatement::VarDecl {", "AslStatement::Declare(AslDeclare {"),
    ("var_type: asl_type,", "r#type: asl_type,"),
    ("AslStatement::Assign {", "AslStatement::Assign(AslAssign {"),
    ("AslStatement::Return { value }", "AslStatement::Return(AslReturn { value })"),
    ("AslStatement::Comment(text.clone())", "AslStatement::Comment(AslComment{text: text.clone()})"),
    ("AslStatement::ExprStatement(expr)", "AslStatement::Expr(AslExpressionStmt { expr })"),
    ("transform_var_decl(v: &crate::types::typed_nodes::VarDeclNode", "transform_var_decl(v: &crate::types::typed_nodes::VarDeclNode"),
    ("-> AslGlobalVar", "-> AslGlobalVar"),
])

# 9. Fix code_to_asl.rs types
code_to_asl = os.path.join(base_dir, "transforms", "code_to_asl.rs")
with open(code_to_asl, "r", encoding="utf-8") as f:
    text = f.read()
text = text.replace("crate::types::nodes::ProgramNode", "crate::types::typed_nodes::ProgramNode")
with open(code_to_asl, "w", encoding="utf-8") as f:
    f.write(text)

print("Patching complete.")
