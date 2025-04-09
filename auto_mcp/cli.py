import argparse
import sys
import subprocess
from pathlib import Path

# Determine the location of the templates relative to this file
_CLI_DIR = Path(__file__).parent
_TEMPLATE_DIR = _CLI_DIR / "cli_templates"


def create_mcp_server_file(directory: Path, framework: str) -> None:
    """Create an mcp_server.py file in the specified directory using a template."""
    # LAZY HACK
    template_file = _TEMPLATE_DIR / f"{framework}_automcp.py.template"

    if not template_file.exists():
        raise ValueError(f"Template file not found for framework: {framework}")

    with open(template_file, "r") as f:
        content = f.read()

    # Remove the cursor placeholder if it exists (it was mainly for crewai)
    content = content.replace("<CURRENT_CURSOR_POSITION>\n", "")

    file_path = directory / "automcp.py"
    with open(file_path, "w") as f:
        f.write(content)

    print(f"Created {file_path} from {framework} template.")

def init_command(args) -> None:
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
    print(f"1. Edit {current_dir / 'automcp.py'} to import and configure your {args.framework} agent/crew/graph")
    print(f"2. Review {current_dir / 'pyproject.toml'} to ensure dependencies are correct.")
    print("3. Run 'uv sync' or 'pip install -e .' to install dependencies including auto_mcp")
    print("4. Run your MCP server using one of these commands:")
    print("   - automcp serve         # For STDIO transport (default)")
    print("   - automcp serve sse     # For SSE transport")
    print("   - uv run serve_stdio           # Using the script entry point (if using uv)")
    print("   - uv run serve_sse             # Using the script entry point (if using uv)")


def serve_command(args) -> None:
    """Run the AutoMCP server."""
    print(f"Running AutoMCP server with {args.transport} transport")
    current_dir = Path.cwd()
    
    automcp_file = current_dir / "automcp.py"
    if not automcp_file.exists():
        raise ValueError("automcp.py not found in current directory")
    
    venv_dir = current_dir / ".venv"
    if not venv_dir.exists():
        pyproject_file = current_dir / "pyproject.toml"
        if not pyproject_file.exists():
            raise ValueError("No venv found and no pyproject.toml to create one")
        
        try:
            subprocess.run(["uv", "venv"], check=True)
            # TODO: remove --no-cache once testing phase is done
            subprocess.run(["uv", "sync", "--no-cache"], check=True)
            
            # This is to install the auto-mcp package
            requirements_file = current_dir / "requirements.txt"
            if requirements_file.exists():
                subprocess.run(["uv", "add", "-r", str(requirements_file)], check=True)
        except subprocess.CalledProcessError as e:
            print(f"Error setting up environment: {e}", file=sys.stderr)
            sys.exit(1)
    
    try:
        if args.transport == "stdio":
            subprocess.run(["uv", "run", str(automcp_file)], check=True)
        elif args.transport == "sse":
            subprocess.run(["uv", "run", str(automcp_file), "sse"], check=True)
        else:
            raise ValueError(f"Invalid transport: {args.transport}")
    except subprocess.CalledProcessError as e:
        print(f"Error running AutoMCP server: {e}", file=sys.stderr)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="AutoMCP - Convert agents to MCP servers")
    subparsers = parser.add_subparsers(dest="command", help="Command to run", required=True) # Make command required

    # init command
    init_parser = subparsers.add_parser("init", help="Create a new MCP server configuration")
    init_parser.add_argument(
        "-f",
        "--framework",
        choices=[
            "crewai_orchestrator", "langgraph", "pydantic", "llamaindex", 
            "openai", "crewai_tool", "langchain_tool", "crewai_agent",
            "mcp_agent"
        ],
        required=True,
        help="Agent framework to use (crewai_orchestrator, langgraph, pydantic, llamaindex, openai, crewai_tool, langchain_tool, crewai_agent)"
    )
    init_parser.set_defaults(func=init_command)

    # serve command
    serve_parser = subparsers.add_parser("serve", help="Run the AutoMCP server")
    serve_parser.add_argument(
        "-t",
        "--transport",
        nargs="?",
        choices=["stdio", "sse"],
        default="stdio",
        help="Transport to use (stdio or sse, defaults to stdio)"
    )
    serve_parser.set_defaults(func=serve_command)

    # Parse args and call the appropriate function
    args = parser.parse_args()
    args.func(args)

if __name__ == "__main__":
    main()