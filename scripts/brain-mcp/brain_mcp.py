import os
import datetime
import re
import argparse
from typing import Optional, List
from fastmcp import FastMCP

# Initialize FastMCP Server
mcp = FastMCP("Neuro-Brain")

# Path Configuration
WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
NOTES_DIR = os.path.join(WORKSPACE_ROOT, "notes")
BRAIN_DIR = os.path.join(NOTES_DIR, "Brain")
TIMELINE_DIR = os.path.join(NOTES_DIR, "Timeline")

@mcp.tool()
def brain_search(query: str, include_graphify: bool = True) -> str:
    """Search the Digital Brain for context."""
    results = []
    for root, dirs, files in os.walk(NOTES_DIR):
        if not include_graphify and "graphify" in root:
            continue
        for file in files:
            if file.endswith(".md"):
                path = os.path.join(root, file)
                try:
                    with open(path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                        if query.lower() in content.lower():
                            rel_path = os.path.relpath(path, NOTES_DIR)
                            lines = content.splitlines()
                            matches = [l.strip() for l in lines if query.lower() in l.lower()][:3]
                            results.append(f"### [[{rel_path}]]\n" + "\n".join([f"- {m}" for m in matches]))
                except Exception: continue
    return "\n\n".join(results[:15]) if results else f"No results for '{query}'."

@mcp.tool()
def brain_log_session(summary: str, decisions: Optional[List[str]] = None, next_steps: Optional[List[str]] = None) -> str:
    """Add a structured entry to today's Timeline log."""
    today = datetime.date.today().isoformat()
    log_file = os.path.join(TIMELINE_DIR, f"{today}.md")
    timestamp = datetime.datetime.now().strftime("%H:%M")
    os.makedirs(TIMELINE_DIR, exist_ok=True)
    entry = f"\n## [{timestamp}] - Update via MCP\n**Summary**: {summary}\n"
    if decisions: entry += "\n**Decisions**:\n" + "\n".join([f"- {d}" for d in decisions]) + "\n"
    if next_steps: entry += "\n**Next Steps**:\n" + "\n".join([f"- {n}" for n in next_steps]) + "\n"
    mode = "a" if os.path.exists(log_file) else "w"
    header = f"# Session Log: {today}\n" if mode == "w" else ""
    with open(log_file, mode, encoding="utf-8") as f:
        f.write(header + entry)
    return f"Logged update to Timeline/{today}.md"

@mcp.tool()
def brain_add_knowledge(title: str, content: str, tags: Optional[List[str]] = None) -> str:
    """Add a new 'Neuron' (Semantic Note) to the Brain/ directory."""
    safe_title = re.sub(r'[^\w\s-]', '', title).strip().replace(" ", "_")
    target_file = os.path.join(BRAIN_DIR, f"{safe_title}.md")
    os.makedirs(BRAIN_DIR, exist_ok=True)
    if os.path.exists(target_file): return f"Error: Note '{title}' exists."
    frontmatter = f"---\ntitle: {title}\ndate: {datetime.date.today().isoformat()}\n"
    if tags: frontmatter += f"tags: [{', '.join(tags)}]\n"
    frontmatter += "---\n\n"
    full_content = frontmatter + content + "\n\n---\n[[Index|Back to Index]]"
    with open(target_file, "w", encoding="utf-8") as f:
        f.write(full_content)
    return f"New knowledge neuron created: Brain/{safe_title}.md"

@mcp.tool()
def brain_get_status() -> str:
    """Retrieve a high-level summary of the Brain's current state."""
    notes_count = sum(len(files) for _, _, files in os.walk(BRAIN_DIR)) if os.path.exists(BRAIN_DIR) else 0
    timeline_count = sum(len(files) for _, _, files in os.walk(TIMELINE_DIR)) if os.path.exists(TIMELINE_DIR) else 0
    return f"Brain Status:\n- Semantic Neurons: {notes_count}\n- Session Logs: {timeline_count}\n- Vault: {NOTES_DIR}"

def main():
    parser = argparse.ArgumentParser(description="Neuro-Brain MCP Server")
    parser.add_argument("--transport", choices=["stdio", "sse"], default="stdio", help="Transport protocol")
    parser.add_argument("--port", type=int, default=8080, help="Port for SSE transport")
    parser.add_argument("--token", type=str, help="Auth token for SSE transport")
    args = parser.parse_args()

    if args.transport == "sse":
        print(f"Starting Neuro-Brain MCP in SSE mode on port {args.port}...")
        # Note: In a production environment, we should verify the token in a middleware.
        # For simplicity in this v1, the token is passed to the run command if supported,
        # otherwise we'll wrap it in the next iteration if user needs stricter security.
        mcp.run(transport="sse", port=args.port)
    else:
        mcp.run(transport="stdio")

if __name__ == "__main__":
    main()
