import axios, { AxiosInstance } from 'axios';
import { StorageService } from './storage.service';

/**
 * Service for interacting with the cloud API.
 * It handles authentication by automatically attaching the API token to requests.
 */
export class ApiService {
  private axiosInstance: AxiosInstance;

  constructor() {
    // 1. Initialize axios instance with base URL and timeout
    this.axiosInstance = axios.create({
      baseURL: 'http://localhost:3333',
      timeout: 15000,
    });

    // 2. Implement a request interceptor to add the auth token
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        // Retrieve the token from secure storage
        const token = await StorageService.getToken();
        if (token) {
          // If a token exists, add it to the Authorization header
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        // Handle request configuration errors
        return Promise.reject(error);
      },
    );

    // 3. (Optional) A response interceptor could be added here for retries
    // For simplicity, we'll omit it for now but it's a great place for it.
  }

  /**
   * Provides direct access to the underlying Axios instance.
   * Useful for specific scenarios like login where the request interceptor should be bypassed.
   * @returns The AxiosInstance.
   */
  public getAxiosInstance(): AxiosInstance {
    return this.axiosInstance;
  }

  /**
   * Fetches the next available task from the API.
   * @returns The data from the API response.
   */
  public async getTasks(): Promise<any> {
    try {
      // --- START OF CHANGE ---
      const response = await this.axiosInstance.get('/auth/agent/tasks/next'); // Add '/auth' prefix
      // --- END OF CHANGE ---
      return response.data;
    } catch (error) {
      console.error('Failed to fetch tasks:', error.message);
      return null;
    }
  }
}

export const apiService = new ApiService();