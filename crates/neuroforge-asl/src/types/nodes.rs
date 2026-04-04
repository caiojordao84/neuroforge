//! Tipos legacy do AST usados por CParser e RustParser (tree-sitter).

//! Separados de asl_types para n  o misturar com a AST estruturada nova.



use serde_json::Value;

use std::collections::HashMap;



//           NodeType                                                                                                                                                                                                    



#[derive(Debug, Clone, PartialEq)]

pub enum NodeType {

    Program,

    Function,

    Param,

    Block,

    // Controlo de fluxo

    IfStatement,

    WhileLoop,

    DoWhile,

    ForLoop,

    ForIn,

    SwitchStatement,

    CaseClause,

    Return,

    Break,

    Continue,

    // Declara    es / express  es

    VarDeclaration,

    Assignment,

    FunctionCall,

    Raw,

    // Hardware MCU

    GpioSet,

    GpioRead,

    AnalogWrite,

    AnalogRead,

    PinMode,

    DelayMs,

    DelayUs,

    Millis,

    Micros,

    Tone,

    NoTone,

    SerialBegin,

    Print,

    PrintLn,

    UartRead,

    UartWrite,

    UartAvailable,

    I2cBegin,

    I2cWrite,

    I2cRead,

    I2cRequestFrom,

    I2cBeginTransmission,

    I2cEndTransmission,

    SpiBegin,

    SpiTransfer,

    SpiEnd,

    PwmInit,

    PwmSetDuty,

    PwmSetFreq,

    PwmStop,

    ServoAttach,

    ServoWrite,

    ServoDetach,

    ServoRead,

    // Gen  rico

    Unknown,

}



//           BaseNode                                                                                                                                                                                                    



#[derive(Debug, Clone)]

pub struct BaseNode {

    pub node_type: NodeType,

    pub attributes: HashMap<String, Value>,

    pub children: Vec<BaseNode>,

}



impl BaseNode {

    pub fn new(node_type: NodeType) -> Self {

        Self { node_type, attributes: HashMap::new(), children: vec![] }

    }



    /// N   folha sem filhos nem atributos.

    pub fn leaf(node_type: NodeType) -> Self {

        Self::new(node_type)

    }



    /// N   de texto raw (para express  es n  o mapeadas).

    pub fn raw(text: &str) -> Self {

        let mut n = Self::new(NodeType::Raw);

        n.attributes.insert("value".to_string(), Value::String(text.to_string()));

        n

    }



    /// N   de hardware com filhos (argumentos) e linha fonte.

    pub fn hw(node_type: NodeType, args: Vec<BaseNode>, line: usize) -> Self {

        let mut n = Self::new(node_type);

        n.attributes.insert("line".to_string(), Value::Number(line.into()));

        n.children = args;

        n

    }



    /// Chamada de fun    o gen  rica.

    pub fn call(callee: &str, args: Vec<BaseNode>, line: usize) -> Self {

        let mut n = Self::new(NodeType::FunctionCall);

        n.attributes.insert("callee".to_string(), Value::String(callee.to_string()));

        n.attributes.insert("line".to_string(), Value::Number(line.into()));

        n.children = args;

        n

    }



    /// Declara    o de vari  vel.

    pub fn var_decl(type_name: String, name: String, value: Option<String>, line: usize) -> Self {

        let mut n = Self::new(NodeType::VarDeclaration);

        n.attributes.insert("type".to_string(), Value::String(type_name));

        n.attributes.insert("name".to_string(), Value::String(name));

        if let Some(v) = value {

            n.attributes.insert("value".to_string(), Value::String(v));

        }

        n.attributes.insert("line".to_string(), Value::Number(line.into()));

        n

    }



    /// Atribui    o (=, +=, etc.).

    pub fn assignment(left: String, op: String, right: String, line: usize) -> Self {

        let mut n = Self::new(NodeType::Assignment);

        n.attributes.insert("left".to_string(),     Value::String(left));

        n.attributes.insert("operator".to_string(), Value::String(op));

        n.attributes.insert("right".to_string(),    Value::String(right));

        n.attributes.insert("line".to_string(),     Value::Number(line.into()));

        n

    }



    /// If statement.

    pub fn if_stmt(

        cond: String,

        then_body: Vec<BaseNode>,

        else_body: Option<Vec<BaseNode>>,

        line: usize,

    ) -> Self {

        let mut n = Self::new(NodeType::IfStatement);

        n.attributes.insert("condition".to_string(), Value::String(cond));

        n.attributes.insert("line".to_string(), Value::Number(line.into()));

        // children[0] = then block

        let mut then_node = Self::new(NodeType::Block);

        then_node.children = then_body;

        n.children.push(then_node);

        // children[1] = else block (opcional)

        if let Some(eb) = else_body {

            let mut else_node = Self::new(NodeType::Block);

            else_node.children = eb;

            n.children.push(else_node);

        }

        n

    }



    /// For cl  ssico (init; cond; update).

    pub fn for_loop(

        init: String,

        cond: String,

        update: String,

        body: Vec<BaseNode>,

        line: usize,

    ) -> Self {

        let mut n = Self::new(NodeType::ForLoop);

        n.attributes.insert("init".to_string(),   Value::String(init));

        n.attributes.insert("cond".to_string(),   Value::String(cond));

        n.attributes.insert("update".to_string(), Value::String(update));

        n.attributes.insert("line".to_string(),   Value::Number(line.into()));

        let mut body_node = Self::new(NodeType::Block);

        body_node.children = body;

        n.children.push(body_node);

        n

    }



    /// While loop.

    pub fn while_loop(cond: String, body: Vec<BaseNode>, line: usize) -> Self {

        let mut n = Self::new(NodeType::WhileLoop);

        n.attributes.insert("condition".to_string(), Value::String(cond));

        n.attributes.insert("line".to_string(),      Value::Number(line.into()));

        let mut body_node = Self::new(NodeType::Block);

        body_node.children = body;

        n.children.push(body_node);

        n

    }



    /// Do-while loop.

    pub fn do_while(body: Vec<BaseNode>, cond: String, line: usize) -> Self {

        let mut n = Self::new(NodeType::DoWhile);

        n.attributes.insert("condition".to_string(), Value::String(cond));

        n.attributes.insert("line".to_string(),      Value::Number(line.into()));

        let mut body_node = Self::new(NodeType::Block);

        body_node.children = body;

        n.children.push(body_node);

        n

    }



    /// For-in (for pattern in iterable).

    pub fn for_in(pattern: String, iterable: String, body: Vec<BaseNode>, line: usize) -> Self {

        let mut n = Self::new(NodeType::ForIn);

        n.attributes.insert("pattern".to_string(),  Value::String(pattern));

        n.attributes.insert("iterable".to_string(), Value::String(iterable));

        n.attributes.insert("line".to_string(),     Value::Number(line.into()));

        let mut body_node = Self::new(NodeType::Block);

        body_node.children = body;

        n.children.push(body_node);

        n

    }



    /// Switch statement.

    pub fn switch(value: String, cases: Vec<BaseNode>, line: usize) -> Self {

        let mut n = Self::new(NodeType::SwitchStatement);

        n.attributes.insert("value".to_string(), Value::String(value));

        n.attributes.insert("line".to_string(),  Value::Number(line.into()));

        n.children = cases;

        n

    }



    /// Case clause dentro de switch.

    pub fn case(value: Option<String>, body: Vec<BaseNode>, line: usize) -> Self {

        let mut n = Self::new(NodeType::CaseClause);

        if let Some(v) = value {

            n.attributes.insert("value".to_string(), Value::String(v));

        } else {

            n.attributes.insert("isDefault".to_string(), Value::Bool(true));

        }

        n.attributes.insert("line".to_string(), Value::Number(line.into()));

        let mut body_node = Self::new(NodeType::Block);

        body_node.children = body;

        n.children.push(body_node);

        n

    }



    /// Return statement.

    pub fn return_stmt(value: Option<String>, line: usize) -> Self {

        let mut n = Self::new(NodeType::Return);

        if let Some(v) = value {

            n.attributes.insert("value".to_string(), Value::String(v));

        }

        n.attributes.insert("line".to_string(), Value::Number(line.into()));

        n

    }



    /// Converte BaseNode para o formato esperado pelo CGenerator/RustGenerator

    /// (que usam helpers::array_utils::BaseNode com node_type: String).

    pub fn to_legacy(&self) -> crate::helpers::array_utils::BaseNode {

        crate::helpers::array_utils::BaseNode {

            node_type: format!("{:?}", self.node_type),

            attributes: self.attributes.clone(),

            children: self.children.iter().map(|c| c.to_legacy()).collect(),

        }

    }

}



//           ProgramNode / FunctionNode / ParamNode                                                                                                          



#[derive(Debug, Clone)]

pub struct ProgramNode {

    pub node_type: NodeType,

    pub functions: Vec<FunctionNode>,

    pub globals: Vec<BaseNode>,

    pub setup_body: Vec<BaseNode>,

    pub loop_body: Vec<BaseNode>,

    pub has_loop: bool,

}



impl ProgramNode {

    /// Converte para o BaseNode raiz que CGenerator e RustGenerator esperam.

    /// Os generators iteram `ast.children` onde cada filho    Function ou VarDeclaration.

    pub fn to_legacy_root(&self) -> crate::helpers::array_utils::BaseNode {

        let mut root = crate::helpers::array_utils::BaseNode {

            node_type: "Program".to_string(),

            attributes: HashMap::new(),

            children: vec![],

        };

        // globals primeiro

        for g in &self.globals {

            root.children.push(g.to_legacy());

        }

        // fun    es

        for f in &self.functions {

            root.children.push(f.to_legacy());

        }

        root

    }

}



#[derive(Debug, Clone)]

pub struct FunctionNode {

    pub node_type: NodeType,

    pub name: String,

    pub return_type: String,

    pub params: Vec<ParamNode>,

    pub body: Vec<BaseNode>,

    pub start_line: usize,

    pub end_line: usize,

}



impl FunctionNode {

    pub fn to_legacy(&self) -> crate::helpers::array_utils::BaseNode {

        let mut n = crate::helpers::array_utils::BaseNode {

            node_type: "Function".to_string(),

            attributes: HashMap::new(),

            children: vec![],

        };

        n.attributes.insert("name".to_string(),        Value::String(self.name.clone()));

        n.attributes.insert("returnType".to_string(),  Value::String(self.return_type.clone()));

        n.attributes.insert("line".to_string(),        Value::Number(self.start_line.into()));

        n.children = self.body.iter().map(|c| c.to_legacy()).collect();

        n

    }

}



#[derive(Debug, Clone)]

pub struct ParamNode {

    pub node_type: NodeType,

    pub name: String,

    pub param_type: String,

}











