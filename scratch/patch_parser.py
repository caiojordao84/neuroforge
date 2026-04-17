import os
import re

path = r"d:\Documents\NeuroForge\neuroforge\crates\neuroforge-asl\src\plugins\python\python_parser.rs"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix 1: visit_binary op_text (line 787 approx)
# Search for the block I created earlier
old_visit_binary = """        let op_text = {
            let mut cursor = node.walk();
            node.children(&mut cursor)
                .find(|c| !c.is_named())
                .map(|c| self.text(c))
                .unwrap_or_else(|| "+".to_string())
        };"""

# Actually, the failing code according to the last build was:
failing_line = 'let op = node.children(&mut cursor).find(|c| !c.is_named()).map(|c| self.text(c)).unwrap_or("+".to_string());'
correct_line = 'let op = node.children(&mut cursor).find(|c| !c.is_named()).map(|c| self.text(c)).unwrap_or("+");'

content = content.replace(failing_line, correct_line)

# Fix 2: Remove unused variable 'first' at line 418
content = content.replace("let mut first = true;", "")
content = content.replace("first = false;", "")

# Fix 3: Remove unused import AslLiteral at line 41
content = content.replace("AslIf, AslLiteral, AslLog,", "AslIf, AslLog,")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("Fixes applied.")
