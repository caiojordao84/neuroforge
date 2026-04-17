import tree_sitter_python
from tree_sitter import Language, Parser

PY_LANGUAGE = Language(tree_sitter_python.language())
parser = Parser(PY_LANGUAGE)

code = """
if not o:
    set_valvula(True)
else:
    set_valvula(False)
"""

tree = parser.parse(bytes(code, "utf8"))

def print_tree(node, depth=0):
    print("  " * depth + f"{node.type} ({node.start_byte}-{node.end_byte}): {code[node.start_byte:node.end_byte]}")
    for child in node.children:
        print_tree(child, depth + 1)

print_tree(tree.root_node)
