//! CGenerator     gerador de c  digo C++/Arduino a partir de AslProgram.

//! Migrado para a Arquitetura NeuroForge Fase 1C (Consome ASL JSON Tree Omni-direcional).

use crate::types::asl_types::*;

use crate::plugins::core::{AslGenerator, GeneratorOutput, SourceMapEntry};

use crate::plugins::core::{ShimDefinition, ShimLanguage, ShimManager};

pub struct CGenerator {
    source_map: Vec<SourceMapEntry>,

    current_line: u32,

    shims: ShimManager,
}

impl Default for CGenerator {
    fn default() -> Self {
        Self::new()
    }
}

impl CGenerator {
    pub fn new() -> Self {
        let mut shims = ShimManager::new(ShimLanguage::C);

        shims.register_shims(default_c_shims());

        Self {
            source_map: vec![],

            current_line: 1,

            shims,
        }
    }

    fn scan_for_shims(&mut self, program: &AslProgram) {
        let stringified = serde_json::to_string(program).unwrap_or_default();

        if stringified.contains("sevseg") {
            self.shims.require_shim("sevseg");
        }

        if stringified.contains("servo") || stringified.contains("Servo") {
            self.shims.require_shim("servo");
        }

        if stringified.contains("Wire") || stringified.contains("i2c") {
            self.shims.require_shim("wire");
        }
    }

    fn add_ln(&mut self, lines: &mut Vec<String>, text: &str) {
        lines.push(text.to_string());

        self.current_line += text.lines().count().max(1) as u32;
    }

    /// Check if a statement uses a specific variable name
    fn stmt_uses_var(&self, stmt: &AslStatement, var_name: &str) -> bool {
        match stmt {
            AslStatement::Declare(d) => d.name == var_name,
            AslStatement::Assign(a) => a.target == var_name,
            AslStatement::If(i) => {
                self.expr_uses_var(&i.condition, var_name)
                    || i.then_body.iter().any(|s| self.stmt_uses_var(s, var_name))
                    || i.else_if
                        .iter()
                        .any(|ei| ei.body.iter().any(|s| self.stmt_uses_var(s, var_name)))
                    || i.else_body.as_ref().map_or(false, |eb| {
                        eb.iter().any(|s| self.stmt_uses_var(s, var_name))
                    })
            }
            AslStatement::While(w) => {
                self.expr_uses_var(&w.condition, var_name)
                    || w.body.iter().any(|s| self.stmt_uses_var(s, var_name))
            }
            AslStatement::For(f) => match f.as_ref() {
                AslFor::Range(r) => {
                    r.var == var_name
                        || self.expr_uses_var(&r.from, var_name)
                        || self.expr_uses_var(&r.to, var_name)
                        || self.expr_uses_var(&r.step, var_name)
                        || r.body.iter().any(|s| self.stmt_uses_var(s, var_name))
                }
                AslFor::Each(e) => {
                    e.var == var_name
                        || self.expr_uses_var(&e.iterable, var_name)
                        || e.body.iter().any(|s| self.stmt_uses_var(s, var_name))
                }
                AslFor::CStyle(c) => {
                    c.init.iter().any(|s| self.stmt_uses_var(s, var_name))
                        || self.expr_uses_var(&c.condition, var_name)
                        || c.update.iter().any(|s| self.stmt_uses_var(s, var_name))
                        || c.body.iter().any(|s| self.stmt_uses_var(s, var_name))
                }
            },
            AslStatement::Return(r) => r
                .value
                .as_ref()
                .map_or(false, |v| self.expr_uses_var(v, var_name)),
            AslStatement::Expr(e) => self.expr_uses_var(&e.expr, var_name),
            AslStatement::Break => false,
            AslStatement::Continue => false,
            AslStatement::Switch(s) => {
                self.expr_uses_var(&s.discriminant, var_name)
                    || s.cases
                        .iter()
                        .any(|c| c.body.iter().any(|s| self.stmt_uses_var(s, var_name)))
            }
            AslStatement::Delay(_d) => false,
            AslStatement::DigitalOutput(d) => {
                self.expr_uses_var(&d.pin, var_name) || self.expr_uses_var(&d.value, var_name)
            }
            AslStatement::DigitalInput(d) => self.expr_uses_var(&d.pin, var_name),
            AslStatement::AnalogOutput(a) => {
                self.expr_uses_var(&a.pin, var_name) || self.expr_uses_var(&a.value, var_name)
            }
            AslStatement::AnalogInput(a) => self.expr_uses_var(&a.pin, var_name),
            AslStatement::PwmInit(p) => {
                self.expr_uses_var(&p.pin, var_name) || self.expr_uses_var(&p.freq, var_name)
            }
            AslStatement::PwmSetDuty(p) => {
                self.expr_uses_var(&p.pin, var_name) || self.expr_uses_var(&p.duty, var_name)
            }
            AslStatement::Print(p) => p.args.iter().any(|a| self.expr_uses_var(a, var_name)),
            _ => false,
        }
    }

    fn expr_uses_var(&self, expr: &AslExpr, var_name: &str) -> bool {
        match expr {
            AslExpr::Var(v) => v.name == var_name,
            AslExpr::Binary(b) => {
                self.expr_uses_var(&b.left, var_name) || self.expr_uses_var(&b.right, var_name)
            }
            AslExpr::Unary(u) => self.expr_uses_var(&u.expr, var_name),
            AslExpr::Call(c) => c.args.iter().any(|a| self.expr_uses_var(a, var_name)),
            AslExpr::Member(m) => self.expr_uses_var(&m.target, var_name),
            AslExpr::Index(i) => {
                self.expr_uses_var(&i.target, var_name) || self.expr_uses_var(&i.index, var_name)
            }
            AslExpr::Array(a) => a.elements.iter().any(|e| self.expr_uses_var(e, var_name)),
            _ => false,
        }
    }

    fn gen_expr(&mut self, expr: &AslExpr) -> String {
        match expr {
            AslExpr::Literal(l) => {
                let s = l.value.to_string();

                if let Some(v) = l.value.as_f64() {
                    if v.fract() != 0.0 {
                        return format!("{}", v);
                    }
                }

                if let Some(s_val) = l.value.as_str() {
                    return format!("\"{}\"", s_val);
                }

                s
            }

            AslExpr::Var(v) => v.name.clone(),

            AslExpr::Binary(b) => {
                format!(
                    "({} {} {})",
                    self.gen_expr(&b.left),
                    b.op.to_symbol(),
                    self.gen_expr(&b.right)
                )
            }

            AslExpr::Unary(u) => {
                format!("({}{})", u.op.to_symbol(), self.gen_expr(&u.expr))
            }

            AslExpr::Call(c) => {
                let args: Vec<String> = c.args.iter().map(|a| self.gen_expr(a)).collect();

                format!("{}({})", c.callee, args.join(", "))
            }

            AslExpr::Member(m) => {
                format!("{}.{}", self.gen_expr(&m.target), m.property)
            }

            AslExpr::Index(i) => {
                format!("{}[{}]", self.gen_expr(&i.target), self.gen_expr(&i.index))
            }

            AslExpr::Array(a) => {
                let elems: Vec<String> = a.elements.iter().map(|e| self.gen_expr(e)).collect();

                format!("{{ {} }}", elems.join(", "))
            }

            _ => "0".to_string(),
        }
    }

    fn gen_stmt(&mut self, stmt: &AslStatement, lines: &mut Vec<String>, indent: &str) {
        match stmt {
            AslStatement::Comment(c) => {
                let text = c.text.trim();

                let text = if text.starts_with('#') {
                    format!("//{}", &text[1..])
                } else {
                    text.to_string()
                };

                if text.starts_with("/*") || text.starts_with("//") {
                    self.add_ln(lines, &format!("{}{}", indent, text));
                } else {
                    self.add_ln(lines, &format!("{}// {}", indent, text));
                }
            }

            AslStatement::Declare(d) => {
                let val = d
                    .value
                    .as_ref()
                    .map(|v| self.gen_expr(v))
                    .unwrap_or_else(|| "0".to_string());

                let t_str = match d.r#type {
                    AslType::Int
                    | AslType::Int32
                    | AslType::Sint8
                    | AslType::Int16
                    | AslType::Short => "int",

                    AslType::Uint
                    | AslType::Uint32
                    | AslType::Uint8
                    | AslType::Uint16
                    | AslType::Byte => "unsigned int",

                    AslType::Int64 | AslType::Long => "long long",

                    AslType::Uint64 => "unsigned long long",

                    AslType::Float | AslType::Double => "float",

                    AslType::Bool => "bool",

                    AslType::String => "String",

                    AslType::Void => "void",

                    _ => "auto",
                };

                self.add_ln(lines, &format!("{}{} {} = {};", indent, t_str, d.name, val));
            }

            AslStatement::Assign(a) => {
                let val = self.gen_expr(&a.value);

                self.add_ln(lines, &format!("{}{} = {};", indent, a.target, val));
            }

            AslStatement::SetIndex(s) => {
                let idx = self.gen_expr(&s.index);

                let val = self.gen_expr(&s.value);

                self.add_ln(
                    lines,
                    &format!("{}{}[{}] = {};", indent, s.target, idx, val),
                );
            }

            AslStatement::PinMode(p) => {
                let pin = self.gen_expr(&p.pin);

                let mode = match p.mode {
                    PinModeKind::Output => "OUTPUT",

                    PinModeKind::Input => "INPUT",

                    PinModeKind::InputPullup => "INPUT_PULLUP",

                    _ => "INPUT",
                };

                self.add_ln(lines, &format!("{}pinMode({}, {});", indent, pin, mode));
            }

            AslStatement::DigitalOutput(d) => {
                let pin = self.gen_expr(&d.pin);

                let val = self.gen_expr(&d.value);

                self.add_ln(lines, &format!("{}digitalWrite({}, {});", indent, pin, val));
            }

            AslStatement::DigitalInput(r) => {
                let pin = self.gen_expr(&r.pin);

                self.add_ln(
                    lines,
                    &format!("{}{} = digitalRead({});", indent, r.target, pin),
                );
            }

            AslStatement::AnalogInput(r) => {
                let pin = self.gen_expr(&r.pin);

                self.add_ln(
                    lines,
                    &format!("{}{} = analogRead({});", indent, r.target, pin),
                );
            }

            AslStatement::AnalogOutput(a) => {
                let pin = self.gen_expr(&a.pin);

                let val = self.gen_expr(&a.value);

                self.add_ln(lines, &format!("{}analogWrite({}, {});", indent, pin, val));
            }

            AslStatement::Delay(d) => {
                let ms = d.duration.total_ms();

                self.add_ln(lines, &format!("{}delay({});", indent, ms));
            }

            AslStatement::SerialBegin(s) => {
                let b = self.gen_expr(&s.baud);

                self.add_ln(lines, &format!("{}Serial.begin({});", indent, b));
            }

            AslStatement::Print(p) => {
                let args: Vec<String> = p.args.iter().map(|a| self.gen_expr(a)).collect();

                if args.is_empty() {
                    return;
                }

                if p.newline {
                    self.add_ln(lines, &format!("{}Serial.println({});", indent, args[0]));
                } else {
                    self.add_ln(lines, &format!("{}Serial.print({});", indent, args[0]));
                }
            }

            AslStatement::If(i) => {
                let cond = self.gen_expr(&i.condition);

                self.add_ln(lines, &format!("{}if ({}) {{", indent, cond));

                for b in &i.then_body {
                    self.gen_stmt(b, lines, &format!("{}  ", indent));
                }

                //   8.1     ElseIf Clauses

                for ei in &i.else_if {
                    let ei_cond = self.gen_expr(&ei.condition);

                    self.add_ln(lines, &format!("{}}} else if ({}) {{", indent, ei_cond));

                    for b in &ei.body {
                        self.gen_stmt(b, lines, &format!("{}  ", indent));
                    }
                }

                if let Some(eb) = &i.else_body {
                    self.add_ln(lines, &format!("{}}} else {{", indent));

                    for b in eb {
                        self.gen_stmt(b, lines, &format!("{}  ", indent));
                    }

                    self.add_ln(lines, &format!("{}}}", indent));
                } else {
                    self.add_ln(lines, &format!("{}}}", indent));
                }
            }

            AslStatement::While(w) => {
                let cond = self.gen_expr(&w.condition);

                self.add_ln(lines, &format!("{}while ({}) {{", indent, cond));

                for b in &w.body {
                    self.gen_stmt(b, lines, &format!("{}  ", indent));
                }

                self.add_ln(lines, &format!("{}}}", indent));
            }

            AslStatement::For(f) => {
                match f.as_ref() {
                    AslFor::Range(r) => {
                        let from = self.gen_expr(&r.from);

                        let to = self.gen_expr(&r.to);

                        let step = self.gen_expr(&r.step);

                        self.add_ln(
                            lines,
                            &format!(
                                "{}for (int {} = {}; {} < {}; {} += {}) {{",
                                indent, r.var, from, r.var, to, r.var, step
                            ),
                        );

                        for b in &r.body {
                            self.gen_stmt(b, lines, &format!("{}  ", indent));
                        }

                        self.add_ln(lines, &format!("{}}}", indent));
                    }

                    AslFor::Each(e) => {
                        let iter = self.gen_expr(&e.iterable);

                        self.add_ln(
                            lines,
                            &format!("{}for (auto {} : {}) {{", indent, e.var, iter),
                        );

                        for b in &e.body {
                            self.gen_stmt(b, lines, &format!("{}  ", indent));
                        }

                        self.add_ln(lines, &format!("{}}}", indent));
                    }

                    AslFor::CStyle(c) => {
                        // C-style for

                        self.add_ln(lines, &format!("{}for (", indent));

                        // Simplifica    o: apenas primeiro init

                        if let Some(first) = c.init.first() {
                            let mut temp = vec![];

                            self.gen_stmt(first, &mut temp, "");

                            let init_str = temp.join(" ").trim_end_matches(';').to_string();

                            if let Some(last) = lines.last_mut() {
                                *last += &init_str;
                            }
                        }

                        if let Some(last) = lines.last_mut() {
                            *last += &format!("; {}; ", self.gen_expr(&c.condition));
                        }

                        if let Some(first) = c.update.first() {
                            let mut temp = vec![];

                            self.gen_stmt(first, &mut temp, "");

                            let up_str = temp.join(" ").trim_end_matches(';').to_string();

                            if let Some(last) = lines.last_mut() {
                                *last += &format!("{}) {{", up_str);
                            }
                        } else {
                            if let Some(last) = lines.last_mut() {
                                *last += ") {";
                            }
                        }

                        for b in &c.body {
                            self.gen_stmt(b, lines, &format!("{}  ", indent));
                        }

                        self.add_ln(lines, &format!("{}}}", indent));
                    }
                }
            }

            AslStatement::Return(r) => {
                if let Some(v) = &r.value {
                    let val = self.gen_expr(v);

                    self.add_ln(lines, &format!("{}return {};", indent, val));
                } else {
                    self.add_ln(lines, &format!("{}return;", indent));
                }
            }

            AslStatement::Break => {
                self.add_ln(lines, &format!("{}break;", indent));
            }

            AslStatement::Continue => {
                self.add_ln(lines, &format!("{}continue;", indent));
            }

            AslStatement::Expr(e) => {
                let ex = self.gen_expr(&e.expr);

                self.add_ln(lines, &format!("{}{};", indent, ex));
            }

            AslStatement::ServoAttach(s) => {
                let pin = self.gen_expr(&s.pin);

                self.add_ln(lines, &format!("{}{}.attach({});", indent, s.var_name, pin));
            }

            AslStatement::ServoWrite(s) => {
                let angle_str = self.gen_expr(&s.angle);

                // Conforme ASL v1.2.3, write()    o padr  o.

                self.add_ln(
                    lines,
                    &format!("{}{}.write({});", indent, s.var_name, angle_str),
                );
            }

            AslStatement::ServoDetach(s) => {
                self.add_ln(lines, &format!("{}{}.detach();", indent, s.var_name));
            }

            AslStatement::UartWrite(u) => {
                let data = self.gen_expr(&u.data);

                self.add_ln(lines, &format!("{}Serial.write({});", indent, data));
            }

            AslStatement::I2cWrite(i) => {
                let addr = self.gen_expr(&i.address);

                let data = self.gen_expr(&i.data);

                self.add_ln(
                    lines,
                    &format!("{}Wire.beginTransmission({});", indent, addr),
                );

                self.add_ln(lines, &format!("{}Wire.write({});", indent, data));

                self.add_ln(lines, &format!("{}Wire.endTransmission();", indent));
            }

            AslStatement::I2cRead(i) => {
                let addr = self.gen_expr(&i.address);

                let len = self.gen_expr(&i.length);

                self.add_ln(
                    lines,
                    &format!("{}Wire.requestFrom({}, {});", indent, addr, len),
                );

                self.add_ln(lines, &format!("{}{} = Wire.read();", indent, i.target));
            }

            // PWM statements - handle pwm_init and pwm_set_duty from embedded Rust
            AslStatement::PwmInit(p) => {
                let pin = self.gen_expr(&p.pin);
                let freq = self.gen_expr(&p.freq);
                // Arduino: use analogWrite range (0-255), but first need to set pinMode to OUTPUT
                // For simplicity, we just note the init with a comment since Arduino uses analogWrite
                self.add_ln(
                    lines,
                    &format!("{}// PWM init: pin={}, freq={}", indent, pin, freq),
                );
                // Set pinMode to OUTPUT for PWM
                self.add_ln(lines, &format!("{}pinMode({}, OUTPUT);", indent, pin));
            }

            AslStatement::PwmSetDuty(p) => {
                let pin = self.gen_expr(&p.pin);
                let duty = self.gen_expr(&p.duty);
                // Arduino uses analogWrite(pin, duty) - accepts 0-255
                self.add_ln(lines, &format!("{}analogWrite({}, {});", indent, pin, duty));
            }

            _ => {
                self.add_ln(lines, &format!("{}// Unhandled ASL Statement", indent));
            }
        }
    }
}

impl AslGenerator for CGenerator {
    fn generate(&mut self, program: &AslProgram) -> GeneratorOutput {
        self.source_map.clear();

        self.current_line = 1;

        self.shims.reset_runtime();

        let mut lines: Vec<String> = Vec::with_capacity(256);

        self.scan_for_shims(program);

        self.add_ln(&mut lines, "// Generated C++ / Arduino Code");

        self.add_ln(&mut lines, "#include <Arduino.h>");

        let shim_code = self.shims.get_required_shims_code();

        if !shim_code.is_empty() {
            for line in shim_code.lines() {
                self.add_ln(&mut lines, line);
            }
        }

        self.add_ln(&mut lines, "");

        let _has_setup = program
            .functions
            .iter()
            .find(|f| f.name == "setup")
            .is_some()
            || program.tasks.iter().find(|t| t.name == "setup").is_some();

        let _has_loop = program
            .functions
            .iter()
            .find(|f| f.name == "loop")
            .is_some()
            || program.tasks.iter().find(|t| t.name == "loop").is_some();

        let _has_main = program
            .functions
            .iter()
            .find(|f| f.name == "main")
            .is_some()
            || program.tasks.iter().find(|t| t.name == "main").is_some();

        // Check if we have a setup+loop task structure
        let has_setup = program.tasks.iter().any(|t| t.name == "setup");
        let has_loop = program.tasks.iter().any(|t| t.name == "loop");

        // If we have setup and loop, we should NOT emit globals here -
        // they'll be handled specially in setup/loop generation
        if !(has_setup && has_loop) {
            for global in &program.globals {
                let val = global
                    .value
                    .as_ref()
                    .map(|v| self.gen_expr(v))
                    .unwrap_or_else(|| "0".to_string());

                let t_str = match global.r#type {
                    AslType::Int
                    | AslType::Int32
                    | AslType::Int16
                    | AslType::Short
                    | AslType::Sint8 => "int",

                    AslType::Uint
                    | AslType::Uint32
                    | AslType::Uint16
                    | AslType::Byte
                    | AslType::Uint8 => "int",

                    AslType::Float | AslType::Double => "float",

                    AslType::Bool => "bool",

                    AslType::String => "String",

                    AslType::Auto => "int", // Default for untyped constants like LED_PIN

                    _ => "int",
                };

                // Ensure we have a valid name (fallback for malformed const declarations)
                let var_name = if global.name.is_empty() {
                    "_UNNAMED".to_string()
                } else {
                    global.name.clone()
                };

                self.add_ln(&mut lines, &format!("{} {} = {};", t_str, var_name, val));
            }

            if !program.globals.is_empty() {
                self.add_ln(&mut lines, "");
            }
        }

        // Helper to detect infinite while loops (loop {} in Rust maps to while(true) {})
        fn is_infinite_while_loop(stmt: &AslStatement) -> bool {
            if let AslStatement::While(w) = stmt {
                if let AslExpr::Literal(l) = &w.condition {
                    if l.value.as_bool() == Some(true) {
                        return true;
                    }
                }
            }
            false
        }

        // Suporte a Tasks R7

        for task in &program.tasks {
            if task.name == "setup" {
                self.add_ln(&mut lines, "void setup() {");

                for stmt in &task.body {
                    // Check for infinite while loop (loop {} equivalent) and skip it - it goes to loop()
                    if is_infinite_while_loop(stmt) {
                        continue;
                    }
                    self.gen_stmt(stmt, &mut lines, "  ");
                }

                self.add_ln(&mut lines, "}");

                self.add_ln(&mut lines, "");
            } else if task.name == "loop" {
                self.add_ln(&mut lines, "void loop() {");

                // Collect all variable names that need to persist in loop()
                // Variables can come from: globals, setup() declarations, or setup() assignments
                let mut all_var_names: std::collections::HashSet<String> =
                    std::collections::HashSet::new();

                // From globals
                for global in &program.globals {
                    all_var_names.insert(global.name.clone());
                }

                // From setup()
                if let Some(setup_task) = program.tasks.iter().find(|t| t.name == "setup") {
                    for stmt in &setup_task.body {
                        match stmt {
                            AslStatement::Declare(d) => {
                                all_var_names.insert(d.name.clone());
                            }
                            AslStatement::Assign(a) => {
                                all_var_names.insert(a.target.clone());
                            }
                            _ => {}
                        }
                    }
                }

                // Find which of these variables are used in the loop body
                let loop_task = program.tasks.iter().find(|t| t.name == "loop");
                let mut loop_var_names: Vec<String> = Vec::new();

                if let Some(lt) = loop_task {
                    for var_name in &all_var_names {
                        for stmt in &lt.body {
                            if self.stmt_uses_var(stmt, var_name) {
                                loop_var_names.push(var_name.clone());
                                break;
                            }
                        }
                    }
                }

                // Generate static declarations for variables used in loop
                for var_name in &loop_var_names {
                    // Find the variable in globals first, then in setup body
                    let (name, val, var_type) = if let Some(global) =
                        program.globals.iter().find(|g| &g.name == var_name)
                    {
                        let val = global
                            .value
                            .as_ref()
                            .map(|v| self.gen_expr(v))
                            .unwrap_or_else(|| "0".to_string());
                        (global.name.clone(), val, global.r#type.clone())
                    } else if let Some(setup_task) =
                        program.tasks.iter().find(|t| t.name == "setup")
                    {
                        // Look in setup for the declaration
                        if let Some(stmt) = setup_task.body.iter().find(|s| match s {
                            AslStatement::Declare(d) => &d.name == var_name,
                            AslStatement::Assign(a) => &a.target == var_name,
                            _ => false,
                        }) {
                            match stmt {
                                AslStatement::Declare(d) => {
                                    let val = d
                                        .value
                                        .as_ref()
                                        .map(|v| self.gen_expr(v))
                                        .unwrap_or_else(|| "0".to_string());
                                    (d.name.clone(), val, d.r#type.clone())
                                }
                                AslStatement::Assign(a) => {
                                    let val = self.gen_expr(&a.value);
                                    (a.target.clone(), val, AslType::Int)
                                }
                                _ => continue,
                            }
                        } else {
                            continue;
                        }
                    } else {
                        continue;
                    };

                    let t_str = match var_type {
                        AslType::Int
                        | AslType::Int32
                        | AslType::Int16
                        | AslType::Short
                        | AslType::Sint8 => "int",
                        AslType::Uint
                        | AslType::Uint32
                        | AslType::Uint16
                        | AslType::Byte
                        | AslType::Uint8 => "int",
                        AslType::Float | AslType::Double => "float",
                        AslType::Bool => "bool",
                        _ => "int",
                    };

                    self.add_ln(
                        &mut lines,
                        &format!("  static {} {} = {};", t_str, name, val),
                    );
                }

                for stmt in &task.body {
                    self.gen_stmt(stmt, &mut lines, "  ");
                }

                self.add_ln(&mut lines, "}");

                self.add_ln(&mut lines, "");
            } else {
                // Outras tarefas como fun    es void por agora

                self.add_ln(&mut lines, &format!("void {}(", task.name));

                // params...

                self.add_ln(&mut lines, ") {");

                for stmt in &task.body {
                    self.gen_stmt(stmt, &mut lines, "  ");
                }

                self.add_ln(&mut lines, "}");

                self.add_ln(&mut lines, "");
            }
        }

        for func in &program.functions {
            let params: Vec<String> = func
                .params
                .iter()
                .map(|p| format!("{} {}", p.r#type, p.name))
                .collect();

            let ret = match &func.return_type {
                Some(AslType::Int) | Some(AslType::Int32) => "int",

                Some(AslType::Float) => "float",

                Some(AslType::Bool) => "bool",

                Some(AslType::String) => "String",

                _ => "void",
            };

            self.add_ln(
                &mut lines,
                &format!("{} {}({}) {{", ret, func.name, params.join(", ")),
            );

            for stmt in &func.body {
                self.gen_stmt(stmt, &mut lines, "  ");
            }

            self.add_ln(&mut lines, "}");

            self.add_ln(&mut lines, "");
        }

        GeneratorOutput {
            code: lines.join("\n"),

            map: self.source_map.clone(),

            files: None,
        }
    }
}

fn default_c_shims() -> Vec<ShimDefinition> {
    vec![
        ShimDefinition::new("servo", "#include <Servo.h>")
            .with_description("Arduino Servo library"),
        ShimDefinition::new("wire", "#include <Wire.h>").with_description("I2C library"),
        ShimDefinition::new("sevseg", "#include <SevSeg.h>")
            .with_description("Seven-segment display library"),
    ]
}
