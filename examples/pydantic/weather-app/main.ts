import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

// TypeScript interfaces for type safety (converted from Python dict[str, type] patterns)
interface Coordinates {
  lat: number;
  lng: number;
}

interface WeatherData {
  temperature: string;
  description: string;
}

interface GeoApiResponse {
  lat: string;
  lon: string;
}

interface WeatherApiResponse {
  data: {
    values: {
      temperatureApparent: number;
      weatherCode: number;
    };
  };
}

// Simple agent context interface (replacing pydantic_ai patterns)
interface AgentContext {
  retries: number;
  maxRetries: number;
}

class ModelRetryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelRetryError';
  }
}

class WeatherAgent {
  private systemPrompt: string;
  private maxRetries: number;

  constructor(model: string, systemPrompt: string, retries: number = 2) {
    this.systemPrompt = systemPrompt;
    this.maxRetries = retries;
  }

  // Convert Python decorator pattern to TypeScript method
  async getLatLng(locationDescription: string): Promise<Coordinates> {
    /**
     * Get the latitude and longitude of a location.
     * 
     * @param locationDescription - A description of a location
     * @returns Coordinates object with lat/lng
     */
    if (!process.env.GEO_API_KEY) {
      // if no API key is provided, return a dummy response (London)
      return { lat: 51.1, lng: -0.1 };
    }

    try {
      const response = await axios.get<GeoApiResponse[]>('https://geocode.maps.co/search', {
        params: {
          q: locationDescription,
          api_key: process.env.GEO_API_KEY
        }
      });

      const data = response.data;

      if (data && data.length > 0) {
        return { 
          lat: parseFloat(data[0].lat), 
          lng: parseFloat(data[0].lon) 
        };
      } else {
        throw new ModelRetryError('Could not find the location');
      }
    } catch (error) {
      if (error instanceof ModelRetryError) {
        throw error;
      }
      throw new Error(`Geocoding API error: ${error}`);
    }
  }

  // Convert Python decorator pattern to TypeScript method
  async getWeather(lat: number, lng: number): Promise<WeatherData> {
    /**
     * Get the weather at a location.
     * 
     * @param lat - Latitude of the location
     * @param lng - Longitude of the location
     * @returns Weather data object
     */
    if (!process.env.WEATHER_API_KEY) {
      // if no API key is provided, return a dummy response
      return { temperature: '21 °C', description: 'Sunny' };
    }

    try {
      const response = await axios.get<WeatherApiResponse>('https://api.tomorrow.io/v4/weather/realtime', {
        params: {
          apikey: process.env.WEATHER_API_KEY,
          location: `${lat},${lng}`,
          units: 'metric',
        }
      });

      const values = response.data.data.values;
      
      // Weather code lookup (converted from Python dict)
      const codeLookup: Record<number, string> = {
        1000: 'Clear, Sunny',
        1100: 'Mostly Clear',
        1101: 'Partly Cloudy',
        1102: 'Mostly Cloudy',
        1001: 'Cloudy',
        2000: 'Fog',
        2100: 'Light Fog',
        4000: 'Drizzle',
        4001: 'Rain',
        4200: 'Light Rain',
        4201: 'Heavy Rain',
        5000: 'Snow',
        5001: 'Flurries',
        5100: 'Light Snow',
        5101: 'Heavy Snow',
        6000: 'Freezing Drizzle',
        6001: 'Freezing Rain',
        6200: 'Light Freezing Rain',
        6201: 'Heavy Freezing Rain',
        7000: 'Ice Pellets',
        7101: 'Heavy Ice Pellets',
        7102: 'Light Ice Pellets',
        8000: 'Thunderstorm',
      };

      return {
        temperature: `${Math.round(values.temperatureApparent)}°C`,
        description: codeLookup[values.weatherCode] || 'Unknown',
      };
    } catch (error) {
      throw new Error(`Weather API error: ${error}`);
    }
  }

  // Simplified agent run method (replacing pydantic_ai agent patterns)
  async runSync(query: string): Promise<{ data: string }> {
    let attempts = 0;
    
    while (attempts < this.maxRetries) {
      try {
        // Simple query processing - in a real implementation, 
        // this would integrate with an LLM service
        if (query.toLowerCase().includes('weather')) {
          // Extract location from query (simplified approach)
          const locationMatch = query.match(/weather (?:in|at) ([^?]+)/i);
          const location = locationMatch ? locationMatch[1].trim() : 'London';
          
          const coords = await this.getLatLng(location);
          const weather = await this.getWeather(coords.lat, coords.lng);
          
          return {
            data: `The weather in ${location} is ${weather.temperature} and ${weather.description}.`
          };
        }
        
        return { data: 'I can help you with weather information. Please ask about the weather in a specific location.' };
      } catch (error) {
        attempts++;
        if (attempts >= this.maxRetries || !(error instanceof ModelRetryError)) {
          throw error;
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    throw new Error('Max retries exceeded');
  }
}

// Create the weather agent (converted from Python global variable pattern)
const weatherAgent = new WeatherAgent(
  'openai:gpt-4o-mini',
  'Be concise, reply with one sentence. ' +
  'Use the getLatLng tool to get the latitude and longitude of the locations, ' +
  'then use the getWeather tool to get the weather.',
  2
);

// Main execution (converted from Python if __name__ == '__main__' pattern)
async function main() {
  try {
    const result = await weatherAgent.runSync('What is the weather in Tokyo?');
    console.log(result.data);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Execute if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { WeatherAgent, type Coordinates, type WeatherData }; 