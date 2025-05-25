import 'dotenv/config';
import { 
  VectorStoreIndex, 
  SimpleDirectoryReader,
  Settings
} from 'llamaindex';
import { OpenAI } from '@llamaindex/openai';
import { PineconeVectorStore } from '@llamaindex/pinecone';
import { Pinecone } from 'pinecone';
import { Database } from 'sqlite3';
import { promisify } from 'util';

interface CityStats {
  city_name: string;
  population: number;
  country: string;
}

export class QueryAgent {
  private pinecone: Pinecone;
  private vectorIndex: VectorStoreIndex | null = null;
  private sqlDatabase: Database;
  private llm: OpenAI;

  constructor(openaiModel: string = "gpt-4o-mini") {
    // Configure LlamaIndex settings
    this.llm = new OpenAI({ model: openaiModel });
    Settings.llm = this.llm;
    
    // Initialize Pinecone
    this.pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!
    });

    // Initialize SQLite database
    this.sqlDatabase = new Database(':memory:');
    
    this.init();
  }

  private async init() {
    await this.setupPineconeIndex();
    await this.setupSqlDatabase();
    await this.setupVectorStore();
  }

  private async setupPineconeIndex(): Promise<void> {
    try {
      const indexes = await this.pinecone.listIndexes();
      const indexExists = indexes.indexes?.some((index: any) => index.name === "quickstart-sql");

      if (!indexExists) {
        await this.pinecone.createIndex({
          name: "quickstart-sql",
          dimension: 1536,
          metric: "euclidean",
          spec: {
            serverless: {
              cloud: "aws",
              region: "us-east-1"
            }
          }
        });

        // Wait for index to be ready
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    } catch (error) {
      console.error("Error setting up Pinecone index:", error);
      throw error;
    }
  }

  private async setupSqlDatabase(): Promise<void> {
    const runAsync = promisify(this.sqlDatabase.run.bind(this.sqlDatabase));

    // Create city stats table
    await runAsync(`
      CREATE TABLE IF NOT EXISTS city_stats (
        city_name TEXT PRIMARY KEY,
        population INTEGER,
        country TEXT NOT NULL
      )
    `);

    // Insert sample data using individual statements
    const cityData: CityStats[] = [
      { city_name: "Toronto", population: 2930000, country: "Canada" },
      { city_name: "Tokyo", population: 13960000, country: "Japan" },
      { city_name: "Berlin", population: 3645000, country: "Germany" }
    ];

    for (const city of cityData) {
      const insertQuery = `
        INSERT OR REPLACE INTO city_stats (city_name, population, country) 
        VALUES ('${city.city_name}', ${city.population}, '${city.country}')
      `;
      await runAsync(insertQuery);
    }
  }

  private async setupVectorStore(): Promise<void> {
    try {
      // Create Pinecone vector store
      const vectorStore = new PineconeVectorStore({
        pineconeIndex: this.pinecone.Index("quickstart-sql"),
        namespace: "wiki_cities"
      });

      // Check if we already have data
      const indexStats = await this.pinecone.Index("quickstart-sql").describeIndexStats();
      if (indexStats.totalVectorCount && indexStats.totalVectorCount > 0) {
        // Load existing index
        this.vectorIndex = await VectorStoreIndex.fromVectorStore(vectorStore);
        return;
      }

      // Load city information (simplified - you'd need to implement Wikipedia reader)
      const cities = ["Toronto", "Berlin", "Tokyo"];
      const documents = cities.map(city => ({
        id: city.toLowerCase(),
        text: `Information about ${city}. This is a major city known for its culture and population.`,
        metadata: { title: city }
      }));

      // Create index with documents
      this.vectorIndex = await VectorStoreIndex.fromDocuments(
        documents.map(doc => ({ 
          id_: doc.id,
          text: doc.text, 
          metadata: doc.metadata 
        })),
        { vectorStore }
      );

    } catch (error) {
      console.error("Error setting up vector store:", error);
      throw error;
    }
  }

  async querySQL(query: string): Promise<any[]> {
    const allAsync = promisify(this.sqlDatabase.all.bind(this.sqlDatabase));
    try {
      // Simple SQL query execution (in production, you'd use a proper SQL query engine)
      const results = await allAsync(query) as any[];
      return results;
    } catch (error) {
      console.error("SQL query error:", error);
      throw error;
    }
  }

  async queryVector(query: string, topK: number = 3): Promise<any[]> {
    if (!this.vectorIndex) {
      throw new Error("Vector index not initialized");
    }

    try {
      const queryEngine = this.vectorIndex.asQueryEngine();
      const response = await queryEngine.query({ query });
      
      return [{
        text: response.toString(),
        score: 1.0 // LlamaIndex.TS might not expose raw scores the same way
      }];
    } catch (error) {
      console.error("Vector query error:", error);
      throw error;
    }
  }

  async processQuery(userQuery: string): Promise<string> {
    try {
      // Determine if this is a SQL or vector query (simple heuristic)
      const isSQLQuery = userQuery.toLowerCase().includes('population') || 
                         userQuery.toLowerCase().includes('country') ||
                         userQuery.toLowerCase().includes('highest');

      if (isSQLQuery) {
        // Handle SQL queries
        const sqlQuery = "SELECT * FROM city_stats ORDER BY population DESC";
        const results = await this.querySQL(sqlQuery);
        return `SQL Query Results: ${JSON.stringify(results, null, 2)}`;
      } else {
        // Handle vector queries
        const results = await this.queryVector(userQuery);
        return `Vector Search Results: ${results[0]?.text || 'No results found'}`;
      }
    } catch (error) {
      console.error("Error processing query:", error);
      return `Error processing query: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  async close(): Promise<void> {
    if (this.sqlDatabase) {
      this.sqlDatabase.close();
    }
  }
}

// Example usage
async function main() {
  try {
    const agent = new QueryAgent();
    
    // Give some time for initialization
    await new Promise(resolve => setTimeout(resolve, 2000));

    const queries = [
      "Tell me about the arts and culture of the city with the highest population.",
      "Tell me about the history of Berlin",
      "Can you give me the country corresponding to each city you know?"
    ];

    for (const query of queries) {
      console.log(`\nQuery: ${query}`);
      const response = await agent.processQuery(query);
      console.log(`Response: ${response}`);
    }

    await agent.close();
  } catch (error) {
    console.error("Main error:", error);
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
} 