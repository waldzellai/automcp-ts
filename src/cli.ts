#!/usr/bin/env node

import { Command } from 'commander';
import { readFile, writeFile, access } from 'fs/promises';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';
import { spawn } from 'child_process';

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

async function ensureProjectDependencies(directory: string): Promise<void> {
  const packageJsonPath = join(directory, 'package.json');
  let pkg: any = null;

  if (!existsSync(packageJsonPath)) {
    // Minimal package.json
    pkg = {
      name: 'mcp-server',
      version: '1.0.0',
      type: 'module',
      scripts: {
        serve: 'tsx run_mcp.ts',
        'serve:sse': 'tsx run_mcp.ts sse'
      },
      dependencies: {
        '@modelcontextprotocol/sdk': '^1.12.0',
        zod: '^3.22.4',
        express: '^4.18.2',
        'automcp-ts': '^0.1.0'
      },
      devDependencies: {
        tsx: '^4.6.0',
        '@types/node': '^20.10.0',
        '@types/express': '^4.17.21'
      }
    };
    await writeFile(packageJsonPath, JSON.stringify(pkg, null, 2));
    console.log('Created package.json');
  } else {
    // Read and update
    const current = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    current.scripts ||= {};
    current.scripts.serve ||= 'tsx run_mcp.ts';
    current.scripts['serve:sse'] ||= 'tsx run_mcp.ts sse';
    current.dependencies ||= {};
    current.devDependencies ||= {};

    const requiredDeps: Record<string, string> = {
      '@modelcontextprotocol/sdk': '^1.12.0',
      zod: '^3.22.4',
      express: '^4.18.2',
      'automcp-ts': '^0.1.0'
    };
    const requiredDevDeps: Record<string, string> = {
      tsx: '^4.6.0',
      '@types/node': '^20.10.0',
      '@types/express': '^4.17.21'
    };

    let changed = false;
    for (const [dep, ver] of Object.entries(requiredDeps)) {
      if (!current.dependencies[dep]) {
        current.dependencies[dep] = ver;
        changed = true;
      }
    }
    for (const [dep, ver] of Object.entries(requiredDevDeps)) {
      if (!current.devDependencies[dep]) {
        current.devDependencies[dep] = ver;
        changed = true;
      }
    }

    if (changed) {
      await writeFile(packageJsonPath, JSON.stringify(current, null, 2));
      console.log('Updated package.json with required dependencies');
    }
    pkg = current;
  }

  // npm install if node_modules missing
  const nodeModulesPath = join(directory, 'node_modules');
  if (!existsSync(nodeModulesPath)) {
    console.log('Installing dependencies (npm install)...');
    await new Promise<void>((resolve, reject) => {
      const child = spawn('npm', ['install', '--no-fund', '--no-audit'], { stdio: 'inherit', cwd: directory });
      child.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`npm install failed with code ${code}`));
      });
      child.on('error', reject);
    });
  }
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

  // One-command environment bootstrap
  try {
    await ensureProjectDependencies(currentDir);
  } catch (error) {
    console.error(`Dependency setup failed: ${error}`);
    process.exit(1);
  }

  try {
    if (transport === 'stdio') {
      spawn('npx', ['-y', 'tsx', mcpFile], { stdio: 'inherit' });
    } else {
      spawn('npx', ['-y', 'tsx', mcpFile, 'sse'], { stdio: 'inherit' });
    }
  } catch (error) {
    console.error(`Error running AutoMCP-TS server: ${error}`);
    process.exit(1);
  }
}

function loadAvailableFrameworks(): string[] {
  try {
    const configContent = readFileSync(CONFIG_FILE, 'utf-8');
    const config = yaml.parse(configContent) as Config;
    return Object.keys(config.frameworks);
  } catch (error) {
    console.error(`Error loading framework configuration: ${error}`);
    return [];
  }
}

function toPascalCase(name: string): string {
  return name
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^(.)/, (m) => m.toUpperCase());
}

async function generateAdapterCommand(frameworkName: string): Promise<void> {
  const currentDir = process.cwd();
  const safeName = frameworkName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const pascal = toPascalCase(safeName);
  const fileName = `${safeName}.adapter.ts`;
  const filePath = join(currentDir, fileName);

  const content = `import { z } from 'zod';
import { BaseAdapter, AdapterConfig, ToolResult } from 'automcp-ts/lib/adapters/base.js';

class ${pascal}Adapter<T extends Record<string, z.ZodTypeAny>> extends BaseAdapter<T> {
  protected async executeAgent(inputs: z.infer<z.ZodObject<T>>): Promise<any> {
    // TODO: Replace with your framework's invocation logic.
    // Example patterns to adapt:
    // return await (this.agentInstance.run?.(inputs)
    //   ?? this.agentInstance.invoke?.(inputs)
    //   ?? this.agentInstance.kickoff?.({ inputs })
    // );
    throw new Error('executeAgent not implemented for ${pascal}Adapter');
  }
}

export function create${pascal}Adapter<T extends Record<string, z.ZodTypeAny>>(
  agentInstance: any,
  name: string,
  description: string,
  inputSchema: T
) {
  const adapter = new ${pascal}Adapter<T>({
    agentInstance,
    name,
    description,
    inputSchema,
  } as AdapterConfig<T>);
  return adapter.createToolFunction();
}
`;

  await writeFile(filePath, content);
  console.log(`Created adapter skeleton at ${filePath}`);
  console.log('Usage:');
  console.log(`  // In your run_mcp.ts`);
  console.log(`  import { create${pascal}Adapter } from './${fileName.replace('.ts', '.js')}';`);
  console.log(`  const tool = create${pascal}Adapter(new YourAgent(), name, description, InputSchema.shape);`);
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

program
  .command('generate-adapter')
  .description('Generate a from-scratch adapter skeleton in the current directory')
  .requiredOption('-n, --name <frameworkName>', 'Framework name for the new adapter')
  .action(async (options) => {
    await generateAdapterCommand(options.name as string);
  });

program.parse(); 