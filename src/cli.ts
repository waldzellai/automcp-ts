#!/usr/bin/env node

import { Command } from 'commander';
import { readFile, writeFile, access } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';
import { spawn, type SpawnOptions } from 'child_process';
import { Effect, Data } from 'effect';

type StringRecord = Record<string, string>;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

class TemplateFileError extends Data.TaggedError('TemplateFileError')<{
  path: string;
  cause: unknown;
}> {}

class ConfigFileError extends Data.TaggedError('ConfigFileError')<{
  path: string;
  reason: 'read' | 'parse';
  cause: unknown;
}> {}

class InvalidFrameworkError extends Data.TaggedError('InvalidFrameworkError')<{
  framework: string;
  available: ReadonlyArray<string>;
}> {}

class FileWriteError extends Data.TaggedError('FileWriteError')<{
  path: string;
  cause: unknown;
}> {}

class FileReadError extends Data.TaggedError('FileReadError')<{
  path: string;
  cause: unknown;
}> {}

class JsonParseError extends Data.TaggedError('JsonParseError')<{
  path: string;
  cause: unknown;
}> {}

class FileMissingError extends Data.TaggedError('FileMissingError')<{
  path: string;
}> {}

class CommandExecutionError extends Data.TaggedError('CommandExecutionError')<{
  command: string;
  args: ReadonlyArray<string>;
  exitCode?: number | null;
  signal?: NodeJS.Signals | null;
  cause?: unknown;
}> {}

class InvalidTransportError extends Data.TaggedError('InvalidTransportError')<{
  transport: string;
}> {}

type CliError =
  | TemplateFileError
  | ConfigFileError
  | InvalidFrameworkError
  | FileWriteError
  | FileReadError
  | JsonParseError
  | FileMissingError
  | CommandExecutionError
  | InvalidTransportError;

type PackageJson = {
  name?: string;
  version?: string;
  type?: string;
  scripts?: StringRecord;
  dependencies?: StringRecord;
  devDependencies?: StringRecord;
  [key: string]: unknown;
};

interface SpawnExit {
  readonly type: 'exit';
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
}

interface SpawnError {
  readonly type: 'error';
  readonly cause: unknown;
}

type SpawnRejection = SpawnExit | SpawnError;

const isSpawnExit = (value: unknown): value is SpawnExit =>
  typeof value === 'object' && value !== null && (value as { type?: string }).type === 'exit';

const isSpawnError = (value: unknown): value is SpawnError =>
  typeof value === 'object' && value !== null && (value as { type?: string }).type === 'error';

const formatUnknown = (value: unknown): string => {
  if (value instanceof Error) {
    return value.message;
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const renderCliError = (error: CliError): string => {
  switch (error._tag) {
    case 'TemplateFileError':
      return `Error reading template file at ${error.path}: ${formatUnknown(error.cause)}`;
    case 'ConfigFileError':
      return error.reason === 'read'
        ? `Error loading configuration file ${error.path}: ${formatUnknown(error.cause)}`
        : `Error parsing configuration file ${error.path}: ${formatUnknown(error.cause)}`;
    case 'InvalidFrameworkError':
      return `Framework '${error.framework}' not found in configuration. Available frameworks: ${error.available.join(', ')}`;
    case 'FileWriteError':
      return `Error writing file ${error.path}: ${formatUnknown(error.cause)}`;
    case 'FileReadError':
      return `Error reading file ${error.path}: ${formatUnknown(error.cause)}`;
    case 'JsonParseError':
      return `Error parsing JSON file ${error.path}: ${formatUnknown(error.cause)}`;
    case 'FileMissingError':
      return `File not found: ${error.path}`;
    case 'CommandExecutionError': {
      const command = [error.command, ...error.args].join(' ');
      const details = error.exitCode != null
        ? ` (exit code ${error.exitCode}${error.signal ? `, signal ${error.signal}` : ''})`
        : '';
      const cause = error.cause != null ? `: ${formatUnknown(error.cause)}` : '';
      return `Command failed: ${command}${details}${cause}`;
    }
    case 'InvalidTransportError':
      return `Invalid transport: ${error.transport}`;
  }
};

const readTemplateContent = (): Effect.Effect<string, TemplateFileError> =>
  Effect.tryPromise({
    try: () => readFile(TEMPLATE_FILE, 'utf-8'),
    catch: (cause) => new TemplateFileError({ path: TEMPLATE_FILE, cause }),
  });

const readConfigContent = (): Effect.Effect<string, ConfigFileError> =>
  Effect.tryPromise({
    try: () => readFile(CONFIG_FILE, 'utf-8'),
    catch: (cause) => new ConfigFileError({ path: CONFIG_FILE, reason: 'read', cause }),
  });

const parseYamlConfig = (content: string): Effect.Effect<Config, ConfigFileError> =>
  Effect.try({
    try: () => yaml.parse(content) as Config,
    catch: (cause) => new ConfigFileError({ path: CONFIG_FILE, reason: 'parse', cause }),
  });

const readTextFile = (path: string): Effect.Effect<string, FileReadError> =>
  Effect.tryPromise({
    try: () => readFile(path, 'utf-8'),
    catch: (cause) => new FileReadError({ path, cause }),
  });

const writeTextFile = (path: string, content: string): Effect.Effect<void, FileWriteError> =>
  Effect.tryPromise({
    try: () => writeFile(path, content),
    catch: (cause) => new FileWriteError({ path, cause }),
  });

const ensureFileExists = (path: string): Effect.Effect<void, FileMissingError> =>
  Effect.tryPromise({
    try: () => access(path),
    catch: () => new FileMissingError({ path }),
  });

const spawnEffect = (
  command: string,
  args: ReadonlyArray<string>,
  options: SpawnOptions,
): Effect.Effect<void, CommandExecutionError> =>
  Effect.tryPromise({
    try: () =>
      new Promise<void>((resolve, reject) => {
        const child = spawn(command, Array.from(args), options);
        child.on('error', (cause) => {
          reject({ type: 'error', cause } satisfies SpawnRejection);
        });
        child.on('exit', (code, signal) => {
          if (code === 0) {
            resolve();
          } else {
            reject({ type: 'exit', code, signal } satisfies SpawnRejection);
          }
        });
      }),
    catch: (reason) => {
      if (isSpawnExit(reason)) {
        return new CommandExecutionError({
          command,
          args,
          exitCode: reason.code,
          signal: reason.signal,
        });
      }
      if (isSpawnError(reason)) {
        return new CommandExecutionError({
          command,
          args,
          cause: reason.cause,
        });
      }
      return new CommandExecutionError({
        command,
        args,
        cause: reason,
      });
    },
  });

const spawnDetachedEffect = (
  command: string,
  args: ReadonlyArray<string>,
  options: SpawnOptions,
): Effect.Effect<ReturnType<typeof spawn>, CommandExecutionError> =>
  Effect.async<ReturnType<typeof spawn>, CommandExecutionError>((resume) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(command, Array.from(args), { ...options, detached: true });
    } catch (cause) {
      resume(
        Effect.fail(
          new CommandExecutionError({
            command,
            args,
            cause,
          }),
        ),
      );
      return;
    }

    const cleanup = () => {
      child.off('error', onError);
      child.off('spawn', onSpawn);
    };

    const onError = (cause: Error) => {
      cleanup();
      resume(
        Effect.fail(
          new CommandExecutionError({
            command,
            args,
            cause,
          }),
        ),
      );
    };

    const onSpawn = () => {
      cleanup();
      child.unref();
      resume(Effect.succeed(child));
    };

    child.once('error', onError);
    child.once('spawn', onSpawn);

    return Effect.sync(cleanup);
  });

const loadFrameworkConfig = (): Effect.Effect<Config, ConfigFileError> =>
  Effect.gen(function* (_) {
    const content = yield* _(readConfigContent());
    return yield* _(parseYamlConfig(content));
  });

const loadAvailableFrameworksEffect = (): Effect.Effect<ReadonlyArray<string>, ConfigFileError> =>
  Effect.gen(function* (_) {
    const config = yield* _(loadFrameworkConfig());
    return Object.keys(config.frameworks);
  });


const createMcpServerFile = (directory: string, framework: string): Effect.Effect<void, CliError> =>
  Effect.gen(function* (_) {
    const config = yield* _(loadFrameworkConfig());
    const frameworks = Object.keys(config.frameworks);
    const maybeConfig = config.frameworks[framework];
    if (!maybeConfig) {
      yield* _(Effect.fail(new InvalidFrameworkError({ framework, available: frameworks })));
      return;
    }
    const frameworkConfig = maybeConfig;
    const templateContent = yield* _(readTemplateContent());
    const content = yield* _(Effect.sync(() => {
      let updated = templateContent.replace(/\{\{framework\}\}/g, framework);
      let adapterVariableName = `mcp_${framework}`;
      const adapterDef = frameworkConfig.adapter_definition;
      if (adapterDef) {
        const firstLine = adapterDef.trim().split('\n')[0]?.trim();
        if (firstLine && firstLine.includes('=')) {
          adapterVariableName = firstLine.split('=')[0]?.trim() ?? adapterVariableName;

        }
      }
      for (const [key, value] of Object.entries(frameworkConfig)) {
        const placeholder = new RegExp(`\\{\\{${key}\\}}`, 'g');
        updated = updated.replace(placeholder, value);
      }
      updated = updated.replace(/\{\{adapter_variable_name\}\}/g, adapterVariableName);
      return updated;
    }));
    const filePath = join(directory, 'run_mcp.ts');
    yield* _(writeTextFile(filePath, content));
    yield* _(Effect.sync(() => {
      console.log(`Created ${filePath} from unified template for ${framework} framework.`);
    }));
  });

const ensureProjectDependencies = (directory: string): Effect.Effect<void, CliError> =>
  Effect.gen(function* (_) {
    const packageJsonPath = join(directory, 'package.json');
    const nodeModulesPath = join(directory, 'node_modules');
    const packageJsonExists = yield* _(Effect.sync(() => existsSync(packageJsonPath)));

    if (!packageJsonExists) {
      const pkg: PackageJson = {
        name: 'mcp-server',
        version: '1.0.0',
        type: 'module',
        scripts: {
          serve: 'tsx run_mcp.ts',
          'serve:sse': 'tsx run_mcp.ts sse',
        },
        dependencies: {
          '@modelcontextprotocol/sdk': '^1.12.0',
          zod: '^3.22.4',
          express: '^4.18.2',
          'automcp-ts': '^0.1.0',
        },
        devDependencies: {
          tsx: '^4.6.0',
          '@types/node': '^20.10.0',
          '@types/express': '^4.17.21',
        },
      };
      yield* _(writeTextFile(packageJsonPath, JSON.stringify(pkg, null, 2)));
      yield* _(Effect.sync(() => {
        console.log('Created package.json');
      }));
    } else {
      const content = yield* _(readTextFile(packageJsonPath));
      const current = yield* _(Effect.try({
        try: () => JSON.parse(content) as PackageJson,
        catch: (cause) => new JsonParseError({ path: packageJsonPath, cause }),
      }));

      const scripts: StringRecord = typeof current.scripts === 'object' && current.scripts
        ? Object.fromEntries(Object.entries(current.scripts).filter(([, value]) => typeof value === 'string'))
        : {};
      const dependencies: StringRecord = typeof current.dependencies === 'object' && current.dependencies
        ? Object.fromEntries(Object.entries(current.dependencies).filter(([, value]) => typeof value === 'string'))
        : {};
      const devDependencies: StringRecord = typeof current.devDependencies === 'object' && current.devDependencies
        ? Object.fromEntries(Object.entries(current.devDependencies).filter(([, value]) => typeof value === 'string'))
        : {};

      current.scripts = scripts;
      current.dependencies = dependencies;
      current.devDependencies = devDependencies;

      const requiredDeps: StringRecord = {
        '@modelcontextprotocol/sdk': '^1.12.0',
        zod: '^3.22.4',
        express: '^4.18.2',
        'automcp-ts': '^0.1.0',
      };
      const requiredDevDeps: StringRecord = {
        tsx: '^4.6.0',
        '@types/node': '^20.10.0',
        '@types/express': '^4.17.21',
      };

      let changed = false;
      if (!scripts.serve) {
        scripts.serve = 'tsx run_mcp.ts';
        changed = true;
      }
      if (!scripts['serve:sse']) {
        scripts['serve:sse'] = 'tsx run_mcp.ts sse';
        changed = true;
      }
      for (const [dep, ver] of Object.entries(requiredDeps)) {
        if (!dependencies[dep]) {
          dependencies[dep] = ver;
          changed = true;
        }
      }
      for (const [dep, ver] of Object.entries(requiredDevDeps)) {
        if (!devDependencies[dep]) {
          devDependencies[dep] = ver;
          changed = true;
        }
      }

      if (changed) {
        yield* _(writeTextFile(packageJsonPath, JSON.stringify(current, null, 2)));
        yield* _(Effect.sync(() => {
          console.log('Updated package.json with required dependencies');
        }));
      }
    }

    const nodeModulesExists = yield* _(Effect.sync(() => existsSync(nodeModulesPath)));
    if (!nodeModulesExists) {
      yield* _(Effect.sync(() => {
        console.log('Installing dependencies (npm install)...');
      }));
      yield* _(spawnEffect('npm', ['install', '--no-fund', '--no-audit'], { stdio: 'inherit', cwd: directory }));
    }
  });

const serveCommand = (transport: 'stdio' | 'sse'): Effect.Effect<void, CliError> =>
  Effect.gen(function* (_) {
    yield* _(Effect.sync(() => {
      console.log(`Running AutoMCP-TS server with ${transport} transport`);
    }));
    const currentDir = process.cwd();
    const mcpFile = join(currentDir, 'run_mcp.ts');
    yield* _(ensureFileExists(mcpFile));
    yield* _(ensureProjectDependencies(currentDir));
    const args = transport === 'stdio' ? ['-y', 'tsx', mcpFile] : ['-y', 'tsx', mcpFile, 'sse'];

    const child = yield* _(
      spawnDetachedEffect('npx', args, { stdio: 'inherit', cwd: currentDir }),
    );
    yield* _(Effect.sync(() => {
      console.log(`Server started with PID: ${child.pid}`);
      console.log('CLI exiting, server continues running in background...');
    }));
  });

const initCommand = (framework: string): Effect.Effect<void, CliError> =>
  Effect.gen(function* (_) {
    const currentDir = process.cwd();
    yield* _(createMcpServerFile(currentDir, framework));
    yield* _(Effect.sync(() => {
      console.log('\nSetup complete! Next steps:');
      console.log(`1. Edit ${join(currentDir, 'run_mcp.ts')} to import and configure your ${framework} agent/crew/graph`);
      console.log('2. Add a .env file with necessary environment variables');
      console.log('3. Run your MCP server using one of these commands:');
      console.log('   - npm run serve         # For STDIO transport (default)');
      console.log('   - npm run serve:sse     # For SSE transport');
      console.log('   - tsx run_mcp.ts        # Direct execution');
    }));
  });

const generateAdapterCommand = (frameworkName: string): Effect.Effect<void, CliError> =>
  Effect.gen(function* (_) {
    const currentDir = process.cwd();
    const safeName = frameworkName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const pascal = toPascalCase(safeName);
    const fileName = `${safeName}.adapter.ts`;
    const filePath = join(currentDir, fileName);
    const content = `import { z } from 'zod';
import { BaseAdapter, AdapterConfig, ToolResult } from 'automcp-ts';

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
    yield* _(writeTextFile(filePath, content));
    yield* _(Effect.sync(() => {
      console.log(`Created adapter skeleton at ${filePath}`);
      console.log('Usage:');
      console.log('  // In your run_mcp.ts');
      console.log(`  import { create${pascal}Adapter } from './${fileName.replace('.ts', '.js')}';`);
      console.log(`  const tool = create${pascal}Adapter(new YourAgent(), name, description, InputSchema.shape);`);
    }));
  });

const toPascalCase = (name: string): string =>
  name
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^(.)/, (m) => m.toUpperCase());

const runCliEffect = (effect: Effect.Effect<void, CliError>): Promise<void> =>
  Effect.runPromise(
    Effect.catchAll(effect, (error) =>
      Effect.sync(() => {
        console.error(renderCliError(error));
        process.exitCode = 1;
      }),
    ),
  );

const availableFrameworks = await Effect.runPromise(
  Effect.catchAll(loadAvailableFrameworksEffect(), () => Effect.succeed([] as string[])),
);

const program = new Command();

program
  .name('automcp-ts')
  .description('AutoMCP-TS - Convert agents to MCP servers in TypeScript')
  .version('0.1.0');

const frameworkChoicesDescription =
  availableFrameworks.length > 0
    ? `Agent framework to use (choices: ${availableFrameworks.join(', ')})`
    : 'Agent framework to use (see templates/framework_config.yaml for options)';

program
  .command('init')
  .description('Create a new MCP server configuration')
  .requiredOption('-f, --framework <framework>', frameworkChoicesDescription)
  .action((options) =>
    runCliEffect(
      Effect.gen(function* (_) {
        const frameworks = yield* _(loadAvailableFrameworksEffect());
        if (!frameworks.includes(options.framework)) {
          yield* _(Effect.fail(new InvalidFrameworkError({ framework: options.framework, available: frameworks })));
          return;
        }
        yield* _(initCommand(options.framework));
      }),
    ),
  );

program
  .command('serve')
  .description('Run the AutoMCP-TS server')
  .option('-t, --transport <transport>', 'Transport to use (stdio or sse)', 'stdio')
  .action((options) =>
    runCliEffect(
      Effect.gen(function* (_) {
        const transport = options.transport as string;
        if (transport !== 'stdio' && transport !== 'sse') {
          yield* _(Effect.fail(new InvalidTransportError({ transport })));
          return;
        }
        yield* _(serveCommand(transport));
      }),
    ),
  );

program
  .command('generate-adapter')
  .description('Generate a from-scratch adapter skeleton in the current directory')
  .requiredOption('-n, --name <frameworkName>', 'Framework name for the new adapter')
  .action((options) => runCliEffect(generateAdapterCommand(options.name as string)));

program.parse();
