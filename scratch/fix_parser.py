import os

path = r"d:\Documents\NeuroForge\neuroforge\crates\neuroforge-asl\src\plugins\python\python_parser.rs"
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Find the start of visit_assignment
start_idx = -1
for i, line in enumerate(lines):
    if "fn visit_assignment" in line:
        start_idx = i
        break

if start_idx == -1:
    print("Could not find visit_assignment")
    exit(1)

# Find the end of visit_assignment (before visit_if)
end_idx = -1
for i, line in enumerate(lines[start_idx:], start_idx):
    if "fn visit_if" in line:
        end_idx = i
        break

if end_idx == -1:
    print("Could not find visit_if")
    exit(1)

# Construct the correct visit_assignment function
# Note: I'll use the logic from the plan.
new_func = [
    "    fn visit_assignment(&mut self, node: Node) -> AslStatement {\n",
    "        let raw_target = node\n",
    "            .child_by_field_name(\"left\")\n",
    "            .map(|n| self.text(n).to_string())\n",
    "            .unwrap_or_default();\n",
    "            \n",
    "        let target = self.resolve_name(&raw_target);\n",
    "\n",
    "        let right = node.child_by_field_name(\"right\");\n",
    "        \n",
    "        if let Some(r) = right {\n",
    "            // Check for hardware objects\n",
    "            let r_text = self.text(r);\n",
    "            if r_text.contains(\"Pin(\") || r_text.contains(\"PWM(\") || r_text.contains(\"ADC(\") || r_text.contains(\"I2C(\") || r_text.contains(\"HCSR04(\") || r_text.contains(\"I2cLcd(\") {\n",
    "                self.global_names.insert(target.clone());\n",
    "            }\n",
    "\n",
    "            if r.kind() == \"call\" {\n",
    "                let func_node = r.child_by_field_name(\"function\");\n",
    "\n",
    "                if let Some(f) = func_node {\n",
    "                    let func_text = self.text(f);\n",
    "\n",
    "                    if func_text == \"machine.Pin\" || func_text == \"Pin\" {\n",
    "                        let arg_node = r.child_by_field_name(\"arguments\");\n",
    "\n",
    "                        if let Some(args_node) = arg_node {\n",
    "                            let mut cursor = args_node.walk();\n",
    "                            let first_arg_node = args_node.children(&mut cursor).find(|c| c.is_named());\n",
    "\n",
    "                            if let Some(first_arg) = first_arg_node {\n",
    "                                let first_text = self.text(first_arg);\n",
    "                                let pin_val = if let Ok(p) = first_text.parse::<i64>() {\n",
    "                                    p\n",
    "                                } else if let Some(&p) = self.var_to_pin.get(first_text) {\n",
    "                                    p\n",
    "                                } else {\n",
    "                                    0\n",
    "                                };\n",
    "\n",
    "                                if pin_val > 0 || first_text == \"0\" {\n",
    "                                    let mode = if self.text(args_node).contains(\"OUT\") {\n",
    "                                        PinModeKind::Output\n",
    "                                    } else {\n",
    "                                        PinModeKind::Input\n",
    "                                    };\n",
    "\n",
    "                                    self.pin_to_mode.insert(pin_val, mode);\n",
    "                                    self.var_to_pin.insert(target.clone(), pin_val);\n",
    "                                }\n",
    "                                \n",
    "                                // Promote pin variable to [Data]\n",
    "                                return AslStatement::Assign(crate::asl_types::AslAssign {\n",
    "                                    target,\n",
    "                                    value: AslExpr::int(pin_val),\n",
    "                                });\n",
    "                            }\n",
    "                        }\n",
    "                    } else if func_text == \"PWM\" || func_text == \"ADC\" {\n",
    "                        // Infer mode from usage\n",
    "                        let arg_node = r.child_by_field_name(\"arguments\");\n",
    "                        if let Some(args_node) = arg_node {\n",
    "                            let mut cur = args_node.walk();\n",
    "                            let first_arg_node = args_node.children(&mut cur).find(|c| c.is_named());\n",
    "                            if let Some(first_arg) = first_arg_node {\n",
    "                                let first_text = self.text(first_arg);\n",
    "                                if let Some(&p) = self.var_to_pin.get(first_text) {\n",
    "                                    let mode = if func_text == \"PWM\" { PinModeKind::Output } else { PinModeKind::Input };\n",
    "                                    self.pin_to_mode.insert(p, mode);\n",
    "                                }\n",
    "                            }\n",
    "                        }\n",
    "                    }\n",
    "                }\n",
    "            }\n",
    "\n",
    "            let value = self.visit_expr(r);\n",
    "            \n",
    "            if self.is_in_function && !self.globals_in_scope.contains(&raw_target) && !self.global_names.contains(&target) {\n",
    "                AslStatement::Declare(crate::asl_types::AslDeclare {\n",
    "                    name: target,\n",
    "                    r#type: crate::asl_types::AslType::Auto,\n",
    "                    value: Some(value),\n",
    "                    mutable: true,\n",
    "                })\n",
    "            } else {\n",
    "                AslStatement::Assign(crate::asl_types::AslAssign {\n",
    "                    target,\n",
    "                    value,\n",
    "                })\n",
    "            }\n",
    "        } else {\n",
    "            AslStatement::Comment(crate::asl_types::AslComment {\n",
    "                text: format!(\"Erro no assignment de {}\", target),\n",
    "            })\n",
    "        }\n",
    "    }\n",
    "\n"
]

# Replace the lines
final_lines = lines[:start_idx] + new_func + lines[end_idx:]

with open(path, "w", encoding="utf-8") as f:
    f.writelines(final_lines)

print("visit_assignment fixed successfully.")
