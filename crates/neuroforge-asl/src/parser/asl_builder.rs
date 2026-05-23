use pest::iterators::Pair;
use std::collections::HashMap;
use super::asl_parser::Rule;
use crate::asl_types::core::types::{AslType, AslVariable, AslExpr};
use crate::asl_types::core::program::{AslRoutine, AslStatement};
use crate::asl_types::core::{AslToonProgram, AslTimer};
use crate::asl_types::board::pin_map::LogicalPin;

pub struct AslBuilder;

impl AslBuilder {
    /// Hydrates the full ASL AST from the root Pest rule
    pub fn build_program(document_pair: Pair<Rule>) -> Result<AslToonProgram, String> {
        let mut program = AslToonProgram {
            hardware_map: HashMap::new(),
            constants: HashMap::new(),
            state_memory: HashMap::new(),
            timers: HashMap::new(),
            routines: Vec::new(),
        };

        for block in document_pair.into_inner() {
            match block.as_rule() {
                Rule::hardware_block => {
                    program.hardware_map = Self::build_hardware(block)?;
                }
                Rule::data_block => {
                    program.constants = Self::build_memory(block, true)?;
                }
                Rule::state_block => {
                    program.state_memory = Self::build_memory(block, false)?;
                }
                Rule::timers_block => {
                    program.timers = Self::build_timers(block)?;
                }
                Rule::routines_block => {
                    program.routines = Self::build_routines(block)?;
                }
                Rule::EOI | Rule::metadata_block => { /* Ignore metadata in AST */ }
                _ => return Err(format!("Unexpected top-level block: {:?}", block.as_rule())),
            }
        }

        // Global Semantic Validation pass (as agreed in Socratic resolution)
        program.validate_hardware_bindings()?;
        program.validate_routine_calls()?;

        Ok(program)
    }

    fn build_hardware(pair: Pair<Rule>) -> Result<HashMap<u8, LogicalPin>, String> {
        let mut map = HashMap::new();
        for entry in pair.into_inner() {
            if entry.as_rule() == Rule::hw_entry {
                let mut inner = entry.into_inner();
                let pin_str = inner.next().unwrap().as_str().trim();
                let pin_id = pin_str.parse::<u8>().map_err(|_| format!("Invalid pin ID: {}", pin_str))?;
                
                let pin_type = inner.next().unwrap().as_str().trim().to_string();
                let io_mode = inner.next().unwrap().as_str().trim().to_string();
                let _label = inner.next().unwrap().as_str().trim().trim_matches('"').trim().to_string();
                let role = inner.next().unwrap().as_str().trim().trim_matches('"').trim().to_string();
                
                let logical_pin = LogicalPin {
                    name: role,
                    physical_name: pin_str.to_string(),
                    default_mode: Some(io_mode),
                    restrictions: None,
                    signal_type: Some(pin_type),
                };
                map.insert(pin_id, logical_pin);
            }
        }
        Ok(map)
    }

    fn build_memory(pair: Pair<Rule>, is_constant: bool) -> Result<HashMap<String, AslVariable>, String> {
        let mut map = HashMap::new();
        for entry in pair.into_inner() {
            if entry.as_rule() == Rule::var_entry {
                let mut inner = entry.into_inner();
                let name = inner.next().unwrap().as_str().to_string();
                let value_str = inner.next().unwrap().as_str().trim().to_string();
                
                let var = AslVariable {
                    name: name.clone(),
                    inferred_type: AslVariable::infer_from_literal(&value_str),
                    initial_value: value_str,
                    is_constant,
                };
                map.insert(name, var);
            }
        }
        Ok(map)
    }

    fn build_timers(pair: Pair<Rule>) -> Result<HashMap<String, AslTimer>, String> {
        let mut map = HashMap::new();
        for entry in pair.into_inner() {
            if entry.as_rule() == Rule::timer_entry {
                let mut inner = entry.into_inner();
                let name = inner.next().unwrap().as_str().to_string();
                let timer_body = inner.next().unwrap().as_str().trim();
                
                let timer_body = timer_body.trim_start_matches('{').trim_end_matches('}').trim();
                
                let mut timer_type = "TON".to_string();
                let mut preset_ms = 0;
                let mut on_done_callback = None;
                
                for part in timer_body.split(',') {
                    let kv: Vec<&str> = part.split(':').collect();
                    if kv.len() == 2 {
                        let k = kv[0].trim();
                        let v = kv[1].trim();
                        if k == "type" {
                            timer_type = v.to_string();
                        } else if k == "preset" {
                            let val_str: String = v.chars().filter(|c| c.is_digit(10)).collect();
                            preset_ms = val_str.parse::<u32>().unwrap_or(0);
                        } else if k == "on_done" {
                            on_done_callback = Some(v.trim_end_matches("()").to_string());
                        }
                    }
                }
                
                let timer = AslTimer {
                    timer_type,
                    preset_ms,
                    on_done_callback,
                };
                map.insert(name, timer);
            }
        }
        Ok(map)
    }

    fn build_routines(pair: Pair<Rule>) -> Result<Vec<AslRoutine>, String> {
        let mut routines = Vec::new();
        for entry in pair.into_inner() {
            if entry.as_rule() == Rule::routine_def {
                let mut inner = entry.into_inner();
                let name = inner.next().unwrap().as_str().to_string();
                
                let mut arguments = Vec::new();
                let mut cycle_time_ms = 0;
                let mut body = Vec::new();
                
                while let Some(next_pair) = inner.next() {
                    match next_pair.as_rule() {
                        Rule::routine_args => {
                            for arg in next_pair.into_inner() {
                                let arg_name = arg.as_str().to_string();
                                arguments.push(AslVariable {
                                    name: arg_name,
                                    inferred_type: AslType::Auto,
                                    initial_value: "".to_string(),
                                    is_constant: false,
                                });
                            }
                        }
                        Rule::routine_decorator => {
                            let dec_str = next_pair.into_inner().next().unwrap().as_str();
                            cycle_time_ms = dec_str.parse::<u32>().unwrap_or(0);
                        }
                        Rule::routine_body => {
                            for stmt in next_pair.into_inner() {
                                if stmt.as_rule() == Rule::statement {
                                    let stmt_str = stmt.as_str().trim_start_matches('-').trim();
                                    if stmt_str.contains('=') {
                                        let parts: Vec<&str> = stmt_str.splitn(2, '=').collect();
                                        let target = parts[0].trim().to_string();
                                        let rhs = parts[1].trim();
                                        let val_expr = if rhs.contains('(') && rhs.contains(')') {
                                            let call_parts: Vec<&str> = rhs.splitn(2, '(').collect();
                                            let callee = call_parts[0].trim().to_string();
                                            let args_str = call_parts[1].trim_end_matches(')');
                                            let mut args = Vec::new();
                                            for arg in args_str.split(',') {
                                                let arg = arg.trim();
                                                if !arg.is_empty() {
                                                    if let Ok(num) = arg.parse::<i64>() {
                                                        args.push(AslExpr::int(num));
                                                    } else {
                                                        args.push(AslExpr::var(arg));
                                                    }
                                                }
                                            }
                                            AslExpr::Call(Box::new(crate::asl_types::core::types::AslCall {
                                                callee,
                                                args,
                                            }))
                                        } else if let Ok(num) = rhs.parse::<i64>() {
                                            AslExpr::int(num)
                                        } else if let Ok(flt) = rhs.parse::<f64>() {
                                            AslExpr::float(flt)
                                        } else if rhs == "true" || rhs == "false" {
                                            AslExpr::bool_val(rhs == "true")
                                        } else {
                                            AslExpr::var(rhs)
                                        };
                                        body.push(AslStatement::Assign(crate::asl_types::core::program::AslAssign {
                                            target,
                                            value: val_expr,
                                        }));
                                    } else if stmt_str.contains('(') && stmt_str.contains(')')
                                         && !stmt_str.trim().starts_with("if ")
                                         && !stmt_str.trim().starts_with("while ")
                                         && !stmt_str.trim().starts_with("for ")
                                         && !stmt_str.trim().starts_with("repeat")
                                         && !stmt_str.trim().starts_with("else")
                                    {
                                        let call_parts: Vec<&str> = stmt_str.splitn(2, '(').collect();
                                        let callee = call_parts[0].trim();
                                        let args_str = call_parts[1].trim_end_matches(')');
                                        let mut args = Vec::new();
                                        for arg in args_str.split(',') {
                                            let arg = arg.trim();
                                            if !arg.is_empty() {
                                                if let Ok(num) = arg.parse::<i64>() {
                                                    args.push(AslExpr::int(num));
                                                } else {
                                                    args.push(AslExpr::var(arg));
                                                }
                                            }
                                        }
                                        
                                        if callee == "return" {
                                            body.push(AslStatement::Return(crate::asl_types::core::program::AslReturn {
                                                value: args.first().cloned(),
                                            }));
                                        } else if callee == "digitalWrite" && args.len() == 2 {
                                            body.push(AslStatement::DigitalOutput(crate::asl_types::core::program::AslDigitalOutput {
                                                pin: args[0].clone(),
                                                value: args[1].clone(),
                                            }));
                                        } else if callee == "pwmWrite" && args.len() == 2 {
                                            body.push(AslStatement::AnalogOutput(crate::asl_types::core::program::AslAnalogOutput {
                                                pin: args[0].clone(),
                                                value: args[1].clone(),
                                            }));
                                        } else if callee == "pinMode" && args.len() == 2 {
                                            let mode_str = match args[1].as_var().map(|v| v.name.as_str()) {
                                                Some("INPUT") => crate::asl_types::core::program::PinModeKind::Input,
                                                Some("OUTPUT") => crate::asl_types::core::program::PinModeKind::Output,
                                                Some("INPUT_PULLUP") => crate::asl_types::core::program::PinModeKind::InputPullup,
                                                Some("INPUT_PULLDOWN") => crate::asl_types::core::program::PinModeKind::InputPulldown,
                                                _ => crate::asl_types::core::program::PinModeKind::Input,
                                            };
                                            body.push(AslStatement::PinMode(crate::asl_types::core::program::AslPinMode {
                                                pin: args[0].clone(),
                                                mode: mode_str,
                                            }));
                                        } else if callee == "delay" && args.len() == 1 {
                                            let ms = if let Some(lit) = args[0].as_literal() {
                                                lit.value.as_u64().unwrap_or(0)
                                            } else {
                                                0
                                            };
                                            body.push(AslStatement::Delay(crate::asl_types::core::program::AslDelay {
                                                duration: crate::asl_types::core::program::AslDuration::from_ms(ms),
                                            }));
                                        } else {
                                            body.push(AslStatement::Expr(crate::asl_types::core::program::AslExpressionStmt {
                                                expr: AslExpr::Call(Box::new(crate::asl_types::core::types::AslCall {
                                                    callee: callee.to_string(),
                                                    args,
                                                })),
                                            }));
                                        }
                                    } else {
                                        body.push(AslStatement::Expr(crate::asl_types::core::program::AslExpressionStmt {
                                            expr: AslExpr::var(stmt_str),
                                        }));
                                    }
                                }
                            }
                        }
                        _ => {}
                    }
                }
                
                let routine = AslRoutine {
                    name,
                    arguments,
                    return_type: AslType::Void,
                    cycle_time_ms,
                    body,
                };
                routines.push(routine);
            }
        }
        Ok(routines)
    }
}
