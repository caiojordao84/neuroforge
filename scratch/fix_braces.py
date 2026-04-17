import os

path = r"d:\Documents\NeuroForge\neuroforge\crates\neuroforge-asl\src\plugins\python\python_parser.rs"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix the missing brace between visit_conditional_expression and visit_assignment
# It currently looks like:
#         }))
#     fn visit_assignment...
# Should be:
#         }))
#     }
#
#     fn visit_assignment...

content = content.replace(
    "        }))\n    fn visit_assignment",
    "        }))\n    }\n\n    fn visit_assignment"
)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Balanced braces for visit_assignment.")
