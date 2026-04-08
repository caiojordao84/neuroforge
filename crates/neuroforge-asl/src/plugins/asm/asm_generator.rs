//! Assembly code generator.
//!
//! Generates assembly code for various embedded architectures.
//!
//! Supported targets:
//!   - AVR (ATmega, ATtiny) - Arduino, bare metal
//!   - ARM (Thumb, ARMv7-M) - STM32, LPC
//!   - RISC-V (RV32I) - ESP32, SiFive
//!
//! ASL -> Assembly mapping:
//!   AslFunction       .global name / name:
//!   If               cmp / beq / bne / ble / bgt
//!   While            loop: ... cmp ... bne loop
//!   For              subi / brne
//!   Return           ret / reti
//!   Break            rjmp / jmp
//!   Assign           mov / ldi / in / out
//!   Declare          .byte / .space
//!   Delay            loop with nop
//!   Print            uart putchar (target specific)
//!   PinMode          DDR write
//!   DigitalWrite     PORT write
//!   DigitalRead      PIN read

use crate::types::asl_types::{AslExpr, AslFunction, AslProgram, AslStatement, PinModeKind};

use crate::plugins::core::{AslGenerator, GeneratorOutput};

/// Target architecture for assembly generation
#[derive(Debug, Clone, Default)]
pub enum AsmArch {
    #[default]
    Avr, // AVR 8-bit (ATmega, ATtiny)
    Arm,   // ARM Thumb (STM32, NXP)
    RiscV, // RISC-V RV32I (ESP32, SiFive)
}

impl AsmArch {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "arm" | "thumb" | "cortex-m" => AsmArch::Arm,
            "riscv" | "rv32i" | "rv32" => AsmArch::RiscV,
            _ => AsmArch::Avr,
        }
    }
}

/// Assembly code generator with configurable target architecture.
pub struct AsmGenerator {
    arch: AsmArch,
    indent_size: usize,
    label_counter: usize,
    uses_gpio: bool,
    uses_uart: bool,
    uses_i2c: bool,
    uses_spi: bool,
    uses_pwm: bool,
    uses_time: bool,
}

impl Default for AsmGenerator {
    fn default() -> Self {
        Self {
            arch: AsmArch::Avr,
            indent_size: 4,
            label_counter: 0,
            uses_gpio: false,
            uses_uart: false,
            uses_i2c: false,
            uses_spi: false,
            uses_pwm: false,
            uses_time: false,
        }
    }
}

impl AsmGenerator {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_arch(arch: AsmArch) -> Self {
        Self {
            arch,
            ..Default::default()
        }
    }

    pub fn set_arch(&mut self, arch: AsmArch) {
        self.arch = arch;
    }

    fn next_label(&mut self, prefix: &str) -> String {
        self.label_counter += 1;
        format!("{}_{}", prefix, self.label_counter)
    }
}

impl AslGenerator for AsmGenerator {
    fn generate(&mut self, program: &AslProgram) -> GeneratorOutput {
        let mut out = String::new();

        let stringified = serde_json::to_string(program).unwrap_or_default();

        // Detect required features
        self.uses_gpio = stringified.contains("\"pinMode\"")
            || stringified.contains("\"digitalWrite\"")
            || stringified.contains("\"digitalRead\"")
            || stringified.contains("\"analogWrite\"")
            || stringified.contains("\"analogRead\"");

        self.uses_uart = stringified.contains("\"uart\"")
            || stringified.contains("\"serialBegin\"")
            || stringified.contains("\"uartWrite\"")
            || stringified.contains("\"uartRead\"");

        self.uses_i2c = stringified.contains("\"i2cWrite\"") || stringified.contains("\"i2cRead\"");

        self.uses_spi = stringified.contains("\"spi\"");

        self.uses_pwm = stringified.contains("\"analogWrite\"")
            || stringified.contains("\"pwmInit\"")
            || stringified.contains("\"pwmSet\"");

        self.uses_time = stringified.contains("\"delay\"");

        // Generate header based on architecture
        match self.arch {
            AsmArch::Avr => self.generate_avr_header(&mut out),
            AsmArch::Arm => self.generate_arm_header(&mut out),
            AsmArch::RiscV => self.generate_riscv_header(&mut out),
        }

        out.push('\n');

        // Global variables (data section)
        if !program.globals.is_empty() {
            match self.arch {
                AsmArch::Avr => out.push_str(".dseg\n"),
                AsmArch::Arm | AsmArch::RiscV => out.push_str(".data\n"),
            }

            for global_var in &program.globals {
                let val = global_var
                    .value
                    .as_ref()
                    .map(|v| self.gen_expr(v))
                    .unwrap_or_else(|| "0".to_string());
                out.push_str(&format!("{}: .byte {}\n", global_var.name, val));
            }
            out.push('\n');
        }

        // Generate functions
        for func in &program.functions {
            out.push_str(&self.gen_function(func));
            out.push('\n');
        }

        // Main entry point
        out.push_str(&format!(
            ".global {}\n",
            match self.arch {
                AsmArch::Avr => "main",
                AsmArch::Arm => "main",
                AsmArch::RiscV => "_start",
            }
        ));

        match self.arch {
            AsmArch::Avr => out.push_str(".org 0x0000\n"),
            AsmArch::Arm => out.push_str(".section .text\n"),
            AsmArch::RiscV => out.push_str(".section .text\n"),
        }

        out.push_str("main:\n");
        out.push_str("  ; Initialize\n");

        // Setup task
        for task in &program.tasks {
            if task.name == "setup" {
                for stmt in &task.body {
                    out.push_str(&self.gen_stmt_asm(stmt, 1));
                }
            }
        }

        out.push_str("  ; Main loop\n");
        out.push_str("loop:\n");

        // Loop task
        for task in &program.tasks {
            if task.name == "loop" {
                for stmt in &task.body {
                    out.push_str(&self.gen_stmt_asm(stmt, 1));
                }
            }
        }

        // Infinite loop
        match self.arch {
            AsmArch::Avr => {
                out.push_str("  rjmp loop\n");
            }
            AsmArch::Arm => {
                out.push_str("  b loop\n");
            }
            AsmArch::RiscV => {
                out.push_str("  j loop\n");
            }
        }

        GeneratorOutput::new(out)
    }
}

impl AsmGenerator {
    fn generate_avr_header(&self, out: &mut String) {
        out.push_str("; AVR Assembly (ATmega/ATtiny)\n");
        out.push_str("; Target: Arduino, bare metal\n");
        out.push_str(".include \"m328pdef.inc\"\n\n");
        out.push_str(".cseg\n");
        out.push_str(".org 0x0000\n\n");
        out.push_str("; Constants\n");
        out.push_str(".equ HIGH, 1\n");
        out.push_str(".equ LOW, 0\n");
        out.push_str(".equ OUTPUT, 0xFF\n");
        out.push_str(".equ INPUT, 0x00\n\n");
    }

    fn generate_arm_header(&self, out: &mut String) {
        out.push_str("; ARM Thumb Assembly (Cortex-M)\n");
        out.push_str("; Target: STM32, LPC\n");
        out.push_str(".syntax unified\n");
        out.push_str(".thumb\n\n");
        out.push_str(".section .text\n");
        out.push_str(".global main\n\n");
    }

    fn generate_riscv_header(&self, out: &mut String) {
        out.push_str("; RISC-V RV32I Assembly\n");
        out.push_str("; Target: ESP32, SiFive\n");
        out.push_str(".option norvc\n\n");
        out.push_str(".section .text\n");
        out.push_str(".global _start\n\n");
    }

    fn gen_function(&mut self, func: &AslFunction) -> String {
        let mut out = format!(".global {}\n", func.name);
        out.push_str(&format!("{}:\n", func.name));

        if func.body.is_empty() {
            out.push_str("  ; empty\n");
        } else {
            for stmt in &func.body {
                out.push_str(&self.gen_stmt_asm(stmt, 1));
            }
        }

        // Return instruction
        match self.arch {
            AsmArch::Avr => out.push_str("  ret\n"),
            AsmArch::Arm => out.push_str("  bx lr\n"),
            AsmArch::RiscV => out.push_str("  ret\n"),
        }

        out
    }

    fn gen_expr(&self, expr: &AslExpr) -> String {
        match expr {
            AslExpr::Literal(l) => match &l.value {
                serde_json::Value::Bool(b) => {
                    if *b {
                        "1".to_string()
                    } else {
                        "0".to_string()
                    }
                }
                serde_json::Value::String(s) => s.clone(),
                _ => l.value.to_string(),
            },

            AslExpr::Var(v) => v.name.clone(),

            AslExpr::Binary(b) => {
                // For expressions, return placeholders
                format!(
                    "({} {} {})",
                    self.gen_expr(&b.left),
                    b.op.to_symbol(),
                    self.gen_expr(&b.right)
                )
            }

            AslExpr::Call(c) => {
                // Function call - use as label or inline
                format!("{}", c.callee)
            }

            _ => "0".to_string(),
        }
    }

    fn gen_stmt_asm(&mut self, stmt: &AslStatement, level: usize) -> String {
        let _ind = " ".repeat(level * self.indent_size);

        match stmt {
            AslStatement::Assign(a) => match self.arch {
                AsmArch::Avr => format!(
                    "  mov r16, {}\n  sts {}, r16\n",
                    self.gen_expr(&a.value),
                    a.target
                ),
                AsmArch::Arm => format!(
                    "  movs r0, #{}\n  str r0, [r7, #{}]\n",
                    self.gen_expr(&a.value),
                    a.target
                ),
                AsmArch::RiscV => format!(
                    "  li t0, {}\n  sw t0, {}(zero)\n",
                    self.gen_expr(&a.value),
                    a.target
                ),
            },

            AslStatement::Declare(d) => {
                format!("  ; variable {} declared\n", d.name)
            }

            AslStatement::If(s) => {
                let else_label = self.next_label("else");
                let end_label = self.next_label("endif");

                let mut out = format!("  ; if {}\n", self.gen_expr(&s.condition));
                out.push_str(&format!("  ; TODO: cmp {}\n", self.gen_expr(&s.condition)));

                for stmt in &s.then_body {
                    out.push_str(&self.gen_stmt_asm(stmt, level));
                }

                if s.else_body.is_some() {
                    out.push_str(&format!("  jmp {}\n", end_label));
                    out.push_str(&format!("{}:\n", else_label));
                    for stmt in s.else_body.as_ref().unwrap() {
                        out.push_str(&self.gen_stmt_asm(stmt, level));
                    }
                    out.push_str(&format!("{}:\n", end_label));
                }

                out
            }

            AslStatement::While(s) => {
                let loop_label = self.next_label("while");
                let end_label = self.next_label("endwhile");

                let mut out = format!("{}:\n", loop_label);
                out.push_str(&format!("  ; while {}\n", self.gen_expr(&s.condition)));

                for stmt in &s.body {
                    out.push_str(&self.gen_stmt_asm(stmt, level));
                }

                out.push_str(&format!(
                    "  ; check condition {}\n",
                    self.gen_expr(&s.condition)
                ));
                out.push_str(&format!("  jmp {}\n", loop_label));
                out.push_str(&format!("{}:\n", end_label));

                out
            }

            AslStatement::DoWhile(s) => {
                let loop_label = self.next_label("dowhile");
                let end_label = self.next_label("enddo");

                let mut out = format!("{}:\n", loop_label);

                for stmt in &s.body {
                    out.push_str(&self.gen_stmt_asm(stmt, level));
                }

                out.push_str(&format!("  ; until {}\n", self.gen_expr(&s.condition)));
                out.push_str(&format!("  jmp {}\n", loop_label));
                out.push_str(&format!("{}:\n", end_label));

                out
            }

            AslStatement::For(s) => match s.as_ref() {
                crate::types::asl_types::AslFor::Range(r) => {
                    let loop_label = self.next_label("for");
                    let end_label = self.next_label("endfor");

                    let mut out = format!(
                        "  ; for {} in {}..{}\n",
                        r.var,
                        self.gen_expr(&r.from),
                        self.gen_expr(&r.to)
                    );
                    out.push_str("  ; TODO: initialize counter\n");
                    out.push_str(&format!("{}:\n", loop_label));

                    for stmt in &r.body {
                        out.push_str(&self.gen_stmt_asm(stmt, level));
                    }

                    out.push_str("  ; increment counter\n");
                    out.push_str(&format!("  jmp {}\n", loop_label));
                    out.push_str(&format!("{}:\n", end_label));

                    out
                }
                _ => "  ; unsupported for loop\n".to_string(),
            },

            AslStatement::Return(r) => {
                if let Some(v) = &r.value {
                    match self.arch {
                        AsmArch::Avr => format!("  mov r16, {}\n  ret\n", self.gen_expr(v)),
                        AsmArch::Arm => format!("  movs r0, #{}\n  bx lr\n", self.gen_expr(v)),
                        AsmArch::RiscV => format!("  li a0, {}\n  ret\n", self.gen_expr(v)),
                    }
                } else {
                    match self.arch {
                        AsmArch::Avr => "  ret\n".to_string(),
                        AsmArch::Arm => "  bx lr\n".to_string(),
                        AsmArch::RiscV => "  ret\n".to_string(),
                    }
                }
            }

            AslStatement::Break => match self.arch {
                AsmArch::Avr => "  jmp endloop\n".to_string(),
                AsmArch::Arm => "  b endloop\n".to_string(),
                AsmArch::RiscV => "  j endloop\n".to_string(),
            },

            AslStatement::Delay(d) => {
                // Simple delay loop
                let ms = d.duration.total_ms();
                match self.arch {
                    AsmArch::Avr => {
                        format!("  ; delay {} ms\n  ldi r16, {}\ndelay_loop_{}:\n  dec r16\n  brne delay_loop_{}\n", ms, ms, self.label_counter, self.label_counter)
                    }
                    AsmArch::Arm => {
                        format!("  ; delay {} ms\n  nop\n", ms)
                    }
                    AsmArch::RiscV => {
                        format!("  ; delay {} ms\n  nop\n", ms)
                    }
                }
            }

            AslStatement::Print(p) => {
                let args: Vec<String> = p.args.iter().map(|a| self.gen_expr(a)).collect();
                let mut out = String::new();
                for arg in args {
                    out.push_str(&format!("  ; print {}\n", arg));
                }
                out
            }

            AslStatement::PinMode(p) => {
                let pin = self.gen_expr(&p.pin);
                let mode = match p.mode {
                    PinModeKind::Output => "OUTPUT",
                    PinModeKind::Input => "INPUT",
                    _ => "INPUT",
                };
                match self.arch {
                    AsmArch::Avr => {
                        format!("  ; pin {} mode {}\n  sbi DDRB, {}\n", pin, mode, pin)
                    }
                    AsmArch::Arm => {
                        format!("  ; pin {} mode {}\n  ; TODO: configure GPIO\n", pin, mode)
                    }
                    AsmArch::RiscV => {
                        format!("  ; pin {} mode {}\n  ; TODO: configure GPIO\n", pin, mode)
                    }
                }
            }

            AslStatement::DigitalOutput(d) => {
                let pin = self.gen_expr(&d.pin);
                let val = self.gen_expr(&d.value);
                match self.arch {
                    AsmArch::Avr => {
                        if val == "HIGH" || val == "1" {
                            format!("  sbi PORTB, {}\n", pin)
                        } else {
                            format!("  cbi PORTB, {}\n", pin)
                        }
                    }
                    AsmArch::Arm => {
                        format!("  ; digitalWrite pin {}, {}\n", pin, val)
                    }
                    AsmArch::RiscV => {
                        format!("  ; digitalWrite pin {}, {}\n", pin, val)
                    }
                }
            }

            AslStatement::DigitalInput(r) => {
                let pin = self.gen_expr(&r.pin);
                match self.arch {
                    AsmArch::Avr => {
                        format!(
                            "  in r16, PINB\n  andi r16, (1 << {})\n  ; store to {}\n",
                            pin, r.target
                        )
                    }
                    AsmArch::Arm => {
                        format!("  ; digitalRead pin {} -> {}\n", pin, r.target)
                    }
                    AsmArch::RiscV => {
                        format!("  ; digitalRead pin {} -> {}\n", pin, r.target)
                    }
                }
            }

            AslStatement::AnalogOutput(a) => {
                let pin = self.gen_expr(&a.pin);
                let val = self.gen_expr(&a.value);
                match self.arch {
                    AsmArch::Avr => {
                        format!("  ; analogWrite pin {} = {}\n  ; TODO: PWM\n", pin, val)
                    }
                    AsmArch::Arm => {
                        format!("  ; analogWrite pin {} = {}\n  ; TODO: PWM\n", pin, val)
                    }
                    AsmArch::RiscV => {
                        format!("  ; analogWrite pin {} = {}\n  ; TODO: PWM\n", pin, val)
                    }
                }
            }

            AslStatement::AnalogInput(r) => {
                let pin = self.gen_expr(&r.pin);
                match self.arch {
                    AsmArch::Avr => {
                        format!("  ; analogRead pin {} -> {}\n", pin, r.target)
                    }
                    AsmArch::Arm => {
                        format!("  ; analogRead pin {} -> {}\n", pin, r.target)
                    }
                    AsmArch::RiscV => {
                        format!("  ; analogRead pin {} -> {}\n", pin, r.target)
                    }
                }
            }

            AslStatement::SerialBegin(s) => {
                let baud = self.gen_expr(&s.baud);
                match self.arch {
                    AsmArch::Avr => {
                        format!("  ; serial begin {} baud\n  ; TODO: USART init\n", baud)
                    }
                    AsmArch::Arm => {
                        format!("  ; serial begin {} baud\n  ; TODO: UART init\n", baud)
                    }
                    AsmArch::RiscV => {
                        format!("  ; serial begin {} baud\n  ; TODO: UART init\n", baud)
                    }
                }
            }

            AslStatement::UartWrite(u) => {
                let data = self.gen_expr(&u.data);
                match self.arch {
                    AsmArch::Avr => {
                        format!("  ; uart write {}\n  out UDR0, r16\n", data)
                    }
                    AsmArch::Arm => {
                        format!("  ; uart write {}\n", data)
                    }
                    AsmArch::RiscV => {
                        format!("  ; uart write {}\n", data)
                    }
                }
            }

            AslStatement::I2cWrite(i) => match self.arch {
                AsmArch::Avr => {
                    format!(
                        "  ; i2c write {} {}\n",
                        self.gen_expr(&i.address),
                        self.gen_expr(&i.data)
                    )
                }
                AsmArch::Arm => {
                    format!(
                        "  ; i2c write {} {}\n",
                        self.gen_expr(&i.address),
                        self.gen_expr(&i.data)
                    )
                }
                AsmArch::RiscV => {
                    format!(
                        "  ; i2c write {} {}\n",
                        self.gen_expr(&i.address),
                        self.gen_expr(&i.data)
                    )
                }
            },

            AslStatement::SpiTransfer(s) => match self.arch {
                AsmArch::Avr => {
                    format!(
                        "  ; spi transfer {}\n  out SPDR, r16\n",
                        self.gen_expr(&s.tx_data)
                    )
                }
                AsmArch::Arm => {
                    format!("  ; spi transfer {}\n", self.gen_expr(&s.tx_data))
                }
                AsmArch::RiscV => {
                    format!("  ; spi transfer {}\n", self.gen_expr(&s.tx_data))
                }
            },

            AslStatement::Comment(c) => format!("  ; {}\n", c.text),

            AslStatement::Expr(e) => {
                format!("  ; {}\n", self.gen_expr(&e.expr))
            }

            _ => format!("  ; (unsupported: {:?})\n", stmt),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_asm_generator_empty_program() {
        let prog = AslProgram::default();
        let out = AsmGenerator::new().generate(&prog);
        assert!(out.code.contains("main") || out.code.contains("_start"));
    }
}
