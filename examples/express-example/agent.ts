import { ExpressAgent } from '../../src/adapters/express.js';

// Example Express agent that processes different types of requests
export class WeatherAPIAgent implements ExpressAgent {
  private weatherData = {
    'new-york': { temperature: 22, humidity: 65, condition: 'sunny' },
    'london': { temperature: 15, humidity: 80, condition: 'cloudy' },
    'tokyo': { temperature: 28, humidity: 70, condition: 'partly-cloudy' },
    'sydney': { temperature: 25, humidity: 60, condition: 'sunny' }
  };

  async handleRequest(inputs: {
    endpoint: string;
    method: string;
    data?: any;
  }) {
    const { endpoint, method, data } = inputs;

    // Simulate Express.js route handling
    if (method === 'GET' && endpoint.startsWith('/weather/')) {
      return this.getWeather(endpoint);
    }

    if (method === 'POST' && endpoint === '/weather') {
      return this.updateWeather(data);
    }

    if (method === 'GET' && endpoint === '/health') {
      return this.healthCheck();
    }

    // Default response for unknown endpoints
    return {
      status: 404,
      error: 'Endpoint not found',
      endpoint,
      method,
      availableEndpoints: [
        'GET /weather/{city}',
        'POST /weather',
        'GET /health'
      ]
    };
  }

  private getWeather(endpoint: string) {
    const city = endpoint.split('/weather/')[1]?.toLowerCase();
    
    if (!city) {
      return {
        status: 400,
        error: 'City parameter is required',
        example: '/weather/new-york'
      };
    }

    const weather = this.weatherData[city as keyof typeof this.weatherData];
    
    if (!weather) {
      return {
        status: 404,
        error: 'Weather data not found for city',
        city,
        availableCities: Object.keys(this.weatherData)
      };
    }

    return {
      status: 200,
      city,
      weather,
      timestamp: new Date().toISOString()
    };
  }

  private updateWeather(data: any) {
    if (!data || !data.city || !data.weather) {
      return {
        status: 400,
        error: 'City and weather data are required',
        example: {
          city: 'paris',
          weather: { temperature: 20, humidity: 75, condition: 'rainy' }
        }
      };
    }

    const city = data.city.toLowerCase();
    this.weatherData[city as keyof typeof this.weatherData] = data.weather;

    return {
      status: 200,
      message: 'Weather data updated successfully',
      city,
      weather: data.weather,
      timestamp: new Date().toISOString()
    };
  }

  private healthCheck() {
    return {
      status: 200,
      message: 'Weather API is healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      availableCities: Object.keys(this.weatherData).length
    };
  }
} 