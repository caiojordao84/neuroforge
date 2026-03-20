Perfeito. Tenho o formato exacto. Vou gerar agora o guia completo da Fase 1B com base no diagnóstico que fizemos.

***

Aqui está o ficheiro completo para guardares em `docs/guiaFase1B_Rust.md`:

***

```markdown
Aqui está o guia completo da Fase 1B, em blocos sequenciais com verificações de sucesso em cada passo.

***

# Fase 1B — Transforms, Schema, Parser Registry e Types PLC

> **Pré-requisito:** Fase 1A concluída — `cargo check -p neuroforge-asl` limpo, commits `120aac0` (borrow checker), `cf6c54e` (PLC plugins), `a93908b` (wasm_bindgen_test) presentes no branch `preRust`.

> Todos os blocos indicam se precisam de **PowerShell Admin** (`PS-ADMIN`) ou **PowerShell normal** (`PS`). Corre cada bloco na ordem indicada e verifica o output antes de avançar.

***

## Bloco 1 — Actualizar `Cargo.toml` do crate `neuroforge-asl`

> 🟡 **PS normal**

Adicionar as dependências em falta: `semver`, `uuid`, `roxmltree` e `tokio` feature-flagged (necessário para o `ASLExecutor` nativo sem quebrar o build WASM).

```powershell
cd D:\Documents\NeuroForge\neuroforge

@'
[package]
name    = "neuroforge-asl"
version = "4.0.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
serde       = { workspace = true }
serde_json  = { workspace = true }
thiserror   = { workspace = true }
anyhow      = { workspace = true }
wasm-bindgen = "0.2"

# ── Tree-sitter core ─────────────────────────────────────────────────────────
tree-sitter         = "0.26.3"

# ── Language grammars ────────────────────────────────────────────────────────
tree-sitter-c       = "0.24.1"
tree-sitter-cpp     = "0.23.4"
tree-sitter-python  = "0.25.0"
tree-sitter-rust    = "0.24.0"
tree-sitter-arduino = "0.24.0"
tree-sitter-xml     = "0.7.0"

# ── Compat. explícita ─────────────────────────────────────────────────────────
tree-sitter-language = "0.1.7"

# ── PLC / Structured Text (IEC 61131-3) ──────────────────────────────────────
iec61131            = "0.7.0"

# ── PLC Multi-Language (IL / LD / FBD / SFC) ────────────────────────────────
pest        = "2"
pest_derive = "2"
quick-xml   = { version = "0.39.2", features = ["serialize", "overlapped-lists"] }
plcopen     = "0.3.1"

# ── Schema + versionamento ────────────────────────────────────────────────────
semver    = { version = "1", features = ["serde"] }
uuid      = { version = "1", features = ["v4"] }
roxmltree = "0.19"

# ── Runtime async — feature-flagged para não puxar tokio no WASM ─────────────
tokio = { version = "1", features = ["rt", "time"], optional = true }

[features]
default = ["native"]
native  = ["tokio"]

[target.'cfg(target_arch = "wasm32")'.dependencies]
js-sys  = "0.3"
web-sys = { version = "0.3", features = ["console"] }

[dev-dependencies]
serde_json = { workspace = true }

[package.metadata.wasm-pack.profile.release]
wasm-opt = false
'@ | Set-Content -Encoding UTF8 "crates/neuroforge-asl/Cargo.toml"

Write-Host "✅ Cargo.toml do neuroforge-asl actualizado."
```

**✅ Verificar:**

```powershell
cargo check -p neuroforge-asl
```

Zero erros. Warnings de `unused` são normais nesta fase.

***

## Bloco 2 — Criar `types/asl_plc_types.rs`

> 🟡 **PS normal**

Tipos IEC 61131-3 em falta no crate — `AslRung`, `AslContact`, `AslCoil`, `AslTimerTON`, etc. Necessários para os plugins `ld/`, `fbd/`, `sfc/` e para o `LadderEditor`.

```powershell
@'
//! Tipos ASL para IEC 61131-3 (PLC)
//! Corresponde a asl_plc_types no plano v4.2

use serde::{Deserialize, Serialize};
use crate::types::asl_types::AslExpr;

// ── Programa PLC ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslPlcProgram {
    pub name: String,
    pub variables: Vec<AslPlcVar>,
    pub networks: Vec<AslNetwork>,
    pub functions: Vec<AslPlcFunction>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslPlcVar {
    pub name: String,
    pub var_type: String,
    pub initial_value: Option<AslExpr>,
    pub comment: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslPlcFunction {
    pub name: String,
    pub return_type: Option<String>,
    pub params: Vec<AslPlcVar>,
    pub body: Vec<AslNetwork>,
}

// ── Rede / Rung ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslNetwork {
    pub id: u32,
    pub comment: Option<String>,
    pub kind: NetworkKind,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum NetworkKind {
    Ladder(AslRung),
    St(String),       // Structured Text inline
    Fbd(Vec<AslFbdBlock>),
    Sfc(Vec<AslSfcStep>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslRung {
    pub number: u32,
    pub comment: Option<String>,
    pub elements: Vec<AslLadderElement>,
}

// ── Elementos Ladder ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AslLadderElement {
    Contact(AslContact),
    NegContact(AslContact),
    TrigR(AslContact),        // Detecção borda subida P
    TrigF(AslContact),        // Detecção borda descida N
    Coil(AslCoil),
    NegCoil(AslCoil),
    SetCoil(AslCoil),
    ResetCoil(AslCoil),
    TimerTon(AslTimerTON),
    TimerTof(AslTimerTOF),
    TimerTp(AslTimerTP),
    CounterCtu(AslCounterCTU),
    CounterCtd(AslCounterCTD),
    LatchSr(AslLatchSR),
    LatchRs(AslLatchRS),
    FunctionBlock(AslFbCall),
    BranchStart,
    BranchEnd,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslContact {
    pub variable: String,
    pub comment: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslCoil {
    pub variable: String,
    pub comment: Option<String>,
}

// ── Blocos de Função IEC ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslTimerTON {
    pub tag: String,
    pub preset: AslExpr,
    pub output: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslTimerTOF {
    pub tag: String,
    pub preset: AslExpr,
    pub output: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslTimerTP {
    pub tag: String,
    pub preset: AslExpr,
    pub output: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslCounterCTU {
    pub tag: String,
    pub preset: AslExpr,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslCounterCTD {
    pub tag: String,
    pub preset: AslExpr,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslLatchSR {
    pub tag: String,
    pub set: AslExpr,
    pub reset: AslExpr,
    pub output: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslLatchRS {
    pub tag: String,
    pub set: AslExpr,
    pub reset: AslExpr,
    pub output: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslFbCall {
    pub instance: String,
    pub fb_type: String,
    pub inputs: Vec<(String, AslExpr)>,
    pub outputs: Vec<(String, String)>,
}

// ── FBD ───────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslFbdBlock {
    pub id: String,
    pub block_type: String,
    pub inputs: Vec<(String, AslExpr)>,
    pub outputs: Vec<(String, String)>,
    pub position: (f64, f64),
}

// ── SFC ───────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslSfcStep {
    pub name: String,
    pub is_initial: bool,
    pub actions: Vec<AslSfcAction>,
    pub transitions: Vec<AslSfcTransition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslSfcAction {
    pub qualifier: String,  // "N", "S", "R", "P", "L", etc.
    pub name: String,
    pub body: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslSfcTransition {
    pub target_step: String,
    pub condition: AslExpr,
}
'@ | Set-Content -Encoding UTF8 "crates/neuroforge-asl/src/types/asl_plc_types.rs"

Write-Host "✅ types/asl_plc_types.rs criado."
```

Actualizar `types/mod.rs` para incluir o novo módulo:

```powershell
@'
pub mod asl_types;
pub mod asl_plc_types;
pub mod nodes;

pub use asl_types::*;
pub use asl_plc_types::*;
'@ | Set-Content -Encoding UTF8 "crates/neuroforge-asl/src/types/mod.rs"

Write-Host "✅ types/mod.rs actualizado."
```

**✅ Verificar:**

```powershell
cargo check -p neuroforge-asl
```

***

## Bloco 3 — Criar `transforms/postfix_utils.rs`

> 🟡 **PS normal**

Extrai side-effects `i++` / `i--` de expressões. Dependência directa do `statement_registry.rs` — deve ser criado antes.

```powershell
@'
//! postfix_utils.rs — extrai side-effects i++/i-- de expressões
//! Migrado de: src/engine/asl/transforms/postfixUtils.ts

use crate::types::asl_types::{AslExpr, AslStatement, AslBinOp, AslVar};

/// Resultado da extracção de side-effects de uma expressão postfix
#[derive(Debug, Clone)]
pub struct PostfixExtraction {
    /// Expressão limpa (sem o side-effect)
    pub expr: AslExpr,
    /// Statements a emitir APÓS a expressão principal (ex: i = i + 1)
    pub post_stmts: Vec<AslStatement>,
}

/// Extrai `i++` → expr=`i`, post=[`i = i + 1`]
/// Extrai `i--` → expr=`i`, post=[`i = i - 1`]
/// Qualquer outra expressão é devolvida sem alteração.
pub fn extract_postfix(expr: AslExpr) -> PostfixExtraction {
    match &expr {
        AslExpr::PostfixInc(var) => {
            let post = AslStatement::Assign {
                target: var.clone(),
                value: AslExpr::BinOp {
                    op: AslBinOp::Add,
                    left: Box::new(AslExpr::Var(AslVar { name: var.clone(), index: None })),
                    right: Box::new(AslExpr::IntLiteral(1)),
                },
            };
            PostfixExtraction {
                expr: AslExpr::Var(AslVar { name: var.clone(), index: None }),
                post_stmts: vec![post],
            }
        }
        AslExpr::PostfixDec(var) => {
            let post = AslStatement::Assign {
                target: var.clone(),
                value: AslExpr::BinOp {
                    op: AslBinOp::Sub,
                    left: Box::new(AslExpr::Var(AslVar { name: var.clone(), index: None })),
                    right: Box::new(AslExpr::IntLiteral(1)),
                },
            };
            PostfixExtraction {
                expr: AslExpr::Var(AslVar { name: var.clone(), index: None }),
                post_stmts: vec![post],
            }
        }
        _ => PostfixExtraction {
            expr,
            post_stmts: vec![],
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_postfix_inc() {
        let expr = AslExpr::PostfixInc("i".to_string());
        let result = extract_postfix(expr);
        assert!(matches!(result.expr, AslExpr::Var(_)));
        assert_eq!(result.post_stmts.len(), 1);
    }

    #[test]
    fn test_extract_postfix_dec() {
        let expr = AslExpr::PostfixDec("i".to_string());
        let result = extract_postfix(expr);
        assert!(matches!(result.expr, AslExpr::Var(_)));
        assert_eq!(result.post_stmts.len(), 1);
    }

    #[test]
    fn test_passthrough_literal() {
        let expr = AslExpr::IntLiteral(42);
        let result = extract_postfix(expr.clone());
        assert!(matches!(result.expr, AslExpr::IntLiteral(42)));
        assert!(result.post_stmts.is_empty());
    }
}
'@ | Set-Content -Encoding UTF8 "crates/neuroforge-asl/src/transforms/postfix_utils.rs"

Write-Host "✅ transforms/postfix_utils.rs criado."
```

***

## Bloco 4 — Criar `transforms/expr_transform.rs`

> 🟡 **PS normal**

Transforma expressões AST (ProgramNode) em `AslExpr`. Migrado de `exprTransform.ts`.

```powershell
@'
//! expr_transform.rs — transforma nós de expressão AST em AslExpr
//! Migrado de: src/engine/asl/transforms/exprTransform.ts

use crate::types::asl_types::{AslExpr, AslBinOp, AslCompareOp, AslBoolOp, AslVar};
use crate::types::nodes::{ExprNode, ExprKind};
use crate::transforms::context::TransformContext;
use crate::transforms::postfix_utils::extract_postfix;

/// Transforma um `ExprNode` (AST) em `AslExpr` (IR ASL)
pub fn transform_expr(node: &ExprNode, ctx: &TransformContext) -> AslExpr {
    match &node.kind {
        ExprKind::IntLiteral(v)    => AslExpr::IntLiteral(*v),
        ExprKind::FloatLiteral(v)  => AslExpr::FloatLiteral(*v),
        ExprKind::BoolLiteral(v)   => AslExpr::BoolLiteral(*v),
        ExprKind::StringLiteral(v) => AslExpr::StringLiteral(v.clone()),
        ExprKind::Null             => AslExpr::Null,

        ExprKind::Identifier(name) => AslExpr::Var(AslVar {
            name: name.clone(),
            index: None,
        }),

        ExprKind::ArrayIndex { array, index } => AslExpr::Var(AslVar {
            name: array.clone(),
            index: Some(Box::new(transform_expr(index, ctx))),
        }),

        ExprKind::BinOp { op, left, right } => {
            let l = transform_expr(left, ctx);
            let r = transform_expr(right, ctx);
            AslExpr::BinOp {
                op: map_bin_op(op),
                left: Box::new(l),
                right: Box::new(r),
            }
        }

        ExprKind::Compare { op, left, right } => {
            let l = transform_expr(left, ctx);
            let r = transform_expr(right, ctx);
            AslExpr::Compare {
                op: map_compare_op(op),
                left: Box::new(l),
                right: Box::new(r),
            }
        }

        ExprKind::BoolOp { op, operands } => {
            let ops: Vec<AslExpr> = operands.iter()
                .map(|o| transform_expr(o, ctx))
                .collect();
            AslExpr::BoolOp {
                op: map_bool_op(op),
                operands: ops,
            }
        }

        ExprKind::Not(inner) => AslExpr::Not(Box::new(transform_expr(inner, ctx))),

        ExprKind::PostfixInc(name) => AslExpr::PostfixInc(name.clone()),
        ExprKind::PostfixDec(name) => AslExpr::PostfixDec(name.clone()),

        ExprKind::Call { name, args } => {
            let transformed_args: Vec<AslExpr> = args.iter()
                .map(|a| transform_expr(a, ctx))
                .collect();
            AslExpr::Call {
                name: name.clone(),
                args: transformed_args,
            }
        }

        ExprKind::MemberAccess { object, member } => AslExpr::MemberAccess {
            object: object.clone(),
            member: member.clone(),
        },

        ExprKind::Cast { target_type, expr } => AslExpr::Cast {
            target_type: target_type.clone(),
            expr: Box::new(transform_expr(expr, ctx)),
        },

        ExprKind::Ternary { condition, then_expr, else_expr } => AslExpr::Ternary {
            condition: Box::new(transform_expr(condition, ctx)),
            then_expr: Box::new(transform_expr(then_expr, ctx)),
            else_expr: Box::new(transform_expr(else_expr, ctx)),
        },
    }
}

fn map_bin_op(op: &str) -> AslBinOp {
    match op {
        "+" => AslBinOp::Add,
        "-" => AslBinOp::Sub,
        "*" => AslBinOp::Mul,
        "/" => AslBinOp::Div,
        "%" => AslBinOp::Mod,
        "&" => AslBinOp::BitAnd,
        "|" => AslBinOp::BitOr,
        "^" => AslBinOp::BitXor,
        "<<" => AslBinOp::Shl,
        ">>" => AslBinOp::Shr,
        _   => AslBinOp::Add, // fallback seguro
    }
}

fn map_compare_op(op: &str) -> AslCompareOp {
    match op {
        "==" => AslCompareOp::Eq,
        "!=" => AslCompareOp::Ne,
        "<"  => AslCompareOp::Lt,
        "<=" => AslCompareOp::Le,
        ">"  => AslCompareOp::Gt,
        ">=" => AslCompareOp::Ge,
        _    => AslCompareOp::Eq,
    }
}

fn map_bool_op(op: &str) -> AslBoolOp {
    match op {
        "&&" | "and" => AslBoolOp::And,
        "||" | "or"  => AslBoolOp::Or,
        _            => AslBoolOp::And,
    }
}
'@ | Set-Content -Encoding UTF8 "crates/neuroforge-asl/src/transforms/expr_transform.rs"

Write-Host "✅ transforms/expr_transform.rs criado."
```

***

## Bloco 5 — Criar `transforms/call_transform.rs`

> 🟡 **PS normal**

Transforma chamadas de função AST em nós ASL de hardware (`AslDigitalWrite`, `AslPrint`, `AslSerialBegin`, etc.). Migrado de `callTransform.ts`.

```powershell
@'
//! call_transform.rs — transforma chamadas de função em nós ASL de hardware
//! Migrado de: src/engine/asl/transforms/callTransform.ts

use crate::types::asl_types::*;
use crate::types::nodes::{CallNode, ExprNode};
use crate::transforms::context::TransformContext;
use crate::transforms::expr_transform::transform_expr;

/// Resultado de transformar uma chamada de função.
/// Pode produzir um AslStatement (hardware call) ou nada (chamada desconhecida).
pub fn transform_call(call: &CallNode, ctx: &TransformContext) -> Option<AslStatement> {
    let args: Vec<AslExpr> = call.args.iter()
        .map(|a| transform_expr(a, ctx))
        .collect();

    match call.name.as_str() {
        // ── GPIO ─────────────────────────────────────────────────────────────
        "pinMode" => {
            let pin   = args.get(0).cloned().unwrap_or(AslExpr::IntLiteral(0));
            let mode  = args.get(1).cloned().unwrap_or(AslExpr::StringLiteral("OUTPUT".into()));
            Some(AslStatement::PinMode { pin, mode })
        }
        "digitalWrite" => {
            let pin   = args.get(0).cloned().unwrap_or(AslExpr::IntLiteral(0));
            let value = args.get(1).cloned().unwrap_or(AslExpr::IntLiteral(0));
            Some(AslStatement::DigitalWrite { pin, value })
        }
        "analogWrite" => {
            let pin   = args.get(0).cloned().unwrap_or(AslExpr::IntLiteral(0));
            let value = args.get(1).cloned().unwrap_or(AslExpr::IntLiteral(0));
            Some(AslStatement::AnalogWrite { pin, value })
        }
        "digitalRead" | "analogRead" => {
            let pin     = args.get(0).cloned().unwrap_or(AslExpr::IntLiteral(0));
            let mode    = if call.name == "analogRead" { ReadMode::Analog } else { ReadMode::Digital };
            let result  = call.result_var.clone().unwrap_or_default();
            Some(AslStatement::Read { pin, mode, result })
        }

        // ── Serial ───────────────────────────────────────────────────────────
        "Serial.begin" | "serialBegin" => {
            let baud = args.get(0).cloned().unwrap_or(AslExpr::IntLiteral(9600));
            Some(AslStatement::SerialBegin { baud })
        }
        "Serial.print" | "Serial.println" | "print" => {
            let value   = args.get(0).cloned().unwrap_or(AslExpr::StringLiteral("".into()));
            let newline = call.name.ends_with("println");
            Some(AslStatement::Print { value, newline })
        }

        // ── Timing ───────────────────────────────────────────────────────────
        "delay" => {
            let ms = args.get(0).cloned().unwrap_or(AslExpr::IntLiteral(0));
            Some(AslStatement::Delay { ms })
        }
        "delayMicroseconds" => {
            let us = args.get(0).cloned().unwrap_or(AslExpr::IntLiteral(0));
            Some(AslStatement::DelayMicros { us })
        }

        // ── Servo ────────────────────────────────────────────────────────────
        "servo.attach" | "servoAttach" => {
            let pin  = args.get(0).cloned().unwrap_or(AslExpr::IntLiteral(0));
            let name = call.object.clone().unwrap_or_else(|| "servo".into());
            Some(AslStatement::ServoAttach { name, pin })
        }
        "servo.write" | "servoWrite" => {
            let angle = args.get(0).cloned().unwrap_or(AslExpr::IntLiteral(0));
            let name  = call.object.clone().unwrap_or_else(|| "servo".into());
            Some(AslStatement::ServoWrite { name, angle })
        }
        "servo.detach" | "servoDetach" => {
            let name = call.object.clone().unwrap_or_else(|| "servo".into());
            Some(AslStatement::ServoDetach { name })
        }

        // ── I2C ──────────────────────────────────────────────────────────────
        "Wire.write" | "i2cWrite" => {
            let addr  = args.get(0).cloned().unwrap_or(AslExpr::IntLiteral(0));
            let value = args.get(1).cloned().unwrap_or(AslExpr::IntLiteral(0));
            Some(AslStatement::I2cWrite { addr, value })
        }
        "Wire.read" | "i2cRead" => {
            let addr   = args.get(0).cloned().unwrap_or(AslExpr::IntLiteral(0));
            let result = call.result_var.clone().unwrap_or_default();
            Some(AslStatement::I2cRead { addr, result })
        }

        // ── SPI ──────────────────────────────────────────────────────────────
        "SPI.transfer" | "spiTransfer" => {
            let value  = args.get(0).cloned().unwrap_or(AslExpr::IntLiteral(0));
            let result = call.result_var.clone().unwrap_or_default();
            Some(AslStatement::SpiTransfer { value, result })
        }

        // ── PWM ──────────────────────────────────────────────────────────────
        "pwmInit" => {
            let pin  = args.get(0).cloned().unwrap_or(AslExpr::IntLiteral(0));
            let freq = args.get(1).cloned().unwrap_or(AslExpr::IntLiteral(1000));
            Some(AslStatement::PwmInit { pin, freq })
        }
        "pwmSetDuty" => {
            let pin  = args.get(0).cloned().unwrap_or(AslExpr::IntLiteral(0));
            let duty = args.get(1).cloned().unwrap_or(AslExpr::IntLiteral(0));
            Some(AslStatement::PwmSetDuty { pin, duty })
        }

        // ── RGB ──────────────────────────────────────────────────────────────
        "rgbSet" => {
            let pin = args.get(0).cloned().unwrap_or(AslExpr::IntLiteral(0));
            let r   = args.get(1).cloned().unwrap_or(AslExpr::IntLiteral(0));
            let g   = args.get(2).cloned().unwrap_or(AslExpr::IntLiteral(0));
            let b   = args.get(3).cloned().unwrap_or(AslExpr::IntLiteral(0));
            Some(AslStatement::RgbSet { pin, r, g, b })
        }

        // ── Chamada genérica (função de utilizador) ──────────────────────────
        _ => {
            Some(AslStatement::Call {
                name: call.name.clone(),
                args,
            })
        }
    }
}
'@ | Set-Content -Encoding UTF8 "crates/neuroforge-asl/src/transforms/call_transform.rs"

Write-Host "✅ transforms/call_transform.rs criado."
```

***

## Bloco 6 — Criar `transforms/block_transform.rs`

> 🟡 **PS normal**

Transforma blocos de controlo de fluxo AST (if, while, for, switch) em `AslStatement`. Migrado de `blockTransform.ts`.

```powershell
@'
//! block_transform.rs — transforma blocos de controlo de fluxo em AslStatement
//! Migrado de: src/engine/asl/transforms/blockTransform.ts

use crate::types::asl_types::*;
use crate::types::nodes::{BlockNode, BlockKind, ExprNode};
use crate::transforms::context::TransformContext;
use crate::transforms::expr_transform::transform_expr;

/// Transforma um `BlockNode` em zero ou mais `AslStatement`
pub fn transform_block(block: &BlockNode, ctx: &TransformContext) -> Vec<AslStatement> {
    match &block.kind {

        BlockKind::If { condition, then_body, else_body } => {
            let cond = transform_expr(condition, ctx);
            let then_stmts = transform_body(then_body, ctx);
            let else_stmts = else_body.as_ref()
                .map(|b| transform_body(b, ctx))
                .unwrap_or_default();
            vec![AslStatement::If {
                condition: cond,
                then_body: then_stmts,
                else_body: if else_stmts.is_empty() { None } else { Some(else_stmts) },
            }]
        }

        BlockKind::While { condition, body } => {
            let cond  = transform_expr(condition, ctx);
            let stmts = transform_body(body, ctx);
            vec![AslStatement::While {
                condition: cond,
                body: stmts,
            }]
        }

        BlockKind::DoWhile { condition, body } => {
            let cond  = transform_expr(condition, ctx);
            let stmts = transform_body(body, ctx);
            vec![AslStatement::DoWhile {
                condition: cond,
                body: stmts,
            }]
        }

        BlockKind::For { init, condition, update, body } => {
            let init_stmt  = init.as_ref().map(|e| transform_expr(e, ctx));
            let cond       = condition.as_ref().map(|e| transform_expr(e, ctx));
            let update_stmt = update.as_ref().map(|e| transform_expr(e, ctx));
            let stmts      = transform_body(body, ctx);
            vec![AslStatement::For {
                init: init_stmt,
                condition: cond,
                update: update_stmt,
                body: stmts,
            }]
        }

        BlockKind::ForIn { variable, iterable, body } => {
            let iter  = transform_expr(iterable, ctx);
            let stmts = transform_body(body, ctx);
            vec![AslStatement::ForIn {
                variable: variable.clone(),
                iterable: iter,
                body: stmts,
            }]
        }

        BlockKind::Switch { discriminant, cases, default } => {
            let disc = transform_expr(discriminant, ctx);
            let asl_cases: Vec<AslCase> = cases.iter().map(|c| AslCase {
                value: transform_expr(&c.value, ctx),
                body: transform_body(&c.body, ctx),
            }).collect();
            let default_body = default.as_ref()
                .map(|b| transform_body(b, ctx));
            vec![AslStatement::Switch {
                discriminant: disc,
                cases: asl_cases,
                default: default_body,
            }]
        }

        BlockKind::Break    => vec![AslStatement::Break],
        BlockKind::Continue => vec![AslStatement::Continue],

        BlockKind::Return(expr) => {
            let value = expr.as_ref().map(|e| transform_expr(e, ctx));
            vec![AslStatement::Return { value }]
        }
    }
}

/// Transforma uma lista de nós de bloco/expressão em Vec<AslStatement>
pub fn transform_body(nodes: &[BlockNode], ctx: &TransformContext) -> Vec<AslStatement> {
    nodes.iter().flat_map(|n| transform_block(n, ctx)).collect()
}
'@ | Set-Content -Encoding UTF8 "crates/neuroforge-asl/src/transforms/block_transform.rs"

Write-Host "✅ transforms/block_transform.rs criado."
```

***

## Bloco 7 — Criar `transforms/statement_registry.rs`

> 🟡 **PS normal**

Registry central que despacha cada nó AST para o transform correcto. É o coração da pipeline `ProgramNode → AslProgram`. Migrado de `statementRegistry.ts` (39 KB no original TS).

```powershell
@'
//! statement_registry.rs — registry central de transforms de statements
//! Migrado de: src/engine/asl/transforms/statementRegistry.ts
//! Este é o módulo mais crítico da pipeline ProgramNode → AslProgram.

use crate::types::asl_types::*;
use crate::types::nodes::{ProgramNode, StatementNode, StatementKind, FunctionNode};
use crate::transforms::context::TransformContext;
use crate::transforms::expr_transform::transform_expr;
use crate::transforms::call_transform::transform_call;
use crate::transforms::block_transform::{transform_block, transform_body};
use crate::transforms::postfix_utils::extract_postfix;

/// Transforma um `ProgramNode` completo em `AslProgram`
pub fn program_to_asl(program: &ProgramNode, ctx: &mut TransformContext) -> AslProgram {
    let globals: Vec<AslVar> = program.globals.iter()
        .map(|v| transform_var_decl(v, ctx))
        .collect();

    let functions: Vec<AslFunction> = program.functions.iter()
        .map(|f| transform_function(f, ctx))
        .collect();

    // O programa principal (setup + loop ou main) torna-se a task "main"
    let main_body: Vec<AslStatement> = program.body.iter()
        .flat_map(|s| transform_statement(s, ctx))
        .collect();

    let main_task = AslTask {
        name: "main".to_string(),
        body: main_body,
        is_loop: program.has_loop,
    };

    AslProgram {
        asl_version: "4.0.0".to_string(),
        tasks: vec![main_task],
        globals,
        functions,
        imports: ctx.collect_imports(),
    }
}

/// Transforma um `StatementNode` em zero ou mais `AslStatement`
pub fn transform_statement(node: &StatementNode, ctx: &mut TransformContext) -> Vec<AslStatement> {
    match &node.kind {

        // ── Declaração de variável ────────────────────────────────────────────
        StatementKind::VarDecl { name, var_type, value } => {
            let asl_type = ctx.resolve_type(var_type.as_deref().unwrap_or("int"));
            let init     = value.as_ref().map(|v| transform_expr(v, ctx));
            vec![AslStatement::VarDecl {
                name: name.clone(),
                var_type: asl_type,
                value: init,
            }]
        }

        // ── Atribuição ────────────────────────────────────────────────────────
        StatementKind::Assign { target, value } => {
            let val = transform_expr(value, ctx);
            // Extrair postfix side-effects do target se necessário
            vec![AslStatement::Assign {
                target: target.clone(),
                value: val,
            }]
        }

        // ── Chamada de função / hardware ──────────────────────────────────────
        StatementKind::Call(call_node) => {
            if let Some(stmt) = transform_call(call_node, ctx) {
                vec![stmt]
            } else {
                vec![]
            }
        }

        // ── Expressão standalone (ex: i++, chamada sem retorno) ───────────────
        StatementKind::Expr(expr_node) => {
            let expr   = transform_expr(expr_node, ctx);
            let extracted = extract_postfix(expr.clone());
            let mut result = vec![];
            // Se é apenas um postfix standalone, converte em Assign
            if !extracted.post_stmts.is_empty() {
                result.extend(extracted.post_stmts);
            } else {
                result.push(AslStatement::ExprStatement(expr));
            }
            result
        }

        // ── Blocos de controlo de fluxo ───────────────────────────────────────
        StatementKind::Block(block_node) => {
            transform_block(block_node, ctx)
        }

        // ── Return ────────────────────────────────────────────────────────────
        StatementKind::Return(expr) => {
            let value = expr.as_ref().map(|e| transform_expr(e, ctx));
            vec![AslStatement::Return { value }]
        }

        // ── Break / Continue ─────────────────────────────────────────────────
        StatementKind::Break    => vec![AslStatement::Break],
        StatementKind::Continue => vec![AslStatement::Continue],

        // ── Comentário (preservado como metadata) ────────────────────────────
        StatementKind::Comment(text) => {
            vec![AslStatement::Comment(text.clone())]
        }
    }
}

fn transform_var_decl(v: &crate::types::nodes::VarDeclNode, ctx: &mut TransformContext) -> AslVar {
    AslVar {
        name: v.name.clone(),
        var_type: ctx.resolve_type(v.var_type.as_deref().unwrap_or("int")),
        value: v.value.as_ref().map(|e| transform_expr(e, ctx)),
        is_global: true,
        is_const: v.is_const,
    }
}

fn transform_function(f: &FunctionNode, ctx: &mut TransformContext) -> AslFunction {
    let params: Vec<AslParam> = f.params.iter().map(|p| AslParam {
        name: p.name.clone(),
        param_type: ctx.resolve_type(&p.param_type),
    }).collect();

    let body: Vec<AslStatement> = f.body.iter()
        .flat_map(|s| transform_statement(s, ctx))
        .collect();

    AslFunction {
        name: f.name.clone(),
        params,
        return_type: f.return_type.as_ref()
            .map(|t| ctx.resolve_type(t)),
        body,
        is_setup: f.name == "setup",
        is_loop:  f.name == "loop",
    }
}
'@ | Set-Content -Encoding UTF8 "crates/neuroforge-asl/src/transforms/statement_registry.rs"

Write-Host "✅ transforms/statement_registry.rs criado."
```

***

## Bloco 8 — Criar `transforms/code_to_asl.rs`

> 🟡 **PS normal**

Entry point da **Pipeline 1 (Simulação)**: `ProgramNode → AslProgram`. É a função `astToASL()` do TypeScript original.

```powershell
@'
//! code_to_asl.rs — Pipeline 1: ProgramNode → AslProgram (IR de simulação)
//! Entry point público: fn ast_to_asl(program: &ProgramNode, language: Language) -> AslProgram
//! Migrado de: src/engine/asl/codeToASL.ts (função astToASL)
//!
//! REGRA DE OURO: AslProgram é estritamente o IR de SIMULAÇÃO.
//! Nunca é usado na transpilação (Pipeline 2 usa ProgramNode directamente).

use crate::types::asl_types::AslProgram;
use crate::types::nodes::ProgramNode;
use crate::transforms::context::{Language, TransformContext};
use crate::transforms::statement_registry::program_to_asl;

/// Converte um `ProgramNode` normalizado em `AslProgram`.
///
/// # Argumentos
/// * `program`  — AST normalizado (saída de `ast_normalizer::normalize`)
/// * `language` — Linguagem de origem (para resolução de tipos e shims)
///
/// # Retorna
/// `AslProgram` com `asl_version = "4.0.0"`
pub fn ast_to_asl(program: &ProgramNode, language: Language) -> AslProgram {
    let mut ctx = TransformContext::new(language);
    program_to_asl(program, &mut ctx)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::nodes::ProgramNode;
    use crate::transforms::context::Language;

    #[test]
    fn test_empty_program_produces_valid_asl() {
        let program = ProgramNode::empty();
        let asl = ast_to_asl(&program, Language::Cpp);
        assert_eq!(asl.asl_version, "4.0.0");
        assert!(asl.tasks.len() >= 1);
    }
}
'@ | Set-Content -Encoding UTF8 "crates/neuroforge-asl/src/transforms/code_to_asl.rs"

Write-Host "✅ transforms/code_to_asl.rs criado."
```

***

## Bloco 9 — Actualizar `transforms/mod.rs`

> 🟡 **PS normal**

Declarar todos os novos módulos e re-exportar os tipos mais usados.

```powershell
@'
pub mod context;
pub mod ast_normalizer;
pub mod postfix_utils;
pub mod expr_transform;
pub mod call_transform;
pub mod block_transform;
pub mod statement_registry;
pub mod code_to_asl;

pub use context::{Language, TransformContext};
pub use code_to_asl::ast_to_asl;
pub use statement_registry::{program_to_asl, transform_statement};
'@ | Set-Content -Encoding UTF8 "crates/neuroforge-asl/src/transforms/mod.rs"

Write-Host "✅ transforms/mod.rs actualizado."
```

**✅ Verificar imediatamente:**

```powershell
cargo check -p neuroforge-asl
```

***

## Bloco 10 — Criar `parser/language_registry.rs`

> 🟡 **PS normal**

Registry de linguagens suportadas com metadata. Migrado de `LanguageRegistry.ts`.

```powershell
@'
//! language_registry.rs — registry de linguagens suportadas com metadata
//! Migrado de: src/engine/asl/LanguageRegistry.ts

use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum LanguageCategory {
    Mcu,
    Plc,
    Scripting,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageMeta {
    /// Identificador interno (ex: "cpp", "micropython", "st")
    pub id: String,
    /// Nome de exibição (ex: "C/C++ Arduino", "MicroPython")
    pub display_name: String,
    /// Extensão de ficheiro padrão (ex: ".ino", ".py", ".st")
    pub extension: String,
    /// ID de linguagem para Monaco Editor
    pub monaco_language: String,
    /// Categoria
    pub category: LanguageCategory,
    /// Suporte a geração ASL completa
    pub is_asl_supported: bool,
    /// Suporte a parsing (entrada) ASL
    pub is_parser_supported: bool,
}

pub struct LanguageRegistry {
    languages: HashMap<String, LanguageMeta>,
}

impl LanguageRegistry {
    pub fn new() -> Self {
        let mut reg = Self { languages: HashMap::new() };
        reg.register_defaults();
        reg
    }

    fn register_defaults(&mut self) {
        let langs = vec![
            LanguageMeta {
                id: "cpp".into(), display_name: "C/C++ Arduino".into(),
                extension: ".ino".into(), monaco_language: "cpp".into(),
                category: LanguageCategory::Mcu,
                is_asl_supported: true, is_parser_supported: true,
            },
            LanguageMeta {
                id: "micropython".into(), display_name: "MicroPython".into(),
                extension: ".py".into(), monaco_language: "python".into(),
                category: LanguageCategory::Mcu,
                is_asl_supported: true, is_parser_supported: true,
            },
            LanguageMeta {
                id: "rust_std".into(), display_name: "Rust embedded-hal".into(),
                extension: ".rs".into(), monaco_language: "rust".into(),
                category: LanguageCategory::Mcu,
                is_asl_supported: true, is_parser_supported: true,
            },
            LanguageMeta {
                id: "rust_embassy".into(), display_name: "Rust Embassy".into(),
                extension: ".rs".into(), monaco_language: "rust".into(),
                category: LanguageCategory::Mcu,
                is_asl_supported: false, is_parser_supported: false, // Fase 3
            },
            LanguageMeta {
                id: "st".into(), display_name: "Structured Text (IEC 61131-3)".into(),
                extension: ".st".into(), monaco_language: "plaintext".into(),
                category: LanguageCategory::Plc,
                is_asl_supported: true, is_parser_supported: true,
            },
            LanguageMeta {
                id: "ld".into(), display_name: "Ladder Diagram".into(),
                extension: ".ld".into(), monaco_language: "plaintext".into(),
                category: LanguageCategory::Plc,
                is_asl_supported: true, is_parser_supported: true,
            },
            LanguageMeta {
                id: "il".into(), display_name: "Instruction List".into(),
                extension: ".il".into(), monaco_language: "plaintext".into(),
                category: LanguageCategory::Plc,
                is_asl_supported: true, is_parser_supported: true,
            },
            LanguageMeta {
                id: "fbd".into(), display_name: "Function Block Diagram".into(),
                extension: ".fbd".into(), monaco_language: "plaintext".into(),
                category: LanguageCategory::Plc,
                is_asl_supported: true, is_parser_supported: true,
            },
            LanguageMeta {
                id: "sfc".into(), display_name: "Sequential Function Chart".into(),
                extension: ".sfc".into(), monaco_language: "plaintext".into(),
                category: LanguageCategory::Plc,
                is_asl_supported: true, is_parser_supported: false, // Fase 6
            },
        ];
        for lang in langs {
            self.languages.insert(lang.id.clone(), lang);
        }
    }

    pub fn get(&self, id: &str) -> Option<&LanguageMeta> {
        self.languages.get(id)
    }

    pub fn all(&self) -> Vec<&LanguageMeta> {
        self.languages.values().collect()
    }

    pub fn asl_supported(&self) -> Vec<&LanguageMeta> {
        self.languages.values()
            .filter(|l| l.is_asl_supported)
            .collect()
    }

    pub fn register(&mut self, lang: LanguageMeta) {
        self.languages.insert(lang.id.clone(), lang);
    }
}

impl Default for LanguageRegistry {
    fn default() -> Self { Self::new() }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cpp_registered() {
        let reg = LanguageRegistry::new();
        assert!(reg.get("cpp").is_some());
    }

    #[test]
    fn test_asl_supported_languages() {
        let reg = LanguageRegistry::new();
        let supported = reg.asl_supported();
        assert!(supported.iter().any(|l| l.id == "cpp"));
        assert!(supported.iter().any(|l| l.id == "st"));
    }
}
'@ | Set-Content -Encoding UTF8 "crates/neuroforge-asl/src/parser/language_registry.rs"

Write-Host "✅ parser/language_registry.rs criado."
```

***

## Bloco 11 — Criar `parser/tree_sitter_loader.rs`

> 🟡 **PS normal**

Inicialização e gestão dos parsers tree-sitter. Migrado de `TreeSitterLoader.ts`.

```powershell
@'
//! tree_sitter_loader.rs — inicialização dos parsers tree-sitter por linguagem
//! Migrado de: src/engine/asl/TreeSitterLoader.ts

use tree_sitter::Language as TsLanguage;

/// Retorna a linguagem tree-sitter para o ID dado.
/// Retorna `None` para linguagens sem grammar tree-sitter disponível.
pub fn get_ts_language(lang_id: &str) -> Option<TsLanguage> {
    match lang_id {
        "cpp" | "c"    => Some(tree_sitter_cpp::LANGUAGE.into()),
        "micropython"  => Some(tree_sitter_python::LANGUAGE.into()),
        "rust_std" | "rust_embassy" => Some(tree_sitter_rust::LANGUAGE.into()),
        "arduino"      => {
            // Fallback para C++ se a grammar Arduino não estiver disponível
            Some(tree_sitter_cpp::LANGUAGE.into())
        }
        _ => None,
    }
}

/// Verifica se um ID de linguagem tem parser tree-sitter disponível
pub fn is_ts_supported(lang_id: &str) -> bool {
    get_ts_language(lang_id).is_some()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cpp_ts_available() {
        assert!(get_ts_language("cpp").is_some());
    }

    #[test]
    fn test_python_ts_available() {
        assert!(get_ts_language("micropython").is_some());
    }

    #[test]
    fn test_rust_ts_available() {
        assert!(get_ts_language("rust_std").is_some());
    }

    #[test]
    fn test_st_no_ts() {
        // ST usa parser iec61131 dedicado, não tree-sitter
        assert!(get_ts_language("st").is_none());
    }
}
'@ | Set-Content -Encoding UTF8 "crates/neuroforge-asl/src/parser/tree_sitter_loader.rs"

Write-Host "✅ parser/tree_sitter_loader.rs criado."
```

Actualizar `parser/mod.rs`:

```powershell
@'
pub mod language_registry;
pub mod tree_sitter_loader;

pub use language_registry::{LanguageRegistry, LanguageMeta, LanguageCategory};
pub use tree_sitter_loader::{get_ts_language, is_ts_supported};
'@ | Set-Content -Encoding UTF8 "crates/neuroforge-asl/src/parser/mod.rs"

Write-Host "✅ parser/mod.rs actualizado."
```

***

## Bloco 12 — Criar `schema/nfv.rs`

> 🟡 **PS normal**

Schema do ficheiro `.nfv` (NeuroForge Visual) com semver, `project_id` e cache ASL.

```powershell
@'
//! nfv.rs — Schema do ficheiro .nfv (NeuroForge Visual)
//! Versão: 4.0.0

use serde::{Deserialize, Serialize};

/// Raiz do ficheiro .nfv
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NfvFile {
    /// Versão do schema .nfv (semver, ex: "4.0.0")
    pub schema_version: String,
    /// Versão do motor ASL que gerou este ficheiro
    pub asl_version: String,
    /// Identificador único do projecto (UUID v4)
    pub project_id: String,
    /// Placa alvo (ex: "arduino-uno", "esp32-devkit", "rp2040")
    pub target_board: String,
    /// Linguagem alvo (ex: "cpp", "micropython", "rust_embassy", "st")
    pub target_language: String,
    /// Nós do editor visual
    pub nodes: Vec<FlowNode>,
    /// Arestas do editor visual
    pub edges: Vec<FlowEdge>,
    /// Cache do AslProgram serializado (para preview instantâneo, opcional)
    pub asl_cache: Option<serde_json::Value>,
    /// Metadados do projecto
    pub metadata: NfvMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NfvMetadata {
    pub name: String,
    /// ISO 8601
    pub created_at: String,
    /// ISO 8601
    pub updated_at: String,
    pub author: Option<String>,
    pub description: Option<String>,
    /// Versão da app NeuroForge que criou o ficheiro
    pub neuroforge_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowNode {
    pub id: String,
    /// "digitalWrite", "if", "timerTON", etc.
    #[serde(rename = "type")]
    pub node_type: String,
    pub position: Position,
    /// Dados específicos do nó (flexível por design)
    pub data: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    pub source_handle: Option<String>,
    pub target_handle: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

impl NfvFile {
    /// Cria um ficheiro .nfv vazio com `project_id` gerado automaticamente
    pub fn new_empty(name: &str, target_board: &str, target_language: &str) -> Self {
        let now = chrono_now();
        Self {
            schema_version: "4.0.0".into(),
            asl_version: "4.0.0".into(),
            project_id: new_uuid(),
            target_board: target_board.into(),
            target_language: target_language.into(),
            nodes: vec![],
            edges: vec![],
            asl_cache: None,
            metadata: NfvMetadata {
                name: name.into(),
                created_at: now.clone(),
                updated_at: now,
                author: None,
                description: None,
                neuroforge_version: env!("CARGO_PKG_VERSION").into(),
            },
        }
    }
}

fn new_uuid() -> String {
    uuid::Uuid::new_v4().to_string()
}

fn chrono_now() -> String {
    // ISO 8601 sem dependência de chrono — usa o formato básico
    // Em produção pode ser substituído por chrono::Utc::now().to_rfc3339()
    "2026-01-01T00:00:00Z".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_nfv_new_empty() {
        let nfv = NfvFile::new_empty("Blink", "arduino-uno", "cpp");
        assert_eq!(nfv.schema_version, "4.0.0");
        assert_eq!(nfv.target_board, "arduino-uno");
        assert!(!nfv.project_id.is_empty());
    }

    #[test]
    fn test_nfv_roundtrip_json() {
        let nfv = NfvFile::new_empty("Test", "esp32-devkit", "micropython");
        let json  = serde_json::to_string(&nfv).unwrap();
        let back: NfvFile = serde_json::from_str(&json).unwrap();
        assert_eq!(back.project_id, nfv.project_id);
        assert_eq!(back.target_language, "micropython");
    }
}
'@ | Set-Content -Encoding UTF8 "crates/neuroforge-asl/src/schema/nfv.rs"

Write-Host "✅ schema/nfv.rs criado."
```

***

## Bloco 13 — Criar `schema/migration.rs`

> 🟡 **PS normal**

Migração automática de ficheiros `.nfv` antigos para a versão actual.

```powershell
@'
//! migration.rs — migração automática de ficheiros .nfv entre versões
//! Chamado sempre que um ficheiro .nfv é carregado

use crate::schema::nfv::NfvFile;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum MigrationError {
    #[error("Versão de schema desconhecida: {0}")]
    UnknownVersion(String),
    #[error("Erro de deserialização: {0}")]
    Deserialize(#[from] serde_json::Error),
}

/// Ponto de entrada: carrega e migra um ficheiro .nfv de qualquer versão
/// suportada para a versão actual (4.x).
pub fn migrate_nfv(raw: &str) -> Result<NfvFile, MigrationError> {
    // 1. Lê apenas schema_version sem desserializar o resto
    let probe: serde_json::Value = serde_json::from_str(raw)?;
    let version = probe["schema_version"]
        .as_str()
        .unwrap_or("1.0.0");

    if version.starts_with("4.") {
        // Versão actual — desserializar directamente
        Ok(serde_json::from_str(raw)?)
    } else if version.starts_with("3.") {
        migrate_v3_to_v4(raw)
    } else if version.starts_with("2.") {
        let v3_json = migrate_v2_to_v3_raw(raw)?;
        migrate_v3_to_v4(&v3_json)
    } else if version.starts_with("1.") {
        let v2_json = migrate_v1_to_v2_raw(raw)?;
        let v3_json = migrate_v2_to_v3_raw(&v2_json)?;
        migrate_v3_to_v4(&v3_json)
    } else {
        Err(MigrationError::UnknownVersion(version.to_string()))
    }
}

// ── v3 → v4 ──────────────────────────────────────────────────────────────────
// v4 acrescenta: project_id (UUID), asl_version, metadata.neuroforge_version
fn migrate_v3_to_v4(raw: &str) -> Result<NfvFile, MigrationError> {
    let mut val: serde_json::Value = serde_json::from_str(raw)?;

    if val["project_id"].is_null() || val["project_id"].as_str().unwrap_or("").is_empty() {
        val["project_id"] = uuid::Uuid::new_v4().to_string().into();
    }
    if val["asl_version"].is_null() {
        val["asl_version"] = "4.0.0".into();
    }
    if val["metadata"]["neuroforge_version"].is_null() {
        val["metadata"]["neuroforge_version"] = env!("CARGO_PKG_VERSION").into();
    }
    val["schema_version"] = "4.0.0".into();

    Ok(serde_json::from_value(val)?)
}

// ── v2 → v3 ──────────────────────────────────────────────────────────────────
// v3 acrescenta: metadata block
fn migrate_v2_to_v3_raw(raw: &str) -> Result<String, MigrationError> {
    let mut val: serde_json::Value = serde_json::from_str(raw)?;

    if val["metadata"].is_null() {
        val["metadata"] = serde_json::json!({
            "name": val["name"].as_str().unwrap_or("Projecto sem título"),
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z",
            "neuroforge_version": "3.0.0"
        });
    }
    val["schema_version"] = "3.0.0".into();

    Ok(serde_json::to_string(&val)?)
}

// ── v1 → v2 ──────────────────────────────────────────────────────────────────
// v2 acrescenta: target_language
fn migrate_v1_to_v2_raw(raw: &str) -> Result<String, MigrationError> {
    let mut val: serde_json::Value = serde_json::from_str(raw)?;

    if val["target_language"].is_null() {
        val["target_language"] = "cpp".into(); // default histórico
    }
    val["schema_version"] = "2.0.0".into();

    Ok(serde_json::to_string(&val)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_migrate_v3_to_v4() {
        let v3 = r#"{
            "schema_version": "3.0.0",
            "asl_version": null,
            "target_board": "arduino-uno",
            "target_language": "cpp",
            "nodes": [],
            "edges": [],
            "metadata": {
                "name": "Blink",
                "created_at": "2025-01-01T00:00:00Z",
                "updated_at": "2025-01-01T00:00:00Z",
                "neuroforge_version": "3.0.0"
            }
        }"#;
        let result = migrate_nfv(v3);
        assert!(result.is_ok());
        let nfv = result.unwrap();
        assert_eq!(nfv.schema_version, "4.0.0");
        assert!(!nfv.project_id.is_empty());
    }

    #[test]
    fn test_migrate_v4_passthrough() {
        let v4 = r#"{
            "schema_version": "4.0.0",
            "asl_version": "4.0.0",
            "project_id": "test-uuid-1234",
            "target_board": "esp32-devkit",
            "target_language": "micropython",
            "nodes": [],
            "edges": [],
            "metadata": {
                "name": "Teste",
                "created_at": "2026-01-01T00:00:00Z",
                "updated_at": "2026-01-01T00:00:00Z",
                "neuroforge_version": "4.0.0"
            }
        }"#;
        let result = migrate_nfv(v4);
        assert!(result.is_ok());
        assert_eq!(result.unwrap().project_id, "test-uuid-1234");
    }

    #[test]
    fn test_unknown_version_errors() {
        let unknown = r#"{"schema_version": "99.0.0", "nodes": [], "edges": []}"#;
        assert!(migrate_nfv(unknown).is_err());
    }
}
'@ | Set-Content -Encoding UTF8 "crates/neuroforge-asl/src/schema/migration.rs"

Write-Host "✅ schema/migration.rs criado."
```

Actualizar `schema/mod.rs`:

```powershell
@'
pub mod nfv;
pub mod migration;

pub use nfv::{NfvFile, NfvMetadata, FlowNode, FlowEdge, Position};
pub use migration::migrate_nfv;
'@ | Set-Content -Encoding UTF8 "crates/neuroforge-asl/src/schema/mod.rs"

Write-Host "✅ schema/mod.rs actualizado."
```

***

## Bloco 14 — Verificação final `cargo check` + `cargo test`

> 🟡 **PS normal**

```powershell
cd D:\Documents\NeuroForge\neuroforge

# Verificar compilação completa
cargo check -p neuroforge-asl

# Correr todos os testes unitários dos novos módulos
cargo test -p neuroforge-asl -- --nocapture 2>&1 | Select-String -Pattern "test |FAILED|error"

# Verificar que ainda compila para WASM
cargo check -p neuroforge-asl --target wasm32-unknown-unknown
```

**✅ Esperado:**

```
test transforms::postfix_utils::tests::test_extract_postfix_inc ... ok
test transforms::postfix_utils::tests::test_extract_postfix_dec ... ok
test transforms::postfix_utils::tests::test_passthrough_literal  ... ok
test transforms::code_to_asl::tests::test_empty_program_produces_valid_asl ... ok
test parser::language_registry::tests::test_cpp_registered ... ok
test parser::language_registry::tests::test_asl_supported_languages ... ok
test parser::tree_sitter_loader::tests::test_cpp_ts_available ... ok
test schema::nfv::tests::test_nfv_new_empty ... ok
test schema::nfv::tests::test_nfv_roundtrip_json ... ok
test schema::migration::tests::test_migrate_v3_to_v4 ... ok
test schema::migration::tests::test_migrate_v4_passthrough ... ok
test schema::migration::tests::test_unknown_version_errors ... ok
```

Zero erros. Warnings de `unused_*` são normais — haverão mais nas próximas fases.

***

## Bloco 15 — Commit da Fase 1B

> 🟡 **PS normal**

```powershell
cd D:\Documents\NeuroForge\neuroforge

git add crates/neuroforge-asl/Cargo.toml
git add crates/neuroforge-asl/src/types/asl_plc_types.rs
git add crates/neuroforge-asl/src/types/mod.rs
git add crates/neuroforge-asl/src/transforms/postfix_utils.rs
git add crates/neuroforge-asl/src/transforms/expr_transform.rs
git add crates/neuroforge-asl/src/transforms/call_transform.rs
git add crates/neuroforge-asl/src/transforms/block_transform.rs
git add crates/neuroforge-asl/src/transforms/statement_registry.rs
git add crates/neuroforge-asl/src/transforms/code_to_asl.rs
git add crates/neuroforge-asl/src/transforms/mod.rs
git add crates/neuroforge-asl/src/parser/language_registry.rs
git add crates/neuroforge-asl/src/parser/tree_sitter_loader.rs
git add crates/neuroforge-asl/src/parser/mod.rs
git add crates/neuroforge-asl/src/schema/nfv.rs
git add crates/neuroforge-asl/src/schema/migration.rs
git add crates/neuroforge-asl/src/schema/mod.rs

git status

git commit -m "feat(asl): Fase 1B — transforms pipeline, schema .nfv, parser registry e types PLC

Transforms (Pipeline 1 — ProgramNode → AslProgram):
- transforms/postfix_utils.rs    — extracção de side-effects i++/i--
- transforms/expr_transform.rs   — ExprNode → AslExpr (todos os operadores)
- transforms/call_transform.rs   — CallNode → AslStatement de hardware (GPIO, Serial, I2C, SPI, PWM, Servo, RGB)
- transforms/block_transform.rs  — BlockNode → AslStatement (if/while/for/doWhile/forIn/switch/break/continue)
- transforms/statement_registry.rs — registry central ProgramNode → AslProgram
- transforms/code_to_asl.rs      — entry point público: ast_to_asl(ProgramNode, Language) → AslProgram
- transforms/mod.rs              — actualizado com todos os módulos + re-exports

Types PLC:
- types/asl_plc_types.rs         — AslPlcProgram, AslRung, AslContact, AslCoil, AslTimerTON/TOF/TP,
                                    AslCounterCTU/CTD, AslLatchSR/RS, AslFbCall, AslFbdBlock, AslSfcStep
- types/mod.rs                   — actualizado com asl_plc_types

Parser Registry:
- parser/language_registry.rs    — LanguageRegistry com metadata (9 linguagens)
- parser/tree_sitter_loader.rs   — get_ts_language() por id de linguagem
- parser/mod.rs                  — actualizado

Schema .nfv:
- schema/nfv.rs                  — NfvFile, NfvMetadata, FlowNode, FlowEdge com semver + UUID
- schema/migration.rs            — migrate_nfv() com suporte v1→v2→v3→v4
- schema/mod.rs                  — actualizado

Cargo.toml:
- Adicionadas: semver, uuid, roxmltree, tokio (optional/feature-flagged)
- Feature flags: default=[native], native=[tokio] — WASM não puxa tokio"

git push origin preRust
```

***

## Ordem de execução resumida

| Bloco | Acção                                                                 | Verifica                          |
| :---- | :-------------------------------------------------------------------- | :-------------------------------- |
| 1     | Actualizar `Cargo.toml` (semver, uuid, roxmltree, tokio feature-flag) | `cargo check -p neuroforge-asl`   |
| 2     | `types/asl_plc_types.rs` + `types/mod.rs`                             | `cargo check -p neuroforge-asl`   |
| 3     | `transforms/postfix_utils.rs`                                         | —                                 |
| 4     | `transforms/expr_transform.rs`                                        | —                                 |
| 5     | `transforms/call_transform.rs`                                        | —                                 |
| 6     | `transforms/block_transform.rs`                                       | —                                 |
| 7     | `transforms/statement_registry.rs`                                    | —                                 |
| 8     | `transforms/code_to_asl.rs`                                           | —                                 |
| 9     | `transforms/mod.rs` (actualizar)                                      | `cargo check -p neuroforge-asl` ✅ |
| 10    | `parser/language_registry.rs`                                         | —                                 |
| 11    | `parser/tree_sitter_loader.rs` + `parser/mod.rs`                      | —                                 |
| 12    | `schema/nfv.rs`                                                       | —                                 |
| 13    | `schema/migration.rs` + `schema/mod.rs`                               | —                                 |
| 14    | `cargo check` + `cargo test` + WASM check                             | ✅ Zero erros                      |
| 15    | Commit e push                                                         | `preRust` actualizado             |

> ⚠️ **Nota sobre `statement_registry.rs` e `expr_transform.rs`:** Os tipos `AslExpr::PostfixInc`, `AslExpr::PostfixDec`, `AslStatement::*` referenciados nestes ficheiros devem já existir em `types/asl_types.rs`. Se o `cargo check` reportar `variant not found`, significa que falta adicionar esses variants ao enum — reporta os erros exactos e corrigimos antes do commit.

> ⚠️ **`flow/` não está nesta fase** — `flow_validator.rs`, `cfg_builder.rs`, `flow_to_ast.rs` e `flow_to_asl.rs` são a Fase 2 do [docs\Plano-Migracao-NeuroForge-v4.2.md](Plano-Migracao-NeuroForge-v4.2.md) (dependem do SvelteFlow e dos tipos de nós do editor). O `flow/mod.rs` fica como placeholder.
```

***

Está pronto para fazer commit directamente em `docs/guiaFase1B_Rust.md`. Depois de fazeres o commit do guia, começas pelo **Bloco 1** e reportas o output do `cargo check` — há uma boa probabilidade de o `statement_registry.rs` e `expr_transform.rs` precisarem de pequenos ajustes nos variants de `AslExpr`/`AslStatement` conforme o que já está definido no teu `asl_types.rs`.