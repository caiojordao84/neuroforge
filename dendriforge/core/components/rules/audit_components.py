"""Batch audit all component .toon files against the ruleset."""
import sys, os, re, json

sys.path.insert(0, os.path.dirname(__file__))
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from toon_component_validator import validate_component, ValidationError

COMP_DIR = os.path.join(os.path.dirname(__file__), '..')
files = sorted(f for f in os.listdir(COMP_DIR) if f.endswith('.toon'))

results = {}
for fname in files:
    path = os.path.join(COMP_DIR, fname)
    with open(path, encoding='utf-8') as f:
        content = f.read()
    try:
        result = validate_component(content, strict=False)
    except Exception as e:
        results[fname] = {"valid": False, "error": str(e)}
        continue
    
    errors = [{"line": e.line, "rule": e.rule, "snippet": e.snippet} for e in result.errors]
    results[fname] = {
        "valid": result.valid,
        "errors": errors,
        "stats": {
            "sections": result.stats.section_count,
            "ports": result.stats.port_count,
            "params": result.stats.param_count,
            "warnings_count": result.stats.warning_count,
            "tags": result.stats.tag_count,
        }
    }

# Summary
valid_count = sum(1 for r in results.values() if r["valid"])
invalid_count = sum(1 for r in results.values() if not r["valid"])
total = len(results)

print(f"=== AUDIT SUMMARY ===")
print(f"Total files: {total}")
print(f"Valid: {valid_count}")
print(f"Invalid: {invalid_count}")
print()

if invalid_count > 0:
    print("=== INVALID FILES ===")
    for fname in sorted(results.keys()):
        r = results[fname]
        if not r["valid"]:
            if "error" in r:
                print(f"  {fname}: ERROR - {r['error']}")
            else:
                print(f"  {fname}: {len(r['errors'])} error(s)")
                for e in r['errors'][:5]:
                    print(f"    L{e['line']}: {e['rule']}")
                    print(f"      -> {e['snippet']}")
                if len(r['errors']) > 5:
                    print(f"    ... and {len(r['errors'])-5} more errors")
    print()

# Stats
print("=== STATS ===")
print(f"{'File':40s} {'Sections':10s} {'Ports':10s} {'Params':10s} {'Warnings':10s} {'Tags':10s}")
print("-"*90)
for fname in sorted(results.keys()):
    r = results[fname]
    s = r["stats"]
    v = "[OK]" if r["valid"] else "[!!]"
    if "error" in r:
        print(f"{fname:40s} ERROR")
    else:
        print(f"{fname:40s} {s['sections']:<10d} {s['ports']:<10d} {s['params']:<10d} {s['warnings_count']:<10d} {s['tags']:<10d} {v}")
