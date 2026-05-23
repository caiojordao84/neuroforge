//! Gerador Rust idiomático para ASL v4 (ecossistema esp-hal/Embassy)
//!
//! **Semântica:**
//! - no_std, no_main
//! - #[esp_hal_embassy::main]
//! - Inicialização de periféricos esp-hal (Ledc)
//! - Variáveis locais (se possível)
//! - Suporte a Tasks via Spawner (opcional)

use crate::asl_types::{AslExpr, AslProgram, AslStatement, AslTask, BinaryOp};
use crate::plugins::core::generator::GeneratorOutput;
use std::collections::{HashMap, HashSet};

#[derive(Default)]
pub struct RustGenerator {
    globals: HashSet<String>,
    uses_ledc: bool,
    pwm_channels: HashMap<String, u8>,
    next_channel: u8,
}

impl RustGenerator {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn generate(&mut self, program: &AslProgram) -> GeneratorOutput {
        self.scan_peripherals(program);
        self.globals = program.globals.iter().map(|g| g.name.clone()).collect();

        let mut code = String::new();
        code.push_str("#![no_std]\n");
        code.push_str("#![no_main]\n\n");

        code.push_str("use embassy_executor::Spawner;\n");
        code.push_str("use embassy_time::Timer;\n");
        code.push_str("use esp_hal::time::Rate;\n");
        code.push_str("use {esp_backtrace as _, esp_println as _};\n");

        if self.uses_ledc {
            code.push_str("use esp_hal::ledc::{\n");
            code.push_str("    channel::{self, ChannelIFace},\n");
            code.push_str("    timer::{self, TimerIFace},\n");
            code.push_str("    LSGlobalClkSource, Ledc, LowSpeed,\n");
            code.push_str("};\n");
        }
        code.push('\n');

        // 1. Constantes para Pinos (Ref: pattern steal do usuário)
        self.generate_pin_constants(program, &mut code);

        // 2. Globais (Atoms only if referenced outside main)
        self.generate_globals(program, &mut code);

        // 3. Funções Puras
        for func in &program.functions {
            code.push_str(&self.generate_function(func));
        }

        // 4. Tasks Externas (Spawner) se necessário
        let complex_mode = program.tasks.len() > 2;
        if complex_mode {
            for task in &program.tasks {
                if task.name != "setup" && task.name != "loop" {
                    code.push_str(&self.generate_async_task(task));
                }
            }
        }

        // 5. Entry point (Monolithic main)
        code.push_str("#[esp_hal_embassy::main]\n");
        code.push_str("async fn main(_spawner: Spawner) {\n");
        code.push_str("    let peripherals = esp_hal::init(esp_hal::Config::default());\n\n");

        if self.uses_ledc {
            code.push_str("    let mut ledc = Ledc::new(peripherals.LEDC);\n");
            code.push_str("    ledc.set_global_slow_clock(LSGlobalClkSource::APBClk);\n\n");
            code.push_str(
                "    let mut lstimer0 = ledc.timer::<LowSpeed>(timer::Number::Timer0);\n",
            );
            code.push_str("    lstimer0.configure(timer::config::Config {\n");
            code.push_str("        duty: timer::config::Duty::Duty8Bit,\n");
            code.push_str("        clock_source: timer::LSClockSource::APBClk,\n");
            code.push_str("        frequency: Rate::from_khz(5),\n");
            code.push_str("    }).unwrap();\n\n");

            // Inicializar canais para cada pino PWM detectado
            self.generate_ledc_init(program, &mut code);
        }

        // Setup logic
        if let Some(setup) = program.tasks.iter().find(|t| t.name == "setup") {
            for stmt in &setup.body {
                code.push_str(&format!("    {};\n", self.generate_statement(stmt, 1)));
            }
        }

        // Loop logic
        if let Some(loop_task) = program.tasks.iter().find(|t| t.name == "loop") {
            code.push_str("\n    loop {\n");
            for stmt in &loop_task.body {
                code.push_str(&format!("        {};\n", self.generate_statement(stmt, 2)));
            }
            code.push_str("        Timer::after_millis(1).await;\n"); // Prevenção de loop quente
            code.push_str("    }\n");
        }

        code.push_str("}\n");

        let mut files = HashMap::new();
        files.insert("src/main.rs".to_string(), code.clone());
        files.insert("Cargo.toml".to_string(), self.generate_cargo_toml(program));

        GeneratorOutput {
            code,
            map: vec![],
            files: Some(files),
        }
    }

    fn scan_peripherals(&mut self, program: &AslProgram) {
        self.uses_ledc = false;
        self.pwm_channels.clear();
        self.next_channel = 0;

        let scan_stmt = |stmt: &AslStatement, this: &mut Self| {
            if let AslStatement::AnalogOutput(ao) = stmt {
                this.uses_ledc = true;
                if let AslExpr::Literal(l) = &ao.pin {
                    let pin_name = format!("PIN_{}", l.value);
                    this.pwm_channels.entry(pin_name).or_insert_with(|| {
                        let ch = this.next_channel;
                        this.next_channel += 1;
                        ch
                    });
                }
            }
        };

        for task in &program.tasks {
            for stmt in &task.body {
                scan_stmt(stmt, self);
            }
        }
    }

    fn generate_pin_constants(&self, program: &AslProgram, code: &mut String) {
        // Encontrar declarações de pinos no escopo 'const' ou via literals em hardware calls
        let mut pins = HashSet::new();
        for g in &program.globals {
            if g.scope == "const" && g.name.to_lowercase().contains("pin") {
                pins.insert(g.name.clone());
            }
        }
        // Fallback para pins em pwm_channels
        for name in self.pwm_channels.keys() {
            pins.insert(name.clone());
        }

        for pin in pins {
            // Ref: const LED_PIN: u8 = 9;
            // Se o valor estiver disponível via Globals, usar ele
            let val = program
                .globals
                .iter()
                .find(|g| g.name == pin)
                .and_then(|g| g.value.as_ref())
                .and_then(|v| v.as_literal())
                .and_then(|l| l.value.as_i64())
                .unwrap_or(9); // Default dummy
            code.push_str(&format!("const {}: u8 = {};\n", pin.to_uppercase(), val));
        }
        code.push('\n');
    }

    fn generate_ledc_init(&self, _program: &AslProgram, code: &mut String) {
        for (pin_name, ch) in &self.pwm_channels {
            code.push_str(&format!(
                "    let pin_{} = esp_hal::gpio::Output::new(\n",
                ch
            ));
            code.push_str(&format!("        esp_hal::gpio::AnyPin::new(unsafe {{ esp_hal::gpio::GpioPin::<{}>::steal() }}),\n", pin_name.to_uppercase()));
            code.push_str("        esp_hal::gpio::Level::Low,\n");
            code.push_str("    );\n");
            code.push_str(&format!(
                "    let mut channel{} = ledc.channel(channel::Number::Channel{}, pin_{});\n",
                ch, ch, ch
            ));
            code.push_str(&format!(
                "    channel{}.configure(channel::config::Config {{\n",
                ch
            ));
            code.push_str("        timer: &lstimer0, duty_pct: 0, drive_mode: channel::config::DriveMode::PushPull,\n");
            code.push_str("    }).unwrap();\n\n");
        }
    }

    fn generate_globals(&self, program: &AslProgram, _code: &mut String) {
        for g in &program.globals {
            if g.scope != "const" {
                // No modelo monolítico main, variáveis de setup/loop podem ser locais ao main
                // Por agora, não injetaremos Atomics aqui se o usuário quer localidade.
            }
        }
    }

    fn generate_function(&self, func: &crate::asl_types::AslFunction) -> String {
        let mut s = format!("fn {}(", func.name);
        // ... (simplified params)
        s.push_str(") {\n");
        for stmt in &func.body {
            s.push_str(&format!("    {};\n", self.generate_statement(stmt, 1)));
        }
        s.push_str("}\n\n");
        s
    }

    fn generate_async_task(&self, _task: &AslTask) -> String {
        // ... (simplified async task)
        "".to_string()
    }

    fn generate_statement(&self, stmt: &AslStatement, _indent: usize) -> String {
        match stmt {
            AslStatement::AnalogOutput(ao) => {
                let pin_name = if let AslExpr::Literal(l) = &ao.pin {
                    format!("PIN_{}", l.value)
                } else {
                    "PIN_9".to_string()
                };

                let ch = self.pwm_channels.get(&pin_name).unwrap_or(&0);
                let val = self.generate_expr(&ao.value);
                // Ref: channel0.set_duty( ((brightness * 100) / 255) as u8 ).unwrap();
                format!(
                    "channel{}.set_duty((({} * 100) / 255) as u8).unwrap()",
                    ch, val
                )
            }
            AslStatement::Delay(d) => {
                format!("Timer::after_millis({}).await", d.duration.total_ms())
            }
            AslStatement::Declare(d) => {
                let val = d
                    .value
                    .as_ref()
                    .map(|v| self.generate_expr(v))
                    .unwrap_or("0".into());
                format!("let mut {} = {}", d.name, val)
            }
            AslStatement::Assign(a) => {
                format!("{} = {}", a.target, self.generate_expr(&a.value))
            }
            AslStatement::If(i) => {
                let cond = self.generate_expr(&i.condition);
                let mut s = format!("if {} {{\n", cond);
                for st in &i.then_body {
                    s.push_str(&format!(
                        "            {};\n",
                        self.generate_statement(st, 3)
                    ));
                }
                s.push_str("        }");
                s
            }
            _ => format!("// unimplemented statement {:?}", stmt),
        }
    }

    fn generate_expr(&self, expr: &AslExpr) -> String {
        match expr {
            AslExpr::Literal(l) => {
                let s = l.value.to_string();
                if let Some(s_val) = l.value.as_str() {
                    return format!("\"{}\"", s_val);
                }
                s
            }
            AslExpr::Var(v) => v.name.clone(),
            AslExpr::Binary(b) => {
                format!(
                    "({} {} {})",
                    self.generate_expr(&b.left),
                    self.generate_op(&b.op),
                    self.generate_expr(&b.right)
                )
            }
            AslExpr::Unary(u) => {
                format!("({}{})", u.op.to_symbol(), self.generate_expr(&u.expr))
            }
            AslExpr::Call(c) => {
                let callee = if c.callee == "currentTime" || c.callee == "millis" {
                    "embassy_time::Instant::now().as_millis()".to_string()
                } else {
                    c.callee.clone()
                };
                if callee == "embassy_time::Instant::now().as_millis()" {
                    callee
                } else {
                    let args: Vec<String> = c.args.iter().map(|a| self.generate_expr(a)).collect();
                    format!("{}({})", callee, args.join(", "))
                }
            }
            AslExpr::Member(m) => {
                format!("{}.{}", self.generate_expr(&m.target), m.property)
            }
            AslExpr::Index(i) => {
                format!("{}[{}]", self.generate_expr(&i.target), self.generate_expr(&i.index))
            }
            AslExpr::Index2D(i) => {
                format!("{}[{}][{}]", self.generate_expr(&i.array), self.generate_expr(&i.row_index), self.generate_expr(&i.col_index))
            }
            AslExpr::Index3D(i) => {
                format!("{}[{}][{}][{}]", self.generate_expr(&i.array), self.generate_expr(&i.d1_index), self.generate_expr(&i.d2_index), self.generate_expr(&i.d3_index))
            }
            AslExpr::Array(a) => {
                let elems: Vec<String> = a.elements.iter().map(|e| self.generate_expr(e)).collect();
                format!("[{}]", elems.join(", "))
            }
            _ => "0".to_string(),
        }
    }

    fn generate_op(&self, op: &BinaryOp) -> &str {
        match op {
            BinaryOp::Add => "+",
            BinaryOp::Sub => "-",
            BinaryOp::Mul => "*",
            BinaryOp::Div => "/",
            BinaryOp::Eq => "==",
            BinaryOp::Lte => "<=",
            BinaryOp::Gte => ">=",
            BinaryOp::And => "&&",
            BinaryOp::Or => "||",
            _ => "+",
        }
    }

    fn generate_cargo_toml(&self, _program: &AslProgram) -> String {
        let mut s = String::new();
        s.push_str(
            "[package]\nname = \"neuroforge-out\"\nversion = \"0.1.0\"\nedition = \"2021\"\n\n",
        );
        s.push_str("[dependencies]\n");
        s.push_str("esp-hal = { version = \"0.22.0\", features = [\"esp32\"] }\n");
        s.push_str("esp-backtrace = { version = \"0.14.2\", features = [\"esp32\", \"panic-handler\", \"exception-handler\", \"println\"] }\n");
        s.push_str("esp-println = { version = \"0.12.0\", features = [\"esp32\", \"log\"] }\n");
        s.push_str(
            "embassy-executor = { version = \"0.6.1\", features = [\"task-arena-size-12288\"] }\n",
        );
        s.push_str("embassy-time = { version = \"0.3.2\", features = [\"generic-queue-8\"] }\n");
        s.push_str("esp-hal-embassy = { version = \"0.5.0\", features = [\"esp32\"] }\n");
        s.push_str("critical-section = \"1.1.2\"\n");
        s
    }
}
