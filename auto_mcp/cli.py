import argparse
import os
import sys
import toml
from pathlib import Path

def create_mcp_server_file(directory: Path, framework: str) -> None:
    """Create an mcp_server.py file in the specified directory."""
    if framework == "crewai":
        content = """import warnings
from typing import Any
from auto_mcp.adapters.crewai_adapter import CrewAIAdapter
from pydantic import BaseModel
from mcp.server.fastmcp import FastMCP

# Create MCP server
mcp = FastMCP("MCP Server")

# Suppress warnings that might interfere with STDIO transport
warnings.filterwarnings("ignore")

# You'll need to replace these imports with your actual crew class
# from your_module import YourCrewClass

# Define the input schema for your crew
class InputSchema(BaseModel):
    # Replace these with your actual input parameters
    parameter1: str
    parameter2: str
    # Add more parameters as needed

# Create an adapter for CrewAI
adapter = CrewAIAdapter()

# Add your crew to the MCP server
# Uncomment and modify this code when you have your crew class ready
'''
adapter.add_to_mcp(
    mcp=mcp,
    framework_obj=YourCrewClass,  # Replace with your actual crew class
    name="Your Crew Name",        # Replace with your crew name
    description="Description of what your crew does",
    input_schema=InputSchema,
)
'''

# Server entrypoints
def serve_sse():
    mcp.run(transport="sse")

def serve_stdio():
    # Redirect stderr to suppress warnings that bypass the filters
    import os
    import sys
    
    class NullWriter:
        def write(self, *args, **kwargs):
            pass
        def flush(self, *args, **kwargs):
            pass
    
    # Save the original stderr
    original_stderr = sys.stderr
    
    # Replace stderr with our null writer to prevent warnings from corrupting STDIO
    sys.stderr = NullWriter()
    
    # Set environment variable to ignore Python warnings
    os.environ["PYTHONWARNINGS"] = "ignore"
    
    try:
        mcp.run(transport="stdio")
    finally:
        # Restore stderr for normal operation
        sys.stderr = original_stderr

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "sse":
        serve_sse()
    else:
        serve_stdio()
"""
    else:
        raise ValueError(f"Unsupported framework: {framework}")
    
    file_path = directory / "mcp_server.py"
    with open(file_path, "w") as f:
        f.write(content)
    
    print(f"Created {file_path}")

def find_auto_mcp_root() -> Path:
    """Find the auto_mcp project root directory."""
    # Get the path of the current module
    current_module_path = Path(__file__).resolve()
    
    # Go up until we find a directory containing a pyproject.toml with the name "auto_mcp"
    auto_mcp_root = current_module_path.parent
    while auto_mcp_root != auto_mcp_root.parent:  # Stop at filesystem root
        project_toml = auto_mcp_root / "pyproject.toml"
        if project_toml.exists():
            try:
                with open(project_toml, "r") as f:
                    content = f.read()
                    if "name = \"auto_mcp\"" in content or "name = 'auto_mcp'" in content:
                        return auto_mcp_root
            except:
                pass
        auto_mcp_root = auto_mcp_root.parent
    
    # If we couldn't find it, raise an error
    raise ValueError("Could not find auto_mcp project root")

def update_pyproject_toml(directory: Path, framework: str) -> None:
    """
    Update pyproject.toml with auto_mcp dependency.
    
    Args:
        directory: Directory containing the pyproject.toml file
        framework: The framework to use (crewai, langchain, etc.)
    """
    pyproject_path = directory / "pyproject.toml"
    
    # Create a basic pyproject.toml if it doesn't exist
    if not pyproject_path.exists():
        basic_pyproject = {
            "project": {
                "name": "mcp-project",
                "version": "0.1.0",
                "description": "A project with MCP server integration",
                "requires-python": ">=3.10",
                "dependencies": []
            },
            "build-system": {
                "requires": ["hatchling"],
                "build-backend": "hatchling.build"
            }
        }
        with open(pyproject_path, "w") as f:
            toml.dump(basic_pyproject, f)
    
    # Load existing pyproject.toml
    with open(pyproject_path, "r") as f:
        config = toml.load(f)
    
    # Make sure project section exists
    if "project" not in config:
        config["project"] = {}
    
    # Make sure dependencies section exists
    if "dependencies" not in config["project"]:
        config["project"]["dependencies"] = []
    
    # Get dependencies as a list
    dependencies = config["project"]["dependencies"]
    if not isinstance(dependencies, list):
        dependencies = []
    
    # Find the auto_mcp root
    auto_mcp_root = find_auto_mcp_root()
    auto_mcp_path = str(auto_mcp_root.resolve())
    
    # Remove any existing auto_mcp dependencies
    cleaned_deps = []
    for dep in dependencies:
        if isinstance(dep, str) and not (
            dep.startswith("auto_mcp") or 
            "auto_mcp @" in dep or 
            "auto-mcp" in dep
        ):
            cleaned_deps.append(dep)
    
    # Add framework dependencies directly
    if framework == "crewai":
        cleaned_deps.append("crewai>=0.108.0")
        cleaned_deps.append("crewai-tools>=0.38.1")
        cleaned_deps.append("mcp>=1.6.0")
        cleaned_deps.append("pydantic>=2.11.1")
    
    # Add auto_mcp with proper PEP 508 direct reference syntax
    file_url = f"file://{auto_mcp_path}"
    cleaned_deps.append(f"auto_mcp @ {file_url}")
    
    # Update dependencies in config
    config["project"]["dependencies"] = cleaned_deps
    
    # Add scripts section to run the MCP server
    if "scripts" not in config["project"]:
        config["project"]["scripts"] = {}
    
    # Add the scripts for running the MCP server
    config["project"]["scripts"]["serve_stdio"] = "mcp_server:serve_stdio"
    config["project"]["scripts"]["serve_sse"] = "mcp_server:serve_sse"
    
    # Add hatch metadata section to allow direct references
    if "tool" not in config:
        config["tool"] = {}
    
    if "hatch" not in config["tool"]:
        config["tool"]["hatch"] = {}
    
    if "metadata" not in config["tool"]["hatch"]:
        config["tool"]["hatch"]["metadata"] = {}
    
    # Allow direct references in dependencies
    config["tool"]["hatch"]["metadata"]["allow-direct-references"] = True
    
    # Add build configuration for the wheel
    if "build" not in config["tool"]["hatch"]:
        config["tool"]["hatch"]["build"] = {}
    
    if "targets" not in config["tool"]["hatch"]["build"]:
        config["tool"]["hatch"]["build"]["targets"] = {}
    
    if "wheel" not in config["tool"]["hatch"]["build"]["targets"]:
        config["tool"]["hatch"]["build"]["targets"]["wheel"] = {}
    
    # Configure the files to include in the wheel
    # This tells Hatch to include the mcp_server.py file
    config["tool"]["hatch"]["build"]["targets"]["wheel"]["include"] = ["mcp_server.py"]
    
    # Exclude unnecessary files
    config["tool"]["hatch"]["build"]["targets"]["wheel"]["exclude"] = ["__pycache__", "*.pyc"]
    
    # Mark the package as pure Python
    config["tool"]["hatch"]["build"]["targets"]["wheel"]["sources"] = ["."]
    
    # Write updated config back to file
    with open(pyproject_path, "w") as f:
        toml.dump(config, f)
    
    print(f"Updated {pyproject_path} with auto_mcp dependency and server scripts")


def new_command(args) -> None:
    """Create new MCP server files in the current directory."""
    current_dir = Path.cwd()
    
    # Create mcp_server.py
    create_mcp_server_file(current_dir, args.framework)
    
    # Update pyproject.toml
    update_pyproject_toml(current_dir, args.framework)
    
    print("\nSetup complete! Next steps:")
    print("1. Edit mcp_server.py to import and configure your agent/crew")
    print("2. Run 'uv sync' to install dependencies including auto_mcp")
    print("3. Run your MCP server using one of these commands:")
    print("   - python -m mcp_server         # For STDIO transport (default)")
    print("   - python -m mcp_server sse     # For SSE transport")
    print("   - uv run serve_stdio           # Using the script entry point")
    print("   - uv run serve_sse             # Using the script entry point")

def main():
    parser = argparse.ArgumentParser(description="AutoMCP - Convert agents to MCP servers")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")
    
    # New command
    new_parser = subparsers.add_parser("new", help="Create a new MCP server configuration")
    new_parser.add_argument(
        "--framework", 
        choices=["crewai"], 
        default="crewai",
        help="Agent framework to use (default: crewai)"
    )
    new_parser.set_defaults(func=new_command)
    
    # Parse args and call the appropriate function
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    if hasattr(args, "func"):
        args.func(args)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()