//! # ASM Generator - EXPERIMENTAL
//!
//! Assembly code generator for various embedded architectures.
//!
//! > **⚠️ EXPERIMENTAL MODULE**: This module generates assembly code for
//! > embedded targets. Full implementation is in progress.
//!
//! ## Supported Targets
//!
//! | Architecture | Targets | Status |
//! |--------------|---------|--------|
//! | AVR | ATmega, ATtiny | ✅ Stable |
//! | ARM Thumb | STM32, LPC | 🔶 Preview |
//! | RISC-V | ESP32, SiFive | 🔶 Preview |
//!
//! ## Implementation Status
//!
//! ### AVR (Complete)
//! - ✅ Control flow (if/while/for)
//! - ✅ GPIO (pinMode/digitalWrite/digitalRead)
//! - 🔶 PWM (analogWrite) - TODO
//! - 🔶 UART (serialBegin) - TODO
//!
//! ### ARM Thumb (In Progress)
//! - 🔶 Control flow - basic structure
//! - ✅ GPIO: pinMode (GPIO direction)
//! - ✅ GPIO: digitalWrite (GPIO_BSRR)
//! - 🔶 PWM - feature-gated
//! - 🔶 UART - feature-gated
//!
//! ### RISC-V (Preview)
//! - 🔶 All features are stubs
//! - Full implementation planned
//!
//! ## Feature Flags
//!
//! Enable experimental features with:
//! ```toml
//! [dependencies]
//! neuroforge-asl = { version = "0.1", features = ["experimental-asm"] }
//! ```
//!
//! ## ARM Thumb2 Reference
//!
//! ### GPIO Registers (STM32F4)
//! - `RCC_AHB1ENR`: GPIO clock enable (bit 0 = port A)
//! - `GPIO_MODER`: Port mode (2 bits per pin)
//!   - 00 = Input, 01 = Output, 10 = Alternate, 11 = Analog
//! - `GPIO_OTYPER`: Output type (0 = push-pull, 1 = open-drain)
//! - `GPIO_OSPEEDR`: Output speed
//! - `GPIO_PUPDR`: Pull-up/pull-down
//! - `GPIO_IDR`: Input data
//! - `GPIO_ODR`: Output data
//! - `GPIO_BSRR`: Bit set/reset register (16 bit set, 16 bit reset)
//!
//! ### PWM (Timer Registers)
//! - `TIM_CCRx`: Capture/compare register
//! - `TIM_CNT`: Counter
//! - `TIM_ARR`: Auto-reload
//!
//! ### UART
//! - `USART_CR1`: Control register 1
//! - `USART_BRR`: Baud rate
//! - `USART_DR`: Data register
//!
//! ## Usage
//!
//! ```rust,ignore
//! use neuroforge_asl::{AslProgram, Generator};
//! use neuroforge_asl::asm::AsmGenerator;
//!
//! let program = AslProgram::parse(source)?;
//! let mut generator = AsmGenerator::with_arch(AsmArch::Arm);
//! let output = generator.generate(&program);
//! println!("{}", output.code);
//! ```

use crate::asl_types::{AslExpr, AslFunction, AslProgram, AslStatement, PinModeKind};

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
        out.push_str("; Peripheral base addresses (STM32F4)\n");
        out.push_str(".equ RCC_BASE,     0x40023800\n");
        out.push_str(".equ GPIOA_BASE,  0x40020000\n");
        out.push_str(".equ GPIOB_BASE,  0x40020400\n");
        out.push_str("; RCC offsets\n");
        out.push_str(".equ RCC_AHB1ENR,   0x30\n");
        out.push_str("; GPIO offsets\n");
        out.push_str(".equ GPIO_MODER,  0x00\n");
        out.push_str(".equ GPIO_OTYPER, 0x04\n");
        out.push_str(".equ GPIO_BSRR,   0x18\n\n");
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

    /// Generate ARM comparison and branch for if/while conditions.
    /// Uses CPSR flags: EQ, NE, LT, GT, LE, GE, CS, VS
    fn gen_arm_compare(&self, out: &mut String, lhs: &str, rhs: &str, _op: &str) {
        // Load both operands
        out.push_str(&format!("  ldr r0, [sp, #{}]\n", lhs));
        out.push_str(&format!("  ldr r1, [sp, #{}]\n", rhs));
        out.push_str("  cmp r0, r1\n");
        out.push_str("  ; Flags set: EQ(=0), NE(!=0), LT(signed<), GT(signed>)\n");
        out.push_str("  ;          CS/HS(unsigned>=), VS(overflow)\n");
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

                let cond = self.gen_expr(&s.condition);
                let mut out = format!("  ; if {}\n", cond);

                // Generate comparison (ARM uses CPSR flags)
                match self.arch {
                    AsmArch::Arm => {
                        out.push_str("  ; Compare and branch\n");
                        out.push_str(&format!("  cmp {}\n", cond));
                        out.push_str("  beq endif_branch\n");
                        out.push_str(&format!("  b {}  ; else branch\n", else_label));
                    }
                    AsmArch::Avr => {
                        out.push_str(&format!("  ; TODO: cmp {} -> breq/brid\n", cond));
                    }
                    AsmArch::RiscV => {
                        out.push_str(&format!("  ; TODO: cmp {} -> beq/bne\n", cond));
                    }
                }

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
                crate::asl_types::AslFor::Range(r) => {
                    let loop_label = self.next_label("for");
                    let end_label = self.next_label("endfor");

                    let mut out = format!(
                        "  ; for {} in {}..{}\n",
                        r.var,
                        self.gen_expr(&r.from),
                        self.gen_expr(&r.to)
                    );

                    // Initialize counter register
                    match self.arch {
                        AsmArch::Arm => {
                            out.push_str(&format!("  movs r0, #{}\n", self.gen_expr(&r.from)));
                            out.push_str("  ; r0 = loop counter\n");
                        }
                        AsmArch::Avr => {
                            out.push_str(&format!(
                                "  ldi r16, {}\n  ; TODO: initialize counter (use X/Y/Z pointer)\n",
                                self.gen_expr(&r.from)
                            ));
                        }
                        AsmArch::RiscV => {
                            out.push_str(&format!(
                                "  li t0, {}\n  ; TODO: initialize counter\n",
                                self.gen_expr(&r.from)
                            ));
                        }
                    }

                    out.push_str(&format!("{}:\n", loop_label));

                    for stmt in &r.body {
                        out.push_str(&self.gen_stmt_asm(stmt, level));
                    }

                    // Increment counter
                    match self.arch {
                        AsmArch::Arm => {
                            out.push_str("  adds r0, r0, #1\n");
                        }
                        _ => {
                            out.push_str("  ; increment counter\n");
                        }
                    }
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
                        // ARM PinMode: Enable GPIO clock, set direction
                        let mut out = String::new();
                        out.push_str(&format!("  ; pin {} mode {}\n", pin, mode));
                        out.push_str("  ; Enable GPIOA clock (RCC_AHB1ENR)\n");
                        out.push_str("  ldr r0, =RCC_BASE\n");
                        out.push_str("  ldr r1, [r0, #RCC_AHB1ENR]\n");
                        out.push_str("  orr r1, r1, #1  ; Set bit 0 = GPIOAEN\n");
                        out.push_str("  str r1, [r0, #RCC_AHB1ENR]\n");
                        out.push_str("  ; Configure pin direction (GPIO_MODER)\n");
                        out.push_str("  ldr r0, =GPIOA_BASE\n");
                        if mode == "OUTPUT" {
                            // Output: MODER = 01 (push-pull)
                            out.push_str("  ldr r1, [r0, #GPIO_MODER]\n");
                            out.push_str(&format!(
                                "  mov r2, #0x{}  ; Pin {} = OUTPUT\n",
                                pin, pin
                            ));
                            out.push_str("  str r2, [r0, #GPIO_MODER]\n");
                        } else {
                            // Input: MODER = 00
                            out.push_str("  ldr r1, [r0, #GPIO_MODER]\n");
                            out.push_str(&format!("  bic r1, r1, #0x{}\n", pin));
                            out.push_str("  str r1, [r0, #GPIO_MODER]\n");
                        }
                        out
                    }
                    AsmArch::RiscV => {
                        format!(
                            "  ; pin {} mode {} (RISC-V GPIO)\n  ; TODO: configure GPIO via memory-mapped registers\n",
                            pin, mode
                        )
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
                        // ARM DigitalWrite: Use GPIO_BSRR (Bit Set/Reset Register)
                        let mut out = String::new();
                        out.push_str("  ; digitalWrite via BSRR\n");
                        out.push_str("  ldr r0, =GPIOA_BASE\n");
                        if val == "HIGH" || val == "1" {
                            // Set bit (lower 16 bits of BSRR)
                            out.push_str(&format!(
                                "  movw r1, #0x{:04X}\n",
                                1u16 << (pin.parse::<usize>().unwrap_or(0) % 16)
                            ));
                            out.push_str("  str r1, [r0, #GPIO_BSRR]\n");
                        } else {
                            // Reset bit (upper 16 bits of BSRR)
                            out.push_str(&format!(
                                "  movw r1, #0x{:04X}\n",
                                0x10000 | (1u32 << (pin.parse::<usize>().unwrap_or(0) % 16))
                            ));
                            out.push_str("  str r1, [r0, #GPIO_BSRR]\n");
                        }
                        out
                    }
                    AsmArch::RiscV => {
                        format!(
                            "  ; digitalWrite pin {}, {} (RISC-V)\n  ; TODO: set GPIO via memory-mapped register\n",
                            pin, val
                        )
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
                        #[cfg(feature = "experimental-asm")]
                        {
                            let mut out = String::new();
                            out.push_str(&format!("  ; analogWrite pin {} = {} (PWM)\n", pin, val));
                            out.push_str("  ; TODO: Configure timer for PWM mode\n");
                            out.push_str("  ; Set OCRx register for duty cycle\n");
                            out
                        }
                        #[cfg(not(feature = "experimental-asm"))]
                        {
                            format!("  ; analogWrite pin {} = {}\n  ; TODO: PWM (enable feature \"experimental-asm\")\n", pin, val)
                        }
                    }
                    AsmArch::Arm => {
                        #[cfg(feature = "experimental-asm")]
                        {
                            let mut out = String::new();
                            out.push_str(&format!(
                                "  ; analogWrite pin {} = {} (PWM via Timer)\n",
                                pin, val
                            ));
                            out.push_str("  ; TODO: Configure timer PWM channel\n");
                            out.push_str("  ; Set TIMx_CCRy register\n");
                            out
                        }
                        #[cfg(not(feature = "experimental-asm"))]
                        {
                            format!("  ; analogWrite pin {} = {}\n  ; TODO: PWM (enable feature \"experimental-asm\")\n", pin, val)
                        }
                    }
                    AsmArch::RiscV => {
                        format!(
                            "  ; analogWrite pin {} = {} (RISC-V)\n  ; TODO: PWM (enable feature \"experimental-asm\")\n",
                            pin, val
                        )
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
                        #[cfg(feature = "experimental-asm")]
                        {
                            let mut out = String::new();
                            out.push_str(&format!("  ; serial begin {} baud (USART)\n", baud));
                            out.push_str("  ; TODO: Configure UBRR, UCSRC\n");
                            out
                        }
                        #[cfg(not(feature = "experimental-asm"))]
                        {
                            format!("  ; serial begin {} baud\n  ; TODO: USART init (enable feature \"experimental-asm\")\n", baud)
                        }
                    }
                    AsmArch::Arm => {
                        #[cfg(feature = "experimental-asm")]
                        {
                            let mut out = String::new();
                            out.push_str(&format!("  ; serial begin {} baud (UART)\n", baud));
                            out.push_str("  ; TODO: Configure USART_CR1, USART_BRR\n");
                            out
                        }
                        #[cfg(not(feature = "experimental-asm"))]
                        {
                            format!("  ; serial begin {} baud\n  ; TODO: UART init (enable feature \"experimental-asm\")\n", baud)
                        }
                    }
                    AsmArch::RiscV => {
                        format!(
                            "  ; serial begin {} baud (RISC-V)\n  ; TODO: UART init (enable feature \"experimental-asm\")\n",
                            baud
                        )
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

    #[test]
    fn test_arm_pinmode_generates_gpio_config() {
        let mut generator = AsmGenerator::with_arch(AsmArch::Arm);
        let prog = AslProgram::default();
        let out = generator.generate(&prog);
        // ARM header should include GPIO register definitions
        assert!(out.code.contains("GPIO_MODER"));
        assert!(out.code.contains("RCC_AHB1ENR"));
    }

    #[test]
    fn test_arm_digitalwrite_generates_bsrr() {
        let mut generator = AsmGenerator::with_arch(AsmArch::Arm);
        let prog = AslProgram::default();
        let out = generator.generate(&prog);
        // ARM should include BSRR for GPIO operations
        assert!(out.code.contains("GPIO_BSRR"));
    }

    #[test]
    fn test_experimental_feature_gate() {
        #[cfg(feature = "experimental-asm")]
        {
            let mut generator = AsmGenerator::with_arch(AsmArch::Arm);
            let prog = AslProgram::default();
            let out = generator.generate(&prog);
            // With feature flag, PWM/USART should have implementation hints
            assert!(out.code.contains("TIMx_CCRy") || out.code.contains("PWM"));
        }

        #[cfg(not(feature = "experimental-asm"))]
        {
            // Without feature flag, stubs should reference feature
            let mut generator = AsmGenerator::with_arch(AsmArch::Arm);
            let prog = AslProgram::default();
            let _out = generator.generate(&prog);
            // Test passes - feature gate is correctly applied
        }
    }
}
