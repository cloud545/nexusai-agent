import axios, { AxiosError, AxiosInstance } from 'axios';

/**
 * Service for interacting with a local Ollama API instance.
 */
export class OllamaService {
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: 'http://localhost:11434',
      timeout: 60000, // Set a longer timeout for potentially long-running generations
    });
  }

  /**
   * Checks if the Ollama API is running and accessible.
   * @returns A promise that resolves to true if Ollama is running, false otherwise.
   */
  public async checkHealth(): Promise<boolean> {
    try {
      await this.axiosInstance.get('/');
      console.log('Ollama health check successful.');
      return true;
    } catch (error) {
      console.error('Ollama health check failed. Is Ollama running?', (error as AxiosError).message);
      return false;
    }
  }

  /**
   * Generates a text completion using a specified model in Ollama.
   * @param prompt The text prompt to send to the model.
   * @param model The name of the model to use (e.g., 'llama3').
   * @returns A promise that resolves to the full text response from the model, or null if an error occurs.
   */
  public async generateCompletion(prompt: string, model: string): Promise<string | null> {
    try {
      console.log(`Generating completion with model '${model}'...`);
      const response = await this.axiosInstance.post('/api/generate', {
        model,
        prompt,
        stream: false, // We want the full response at once
      });

      return response.data?.response;
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error(`Failed to generate completion: ${axiosError.message}`);
      // Log more details if available, like the response data from Ollama
      if (axiosError.response) {
        console.error('Ollama API Error:', axiosError.response.data);
      }
      return null;
    }
  }
}