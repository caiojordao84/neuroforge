//! call_transform.rs — transforma chamadas de função em nós ASL de hardware
//! Migrado de: src/engine/asl/transforms/callTransform.ts

use crate::transforms::context::TransformContext;
use crate::transforms::expr_transform::transform_expr;
use crate::types::asl_types::*;
use crate::types::typed_nodes::CallNode;

/// Resultado de transformar uma chamada de função.
/// Pode produzir um AslStatement (hardware call) ou nada (chamada desconhecida).
pub fn transform_call(call: &CallNode, ctx: &TransformContext) -> Option<AslStatement> {
    let args: Vec<AslExpr> = call.args.iter().map(|a| transform_expr(a, ctx)).collect();

    match call.name.as_str() {
        // ── GPIO ─────────────────────────────────────────────────────────────
        "pinMode" => {
            let pin = args.first().cloned().unwrap_or(AslExpr::int(0));
            let mode_arg = call.args.get(1);
            let is_output = match mode_arg {
                Some(arg) => match &arg.kind {
                    crate::types::typed_nodes::ExprKind::StringLiteral(s) => s == "OUTPUT",
                    crate::types::typed_nodes::ExprKind::Identifier(s) => s == "OUTPUT",
                    _ => false,
                },
                None => true,
            };
            let mode = if is_output {
                PinModeKind::Output
            } else {
                PinModeKind::Input
            };
            Some(AslStatement::PinMode(AslPinMode { pin, mode }))
        }
        "digitalWrite" => {
            let pin = args.first().cloned().unwrap_or(AslExpr::int(0));
            // Check if arg is HIGH/LOW/1/0
            let value_arg = call.args.get(1);
            let value = match value_arg {
                Some(arg) => match &arg.kind {
                    crate::types::typed_nodes::ExprKind::Identifier(s) => {
                        if s == "HIGH" { DigitalValue::High }
                        else if s == "LOW" { DigitalValue::Low }
                        else { DigitalValue::Expr(args.get(1).cloned().unwrap_or(AslExpr::int(0))) }
                    },
                    crate::types::typed_nodes::ExprKind::IntLiteral(n) => {
                        if *n > 0 { DigitalValue::High }
                        else { DigitalValue::Low }
                    },
                    _ => DigitalValue::Expr(args.get(1).cloned().unwrap_or(AslExpr::int(0))),
                },
                None => DigitalValue::Low,
            };
            Some(AslStatement::DigitalWrite(AslDigitalWrite { pin, value }))
        }
        "analogWrite" => {
            let pin = args.first().cloned().unwrap_or(AslExpr::int(0));
            let value = args.get(1).cloned().unwrap_or(AslExpr::int(0));
            Some(AslStatement::AnalogWrite(AslAnalogWrite { pin, value }))
        }
        "digitalRead" | "analogRead" => {
            let pin = args.first().cloned().unwrap_or(AslExpr::int(0));
            let mode = if call.name == "analogRead" {
                ReadMode::Analog
            } else {
                ReadMode::Digital
            };
            let result = call.result_var.clone().unwrap_or_default();
            Some(AslStatement::Read(AslRead {
                pin,
                mode,
                target: result,
            }))
        }

        // ── Serial ───────────────────────────────────────────────────────────
        "Serial.begin" | "serialBegin" => {
            let baud = args.first().cloned().unwrap_or(AslExpr::int(9600));
            Some(AslStatement::SerialBegin(AslSerialBegin { baud }))
        }
        "Serial.print" | "Serial.println" | "print" => {
            let value = args.first().cloned().unwrap_or(AslExpr::str_val(""));
            let newline = call.name.ends_with("println");
            Some(AslStatement::Print(AslPrint {
                args: vec![value],
                newline,
            }))
        }

        // ── Timing ───────────────────────────────────────────────────────────
        "delay" => {
            let ms = args.first().cloned().unwrap_or(AslExpr::int(0));
            Some(AslStatement::Delay(AslDelay { milliseconds: ms }))
        }
        "delayMicroseconds" => {
            let us = args.first().cloned().unwrap_or(AslExpr::int(0));
            Some(AslStatement::Delay(AslDelay { milliseconds: us }))
        }

        // ── Servo ────────────────────────────────────────────────────────────
        "servo.attach" | "servoAttach" => {
            let pin = args.first().cloned().unwrap_or(AslExpr::int(0));
            let name = call.object.clone().unwrap_or_else(|| "servo".into());
            Some(AslStatement::ServoAttach(AslServoAttach {
                var_name: name,
                pin,
                min_pulse: None,
                max_pulse: None,
                continuous: None,
            }))
        }
        "servo.write" | "servoWrite" => {
            let angle = args.first().cloned().unwrap_or(AslExpr::int(0));
            let name = call.object.clone().unwrap_or_else(|| "servo".into());
            Some(AslStatement::ServoWrite(AslServoWrite {
                var_name: name,
                angle,
                raw_microseconds: None,
            }))
        }
        "servo.detach" | "servoDetach" => {
            let name = call.object.clone().unwrap_or_else(|| "servo".into());
            Some(AslStatement::ServoDetach(AslServoDetach { var_name: name }))
        }

        // ── I2C ──────────────────────────────────────────────────────────────
        "Wire.write" | "i2cWrite" => {
            let addr = args.first().cloned().unwrap_or(AslExpr::int(0));
            let value = args.get(1).cloned().unwrap_or(AslExpr::int(0));
            Some(AslStatement::I2cWrite(AslI2cWrite {
                bus: AslExpr::int(0),
                address: addr,
                data: value,
            }))
        }
        "Wire.read" | "i2cRead" => {
            let addr = args.first().cloned().unwrap_or(AslExpr::int(0));
            let result = call.result_var.clone().unwrap_or_default();
            Some(AslStatement::I2cRead(AslI2cRead {
                bus: AslExpr::int(0),
                address: addr,
                target: result,
                length: AslExpr::int(1),
            }))
        }

        // ── SPI ──────────────────────────────────────────────────────────────
        "SPI.transfer" | "spiTransfer" => {
            let value = args.first().cloned().unwrap_or(AslExpr::int(0));
            let result = call.result_var.clone().unwrap_or_default();
            Some(AslStatement::SpiTransfer(AslSpiTransfer {
                bus: AslExpr::int(0),
                cs_pin: AslExpr::int(0),
                tx_data: value,
                target: Some(result),
            }))
        }

        // ── PWM ──────────────────────────────────────────────────────────────
        "pwmInit" => {
            let pin = args.first().cloned().unwrap_or(AslExpr::int(0));
            let freq = args.get(1).cloned().unwrap_or(AslExpr::int(1000));
            Some(AslStatement::PwmInit(AslPwmInit {
                pin,
                freq,
                duty: AslExpr::int(0),
            }))
        }
        "pwmSetDuty" => {
            let pin = args.first().cloned().unwrap_or(AslExpr::int(0));
            let duty = args.get(1).cloned().unwrap_or(AslExpr::int(0));
            Some(AslStatement::PwmSetDuty(AslPwmSetDuty { pin, duty }))
        }

        // ── RGB ──────────────────────────────────────────────────────────────
        "rgbSet" => {
            let pin = args.first().cloned().unwrap_or(AslExpr::int(0));
            let r = args.get(1).cloned().unwrap_or(AslExpr::int(0));
            let g = args.get(2).cloned().unwrap_or(AslExpr::int(0));
            let _b = args.get(3).cloned().unwrap_or(AslExpr::int(0));
            Some(AslStatement::RgbSet(AslRgbSet {
                pin_r: pin,
                pin_g: r,
                pin_b: g,
                r: AslExpr::int(0),
                g: AslExpr::int(0),
                b: AslExpr::int(0),
            }))
        }

        // ── Chamada genérica (função de utilizador) ──────────────────────────
        _ => Some(AslStatement::Expr(AslExpressionStmt {
            expr: AslExpr::Call(Box::new(AslCall {
                callee: call.name.clone(),
                args,
            })),
        })),
    }
}
