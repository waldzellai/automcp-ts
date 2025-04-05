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


def find_auto_mcp_root() -> Path:
    """Find the auto_mcp project root directory."""
    # Get the path of the current module
    current_module_path = Path(__file__).resolve()

    # Go up until we find a directory containing a pyproject.toml with the name "auto_mcp"
    auto_mcp_root = current_module_path.parent.parent # Go up two levels from cli.py
    while auto_mcp_root != auto_mcp_root.parent:  # Stop at filesystem root
        project_toml = auto_mcp_root / "pyproject.toml"
        if project_toml.exists():
            try:
                with open(project_toml, "r") as f:
                    content = f.read()
                    # Check for different ways the name might be specified
                    if 'name = "auto_mcp"' in content or "name = 'auto_mcp'" in content:
                         return auto_mcp_root
            except Exception as e:
                # Handle potential errors during file reading or parsing
                print(f"Warning: Could not read or parse {project_toml}: {e}", file=sys.stderr)
                pass # Continue searching upwards
        auto_mcp_root = auto_mcp_root.parent

    # If we couldn't find it based on pyproject.toml, fall back to directory name
    current_dir_check = Path(__file__).resolve().parent.parent
    if current_dir_check.name == "auto_mcp":
         print("Warning: Could not find pyproject.toml with 'auto_mcp' name. Falling back to directory structure.", file=sys.stderr)
         return current_dir_check

    # If we still couldn't find it, raise an error
    raise ValueError("Could not find auto_mcp project root. Make sure you are running this from within the project structure and the root pyproject.toml has 'name = \"auto_mcp\"'.")


def update_pyproject_toml(directory: Path, framework: str) -> None:
    """
    Update pyproject.toml with auto_mcp dependency and framework-specific dependencies.

    Args:
        directory: Directory containing the pyproject.toml file
        framework: The framework to use (crewai, langgraph)
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
        print(f"Created basic {pyproject_path}")

    # Load existing pyproject.toml
    try:
        with open(pyproject_path, "r") as f:
            config = toml.load(f)
    except toml.TomlDecodeError as e:
        print(f"Error decoding {pyproject_path}: {e}", file=sys.stderr)
        print("Please ensure your pyproject.toml file is valid TOML.", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error reading {pyproject_path}: {e}", file=sys.stderr)
        sys.exit(1)


    # Make sure project section exists
    if "project" not in config:
        config["project"] = {}

    # Make sure dependencies section exists
    if "dependencies" not in config["project"]:
        config["project"]["dependencies"] = []

    # Get dependencies as a list
    dependencies = config["project"].get("dependencies", []) # Use .get for safety
    if not isinstance(dependencies, list):
        print(f"Warning: 'project.dependencies' in {pyproject_path} is not a list. Resetting to empty list.", file=sys.stderr)
        dependencies = []

    # Find the auto_mcp root
    try:
        auto_mcp_root = find_auto_mcp_root()
        auto_mcp_path = str(auto_mcp_root.resolve())
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1) # Exit if we can't find the root

    # Remove any existing auto_mcp dependencies and specific framework deps we manage
    deps_to_remove_prefixes = ["auto_mcp", "auto-mcp", "crewai", "crewai-tools", "langgraph", "langchain", "mcp", "pydantic"]
    cleaned_deps = []
    for dep in dependencies:
        if isinstance(dep, str):
            # Check if the dependency string starts with any of the prefixes or contains specific patterns
             should_remove = False
             if "auto_mcp @" in dep or "auto-mcp @" in dep:
                 should_remove = True
             else:
                 for prefix in deps_to_remove_prefixes:
                     # Be careful with partial matches like 'langchain_community' vs 'langchain'
                     # Simple startswith check might be okay here, but consider regex for more complex cases
                     if dep.startswith(prefix):
                         # Check for exact match or match with version specifiers
                         if dep == prefix or dep.startswith(f"{prefix}==") or dep.startswith(f"{prefix}>=") or dep.startswith(f"{prefix}<=") or dep.startswith(f"{prefix}~="):
                             should_remove = True
                             break # No need to check other prefixes for this dep
             if not should_remove:
                 cleaned_deps.append(dep)
        else:
             # Keep non-string dependencies (like tables if used, though less common)
             cleaned_deps.append(dep)


    # Define common dependencies
    common_deps = [
        "mcp>=1.6.0",
        "pydantic>=2.11.1"
    ]
    cleaned_deps.extend(common_deps)

    # Add framework-specific dependencies
    if framework == "crewai":
        cleaned_deps.extend([
            "crewai>=0.108.0",
            "crewai-tools>=0.38.1",
        ])
    elif framework == "langgraph":
        cleaned_deps.extend([
            "langgraph==0.3.25", # Use specified version
            "langchain==0.3.20", # Keep a reasonable minimum for langchain core
            "langchain-openai==0.2.14", # Use specified version
            "uv>=0.6.6",
            # Add other necessary langgraph/langchain dependencies here if needed
        ])
    # No else needed as common deps are already added

    # Add auto_mcp with proper PEP 508 direct reference syntax
    # Ensure path separators are correct for URLs (use forward slashes)
    file_url = f"file:///{auto_mcp_path.replace(os.sep, '/')}"
    cleaned_deps.append(f"auto_mcp @ {file_url}")

    # Update dependencies in config, ensuring uniqueness
    config["project"]["dependencies"] = sorted(list(set(cleaned_deps))) # Sort and remove duplicates

    # Add scripts section to run the MCP server
    if "scripts" not in config["project"]:
        config["project"]["scripts"] = {}

    # Add the scripts for running the MCP server
    config["project"]["scripts"]["serve_stdio"] = "mcp_server:serve_stdio"
    config["project"]["scripts"]["serve_sse"] = "mcp_server:serve_sse"

    # Add hatch metadata section to allow direct references
    # Use .setdefault for cleaner dictionary creation/access
    hatch_config = config.setdefault("tool", {}).setdefault("hatch", {})
    metadata_config = hatch_config.setdefault("metadata", {})
    metadata_config["allow-direct-references"] = True # Ensure this is boolean true

    # Add build configuration for the wheel
    build_config = hatch_config.setdefault("build", {})
    targets_config = build_config.setdefault("targets", {})
    wheel_config = targets_config.setdefault("wheel", {})

    # Configure the files to include in the wheel
    # This tells Hatch to include the mcp_server.py file generated in the user's project
    # Ensure it includes the *user's* mcp_server.py, not one from the template dir
    # The 'include' path is relative to the pyproject.toml location (user's project root)
    wheel_config["include"] = ["/mcp_server.py"] # Include the generated file at the root
    wheel_config["packages"] = ["."] # Include packages if the user creates any

    # Exclude unnecessary files
    wheel_config["exclude"] = ["__pycache__", "*.pyc", ".pytest_cache", ".ruff_cache"]

    # Write updated config back to file
    try:
        with open(pyproject_path, "w") as f:
            toml.dump(config, f)
    except Exception as e:
        print(f"Error writing updated {pyproject_path}: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"Updated {pyproject_path} with auto_mcp dependency and server scripts for {framework}")


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


    # Update pyproject.toml
    update_pyproject_toml(current_dir, args.framework)

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
        choices=["crewai", "langgraph"],
        default="crewai",
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