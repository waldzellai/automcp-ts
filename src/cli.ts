#!/usr/bin/env node

import { Command } from 'commander';
import { readFile, writeFile, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';
import { spawn } from 'child_process';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Template and config file locations
const TEMPLATE_FILE = join(__dirname, '../templates/run_mcp.ts.template');
const CONFIG_FILE = join(__dirname, '../templates/framework_config.yaml');

interface FrameworkConfig {
  adapter_import: string;
  import_comment: string;
  adapter_definition: string;
}

interface Config {
  frameworks: Record<string, FrameworkConfig>;
}

async function createMcpServerFile(directory: string, framework: string): Promise<void> {
  // Check if the unified template exists
  try {
    await access(TEMPLATE_FILE);
  } catch {
    throw new Error(`Unified template file not found at: ${TEMPLATE_FILE}`);
  }

  // Load the configuration file
  let config: Config;
  try {
    const configContent = await readFile(CONFIG_FILE, 'utf-8');
    config = yaml.parse(configContent) as Config;
  } catch (error) {
    throw new Error(`Error loading configuration file: ${error}`);
  }

  // Check if the specified framework exists in the configuration
  if (!config.frameworks[framework]) {
    throw new Error(`Framework '${framework}' not found in configuration`);
  }

  // Get the framework-specific configuration
  const frameworkConfig = config.frameworks[framework];

  // Load the template
  let templateContent: string;
  try {
    templateContent = await readFile(TEMPLATE_FILE, 'utf-8');
  } catch (error) {
    throw new Error(`Error reading template file: ${error}`);
  }

  // Replace placeholders with framework-specific values
  let content = templateContent;

  // Add the framework name
  content = content.replace(/\{\{framework\}\}/g, framework);

  // Extract variable name from adapter definition
  let adapterVariableName: string = `mcp_${framework}`;
  const adapterDef = frameworkConfig.adapter_definition;
  if (adapterDef) {
    const firstLine = adapterDef.trim().split('\n')[0]?.trim();
    if (firstLine?.includes('=')) {
      adapterVariableName = firstLine.split('=')[0]?.trim() || adapterVariableName;
    }
  }

  // Replace all placeholders
  for (const [key, value] of Object.entries(frameworkConfig)) {
    const placeholder = `{{${key}}}`;
    content = content.replace(new RegExp(placeholder, 'g'), value);
  }

  // Replace adapter_variable_name placeholder
  content = content.replace(/\{\{adapter_variable_name\}\}/g, adapterVariableName);

  // Write the file
  const filePath = join(directory, 'run_mcp.ts');
  await writeFile(filePath, content);

  console.log(`Created ${filePath} from unified template for ${framework} framework.`);
}

async function initCommand(framework: string): Promise<void> {
  const currentDir = process.cwd();

  try {
    await createMcpServerFile(currentDir, framework);
  } catch (error) {
    console.error(`Error creating server file: ${error}`);
    process.exit(1);
  }

  console.log('\nSetup complete! Next steps:');
  console.log(`1. Edit ${join(currentDir, 'run_mcp.ts')} to import and configure your ${framework} agent/crew/graph`);
  console.log('2. Add a .env file with necessary environment variables');
  console.log('3. Run your MCP server using one of these commands:');
  console.log('   - npm run serve         # For STDIO transport (default)');
  console.log('   - npm run serve:sse     # For SSE transport');
  console.log('   - tsx run_mcp.ts        # Direct execution');
}

async function serveCommand(transport: 'stdio' | 'sse'): Promise<void> {
  console.log(`Running AutoMCP-TS server with ${transport} transport`);
  const currentDir = process.cwd();

  const mcpFile = join(currentDir, 'run_mcp.ts');
  try {
    await access(mcpFile);
  } catch {
    throw new Error('run_mcp.ts not found in current directory');
  }

  // Check for package.json and install dependencies if needed
  const packageJsonPath = join(currentDir, 'package.json');
  try {
    await access(packageJsonPath);
  } catch {
    console.log('No package.json found, creating one...');
    const packageJson = {
      "name": "mcp-server",
      "version": "1.0.0",
      "type": "module",
      "scripts": {
        "serve": "tsx run_mcp.ts",
        "serve:sse": "tsx run_mcp.ts sse"
      },
      "dependencies": {
        "@modelcontextprotocol/sdk": "^1.12.0",
        "zod": "^3.22.4"
      },
      "devDependencies": {
        "tsx": "^4.6.0",
        "@types/node": "^20.10.0"
      }
    };
    await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log('Created package.json');
  }

  try {
    if (transport === 'stdio') {
      spawn('tsx', [mcpFile], { stdio: 'inherit' });
    } else {
      spawn('tsx', [mcpFile, 'sse'], { stdio: 'inherit' });
    }
  } catch (error) {
    console.error(`Error running AutoMCP-TS server: ${error}`);
    process.exit(1);
  }
}

function loadAvailableFrameworks(): string[] {
  // For now, return a hardcoded list. In production, this would read from the config file
  return [
    'fastapi', 'express', 'nestjs', 'custom'
  ];
}

const program = new Command();

program
  .name('automcp-ts')
  .description('AutoMCP-TS - Convert agents to MCP servers in TypeScript')
  .version('0.1.0');

const availableFrameworks = loadAvailableFrameworks();

program
  .command('init')
  .description('Create a new MCP server configuration')
  .requiredOption('-f, --framework <framework>', `Agent framework to use (choices: ${availableFrameworks.join(', ')})`)
  .action(async (options) => {
    if (!availableFrameworks.includes(options.framework)) {
      console.error(`Invalid framework: ${options.framework}`);
      console.error(`Available frameworks: ${availableFrameworks.join(', ')}`);
      process.exit(1);
    }
    await initCommand(options.framework);
  });

program
  .command('serve')
  .description('Run the AutoMCP-TS server')
  .option('-t, --transport <transport>', 'Transport to use (stdio or sse)', 'stdio')
  .action(async (options) => {
    if (!['stdio', 'sse'].includes(options.transport)) {
      console.error(`Invalid transport: ${options.transport}`);
      process.exit(1);
    }
    await serveCommand(options.transport as 'stdio' | 'sse');
  });

program.parse(); 