import { readFileSync } from 'fs';
import * as yaml from 'js-yaml';
import { AgentConfig, TaskConfig } from './types.js';

export class ConfigLoader {
  static loadAgentsConfig(filePath: string): Record<string, AgentConfig> {
    try {
      const fileContent = readFileSync(filePath, 'utf8');
      const config = yaml.load(fileContent) as Record<string, any>;
      
      const agentsConfig: Record<string, AgentConfig> = {};
      
      for (const [agentName, agentData] of Object.entries(config)) {
        agentsConfig[agentName] = {
          role: agentData.role || '',
          goal: agentData.goal || '',
          backstory: agentData.backstory || '',
          verbose: agentData.verbose || false,
          memory: agentData.memory || false,
          tools: agentData.tools || []
        };
      }
      
      return agentsConfig;
    } catch (error) {
      throw new Error(`Failed to load agents config from ${filePath}: ${error}`);
    }
  }

  static loadTasksConfig(filePath: string): Record<string, TaskConfig> {
    try {
      const fileContent = readFileSync(filePath, 'utf8');
      const config = yaml.load(fileContent) as Record<string, any>;
      
      const tasksConfig: Record<string, TaskConfig> = {};
      
      for (const [taskName, taskData] of Object.entries(config)) {
        tasksConfig[taskName] = {
          description: taskData.description || '',
          expected_output: taskData.expected_output || '',
          agent: taskData.agent,
          context: taskData.context,
          output_file: taskData.output_file,
          output_json: taskData.output_json
        };
      }
      
      return tasksConfig;
    } catch (error) {
      throw new Error(`Failed to load tasks config from ${filePath}: ${error}`);
    }
  }

  static interpolateConfig(
    config: AgentConfig | TaskConfig, 
    variables: Record<string, any>
  ): AgentConfig | TaskConfig {
    const configStr = JSON.stringify(config);
    let interpolated = configStr;
    
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{${key}}`;
      interpolated = interpolated.replace(new RegExp(placeholder, 'g'), value);
    }
    
    return JSON.parse(interpolated);
  }
} 