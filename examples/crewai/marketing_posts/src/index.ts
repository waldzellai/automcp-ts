#!/usr/bin/env node

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { MarketingPostsCrew } from './marketing-posts-crew.js';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
const envPath = resolve(__dirname, '../../../.env');
config({ path: envPath });

export async function run(): Promise<void> {
  console.log('🚀 Starting Marketing Posts Crew...\n');

  // Replace with your inputs, it will automatically interpolate any tasks and agents information
  const inputs = {
    customer_domain: "crewai.com",
    project_description: `
CrewAI, a leading provider of multi-agent systems, aims to revolutionize marketing automation for its enterprise clients. This project involves developing an innovative marketing strategy to showcase CrewAI's advanced AI-driven solutions, emphasizing ease of use, scalability, and integration capabilities. The campaign will target tech-savvy decision-makers in medium to large enterprises, highlighting success stories and the transformative potential of CrewAI's platform.

Customer Domain: AI and Automation Solutions
Project Overview: Creating a comprehensive marketing campaign to boost awareness and adoption of CrewAI's services among enterprise clients.
`
  };

  try {
    const marketingCrew = new MarketingPostsCrew();
    const crew = marketingCrew.crew();
    const result = await crew.kickoff(inputs);
    
    console.log('\n📊 Got result:', result.json_dict);
    console.log('\n📈 Usage metrics:', result.usage_metrics);
    
    // Save result to file
    await fs.writeFile('result.json', JSON.stringify(result, null, 2), 'utf8');
    console.log('\n💾 Result saved to result.json');
    
  } catch (error) {
    console.error('❌ Error running marketing crew:', error);
    process.exit(1);
  }
}

export async function train(): Promise<void> {
  console.log('🎯 Starting Training Mode...\n');
  
  const inputs = {
    customer_domain: "crewai.com",
    project_description: `
CrewAI, a leading provider of multi-agent systems, aims to revolutionize marketing automation for its enterprise clients. This project involves developing an innovative marketing strategy to showcase CrewAI's advanced AI-driven solutions, emphasizing ease of use, scalability, and integration capabilities. The campaign will target tech-savvy decision-makers in medium to large enterprises, highlighting success stories and the transformative potential of CrewAI's platform.

Customer Domain: AI and Automation Solutions
Project Overview: Creating a comprehensive marketing campaign to boost awareness and adoption of CrewAI's services among enterprise clients.
`
  };

  try {
    const iterations = process.argv[2] ? parseInt(process.argv[2]) : 3;
    const marketingCrew = new MarketingPostsCrew();
    await marketingCrew.train(iterations, inputs);
    
  } catch (error) {
    console.error('❌ Error during training:', error);
    process.exit(1);
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  if (command === 'train') {
    train();
  } else {
    run();
  }
} 