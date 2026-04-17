import os

path = r"d:\Documents\NeuroForge\neuroforge\crates\neuroforge-asl\src\plugins\python\python_parser.rs"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Fix named_child casting
content = content.replace(
    "node.named_child(node.named_child_count().saturating_sub(1))",
    "node.named_child(node.named_child_count().saturating_sub(1) as u32)"
)

# 2. Fix unwrap_or_else and match in visit_binary
content = content.replace(
    '.unwrap_or_else(|| "+".to_string())',
    '.unwrap_or_else(|| "+".to_string())' # This was actually OK if String expected, but let's see.
)
# The error was in match op_text.as_str()
content = content.replace(
    "let op = match op_text.as_str() {",
    "let op = match op_text.as_str() {" # Stable String::as_str
)
# Wait, let's fix the match more robustly:
content = content.replace(
    "match op_text.as_str() {",
    "match op_text.as_ref() {"
)

# 3. Fix AslDeclare missing fields
old_declare = """                AslStatement::Declare(crate::asl_types::AslDeclare {
                    name: target,
                    r#type: crate::asl_types::AslType::Auto,
                    value: Some(value),
                    mutable: true,
                })"""

new_declare = """                AslStatement::Declare(crate::asl_types::AslDeclare {
                    name: target,
                    r#type: crate::asl_types::AslType::Auto,
                    value: Some(value),
                    mutable: true,
                    scope: "local".to_string(),
                    lifecycle: "normal".to_string(),
                    ..Default::default()
                })"""

content = content.replace(old_declare, new_declare)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Fixed common compilation errors in python_parser.rs.")
