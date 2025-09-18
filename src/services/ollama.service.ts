// FILE: nexusai-agent/src/main/services/ai.service.ts (Rename from ollama.service.ts)

import axios, { AxiosInstance } from 'axios';
import * as dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Load environment variables from .env file
dotenv.config();

type AiProvider = 'ollama' | 'gemini';

export class AiService {
  private provider: AiProvider;
  private ollamaModel: string;

  // Clients for different providers
  private ollamaClient: AxiosInstance;
  private geminiClient: GoogleGenerativeAI;
  
  constructor() {
    this.provider = (process.env.AI_PROVIDER as AiProvider) || 'ollama';
    this.ollamaModel = process.env.OLLAMA_MODEL || 'mistral:7b-instruct';

    console.log(`[AiService] Initializing with provider: ${this.provider}`);

    if (this.provider === 'ollama') {
      this.ollamaClient = axios.create({
        baseURL: 'http://localhost:11434',
        timeout: 60000,
      });
    } else if (this.provider === 'gemini') {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('[AiService] FATAL: AI_PROVIDER is set to "gemini" but GEMINI_API_KEY is missing in .env file.');
      }
      this.geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    } else {
        throw new Error(`[AiService] FATAL: Invalid AI_PROVIDER "${this.provider}" in .env file. Use "ollama" or "gemini".`);
    }
  }

  public async generateDecision(prompt: string): Promise<string | null> {
    console.log(`[AiService] Generating decision using ${this.provider}...`);
    
    if (this.provider === 'ollama') {
      return this.generateWithOllama(prompt);
    }
    
    if (this.provider === 'gemini') {
      return this.generateWithGemini(prompt);
    }

    return null;
  }
  
  private async generateWithOllama(prompt: string): Promise<string | null> {
    try {
      const response = await this.ollamaClient.post('/api/generate', {
        model: this.ollamaModel,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.1, // Lower temperature for more deterministic, instruction-following behavior
          top_p: 0.9,
        }
      });
      return response.data.response;
    } catch (error) {
      console.error('[AiService-Ollama] Failed to generate completion:', error.message);
      return null;
    }
  }

  private async generateWithGemini(prompt: string): Promise<string | null> {
    try {
        const model = this.geminiClient.getGenerativeModel({ model: "gemini-pro"});
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        return text;
    } catch (error) {
        console.error('[AiService-Gemini] Failed to generate completion:', error.message);
        return null;
    }
  }
}