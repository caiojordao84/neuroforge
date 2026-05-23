//! Core types module for ASL: AslProgram, AslStatement, types, operators
//!
//! This module contains the root program structure and all statement types
//! that make up the ASL AST.

pub mod operators;
pub mod program;
pub mod types;
pub mod ladder_types;

// Re-export ALL types at the module level for convenient access
pub use operators::*;
pub use program::*;
pub use types::*;
pub use ladder_types::*;

// ============================================================================
// Phase B.2 Master Document (TOON File)
// ============================================================================

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslTimer {
    pub timer_type: String, // "TON" or "TOF"
    pub preset_ms: u32,
    pub on_done_callback: Option<String>,
}

/// The absolute root of the Abstract Simulation Layer IR (TOON format).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslToonProgram {
    /// Dependency Injection: The hardware interface
    pub hardware_map: HashMap<u8, crate::asl_types::board::pin_map::LogicalPin>,
    
    /// Global Constants (from `data:`)
    pub constants: HashMap<String, crate::asl_types::core::types::AslVariable>,
    
    /// Global Mutable State (from `state:`)
    pub state_memory: HashMap<String, crate::asl_types::core::types::AslVariable>,
    
    /// Native IEC 61131-3 Timers (from `timers:`)
    pub timers: HashMap<String, AslTimer>,
    
    /// The parsed logic blocks
    pub routines: Vec<crate::asl_types::core::program::AslRoutine>,
}

impl AslToonProgram {
    /// Validates that all hardware calls in the routines reference valid pins
    /// in the hardware_map. (Implementation in B.2 validation phase).
    pub fn validate_hardware_bindings(&self) -> Result<(), String> {
        for routine in &self.routines {
            for statement in &routine.body {
                match statement {
                    crate::asl_types::core::program::AslStatement::DigitalOutput(out) => {
                        if let crate::asl_types::core::types::AslExpr::Literal(lit) = &out.pin {
                            if let Some(pin_val) = lit.value.as_u64() {
                                if !self.hardware_map.contains_key(&(pin_val as u8)) {
                                    return Err(format!("Hardware Error: Reference to undeclared pin {}", pin_val));
                                }
                            }
                        }
                    }
                    crate::asl_types::core::program::AslStatement::DigitalInput(inp) => {
                        if let crate::asl_types::core::types::AslExpr::Literal(lit) = &inp.pin {
                            if let Some(pin_val) = lit.value.as_u64() {
                                if !self.hardware_map.contains_key(&(pin_val as u8)) {
                                    return Err(format!("Hardware Error: Reference to undeclared pin {}", pin_val));
                                }
                            }
                        }
                    }
                    crate::asl_types::core::program::AslStatement::AnalogOutput(out) => {
                        if let crate::asl_types::core::types::AslExpr::Literal(lit) = &out.pin {
                            if let Some(pin_val) = lit.value.as_u64() {
                                if !self.hardware_map.contains_key(&(pin_val as u8)) {
                                    return Err(format!("Hardware Error: Reference to undeclared pin {}", pin_val));
                                }
                            }
                        }
                    }
                    crate::asl_types::core::program::AslStatement::AnalogInput(inp) => {
                        if let crate::asl_types::core::types::AslExpr::Literal(lit) = &inp.pin {
                            if let Some(pin_val) = lit.value.as_u64() {
                                if !self.hardware_map.contains_key(&(pin_val as u8)) {
                                    return Err(format!("Hardware Error: Reference to undeclared pin {}", pin_val));
                                }
                            }
                        }
                    }
                    _ => {}
                }
            }
        }
        Ok(())
    }

    pub fn validate_routine_calls(&self) -> Result<(), String> {
        let defined_routines: std::collections::HashSet<&str> = self.routines
            .iter()
            .map(|r| r.name.as_str())
            .collect();

        for routine in &self.routines {
            for statement in &routine.body {
                if let crate::asl_types::core::program::AslStatement::Expr(expr_stmt) = statement {
                    if let crate::asl_types::core::types::AslExpr::Call(call) = &expr_stmt.expr {
                        if !defined_routines.contains(call.callee.as_str()) {
                            let is_variable = self.constants.contains_key(&call.callee) || self.state_memory.contains_key(&call.callee);
                            if !is_variable {
                                let is_primitive = matches!(
                                    call.callee.as_str(),
                                    "delay" | "digitalWrite" | "digitalRead" | "pwmWrite" | "readADC" | "currentTime" | "initI2C" | "initLCD" | "initOLED" | "initSPI" | "initTFT" | "pinMode" |
                                    "pwmFreq" | "lcdPrint" | "lcdClear" | "readDistanceCM" | "max" | "min" | "int" | "string" | "repeat" | "millis" | "micros" | "analogRead" | "random" | "map" | "constrain" |
                                    "attachInterrupt" | "pulseIn" | "shiftOut" | "tone" | "noTone"
                                );
                                if !is_primitive {
                                    return Err(format!("Linker Error: Call to undefined routine '{}'", call.callee));
                                }
                            }
                        }
                    }
                }
            }
        }
        
        Ok(())
    }
}

impl From<AslToonProgram> for AslProgram {
    fn from(toon: AslToonProgram) -> Self {
        let mut globals = Vec::new();
        
        for (name, var) in toon.constants {
            let expr = if let Ok(val_i) = var.initial_value.parse::<i64>() {
                AslExpr::int(val_i)
            } else if let Ok(val_f) = var.initial_value.parse::<f64>() {
                AslExpr::float(val_f)
            } else if var.initial_value == "True" || var.initial_value == "true" {
                AslExpr::bool_val(true)
            } else if var.initial_value == "False" || var.initial_value == "false" {
                AslExpr::bool_val(false)
            } else {
                let clean = var.initial_value.trim_matches('"').trim_matches('\'');
                AslExpr::str_val(clean)
            };
            
            globals.push(AslGlobalVar {
                name,
                r#type: var.inferred_type,
                value: Some(expr),
                struct_type: None,
                mutable: false,
                scope: "const".to_string(),
                lifecycle: "normal".to_string(),
                comments: None,
            });
        }
        
        for (name, var) in toon.state_memory {
            let expr = if let Ok(val_i) = var.initial_value.parse::<i64>() {
                AslExpr::int(val_i)
            } else if let Ok(val_f) = var.initial_value.parse::<f64>() {
                AslExpr::float(val_f)
            } else if var.initial_value == "True" || var.initial_value == "true" {
                AslExpr::bool_val(true)
            } else if var.initial_value == "False" || var.initial_value == "false" {
                AslExpr::bool_val(false)
            } else {
                let clean = var.initial_value.trim_matches('"').trim_matches('\'');
                AslExpr::str_val(clean)
            };
            
            globals.push(AslGlobalVar {
                name,
                r#type: var.inferred_type,
                value: Some(expr),
                struct_type: None,
                mutable: true,
                scope: "global".to_string(),
                lifecycle: "normal".to_string(),
                comments: None,
            });
        }
        
        let mut tasks = Vec::new();
        let mut functions = Vec::new();
        
        for routine in toon.routines {
            if routine.name == "setup" || routine.name == "loop" {
                tasks.push(AslTask {
                    name: routine.name.clone(),
                    is_async: false,
                    priority: None,
                    stack_size: None,
                    params: Vec::new(),
                    return_type: "void".to_string(),
                    body: routine.body,
                });
            } else {
                functions.push(AslFunction {
                    name: routine.name,
                    doc: None,
                    params: Vec::new(),
                    body: routine.body,
                    return_type: Some(AslType::Void),
                    attributes: Vec::new(),
                    is_async: false,
                });
            }
        }
        
        AslProgram {
            asl_version: "4.0.0".to_string(),
            metadata: AslMetadata::default(),
            includes: Vec::new(),
            structs: Vec::new(),
            enums: Vec::new(),
            globals,
            functions,
            function_blocks: Vec::new(),
            tasks,
        }
    }
}
