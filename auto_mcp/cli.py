import argparse
import os
import sys
import toml
from pathlib import Path
# Determine the location of the templates relative to this file
_CLI_DIR = Path(__file__).parent
_TEMPLATE_DIR = _CLI_DIR / "cli_templates"


def create_mcp_server_file(directory: Path, framework: str) -> None:
    """Create an mcp_server.py file in the specified directory using a template."""
    # LAZY HACK
    if framework == 'pydantic':
        framework = 'langgraph'
    template_file = _TEMPLATE_DIR / f"{framework}_mcp_server.py.template"

    if not template_file.exists():
        raise ValueError(f"Template file not found for framework: {framework}")

    with open(template_file, "r") as f:
        content = f.read()

    # Remove the cursor placeholder if it exists (it was mainly for crewai)
    content = content.replace("<CURRENT_CURSOR_POSITION>\n", "")

    file_path = directory / "mcp_server.py"
    with open(file_path, "w") as f:
        f.write(content)

    print(f"Created {file_path} from {framework} template.")

def new_command(args) -> None:
    """Create new MCP server files in the current directory."""
    current_dir = Path.cwd()

    # Create mcp_server.py
    try:
        create_mcp_server_file(current_dir, args.framework)
    except ValueError as e:
        print(f"Error creating server file: {e}", file=sys.stderr)
        sys.exit(1)
    except IOError as e:
        print(f"Error writing server file: {e}", file=sys.stderr)
        sys.exit(1)


    print("\nSetup complete! Next steps:")
    print(f"1. Edit {current_dir / 'mcp_server.py'} to import and configure your {args.framework} agent/crew/graph")
    print(f"2. Review {current_dir / 'pyproject.toml'} to ensure dependencies are correct.")
    print("3. Run 'uv sync' or 'pip install -e .' to install dependencies including auto_mcp")
    print("4. Run your MCP server using one of these commands:")
    print("   - python -m mcp_server         # For STDIO transport (default)")
    print("   - python -m mcp_server sse     # For SSE transport")
    print("   - uv run serve_stdio           # Using the script entry point (if using uv)")
    print("   - uv run serve_sse             # Using the script entry point (if using uv)")

def main():
    parser = argparse.ArgumentParser(description="AutoMCP - Convert agents to MCP servers")
    subparsers = parser.add_subparsers(dest="command", help="Command to run", required=True) # Make command required

    # New command
    new_parser = subparsers.add_parser("new", help="Create a new MCP server configuration")
    new_parser.add_argument(
        "-f",
        "--framework",
        choices=["crewai", "langgraph", "pydantic"],
        required=True,
        help="Agent framework to use (default: crewai)"
    )
    new_parser.set_defaults(func=new_command)

    # Parse args and call the appropriate function
    args = parser.parse_args()

    # The command is now required by subparsers, so no need to check args.command explicitly
    # Call the function associated with the chosen subparser
    args.func(args)


if __name__ == "__main__":
    main()