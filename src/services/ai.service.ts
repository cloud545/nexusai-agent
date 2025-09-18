// FILE: nexusai-agent/src/main/services/ai.service.ts
// 最终诊断版 - 硬编码Key并完整打印请求/响应

import axios, { AxiosInstance } from 'axios';

// 定义AI提供商的类型
type AiProvider = 'ollama' | 'qwen';

// 定义从云端获取的配置对象结构
interface AiServiceConfig {
  aiProvider: string;
  ollamaModel?: string;
  qwenApiKey?: string;
  qwenModelName?: string;
}

/**
 * 核心AI服务类。
 * [诊断模式]: 当前版本硬编码了Qwen的API Key，并会完整打印出站请求和入站响应。
 */
export class AiService {
  private provider: AiProvider;
  private isInitialized = false;

  private ollamaClient: AxiosInstance;
  private ollamaModel: string;

  private qwenClient: AxiosInstance;
  private qwenModelName: string;

  constructor() {
    // 构造函数保持为空
  }

  public async initialize(config: AiServiceConfig): Promise<void> {
    if (!config || !config.aiProvider) {
      throw new Error('[AiService] 致命错误: 从云端接收到的配置无效。');
    }

    this.provider = config.aiProvider as AiProvider;
    console.log(`[AiService] 初始化中，Provider: "${this.provider}"`);

    if (this.provider === 'ollama') {
      this.ollamaModel = config.ollamaModel || 'mistral:7b-instruct';
      this.ollamaClient = axios.create({ /* ... */ });
      console.log(`[AiService] Ollama 本地模式已配置，模型: "${this.ollamaModel}"`);
      
    } else if (this.provider === 'qwen') {
      if (!config.qwenModelName) { // We don't need to check for the key from config anymore in this mode
        throw new Error('[AiService] 致命错误: 配置为 "qwen" 但缺少模型名称。');
      }
      
      this.qwenModelName = config.qwenModelName;
      
      // --- 终极硬编码测试 ---
      const hardcodedApiKey = "sk-29ea20528a894aa78541870e454b5416"; // <-- 在这里替换成你真实的、已验证的Key
      console.warn('--- [DIAGNOSTIC MODE ACTIVE] ---');
      console.warn('--- 正在使用硬编码的API Key进行Qwen请求 ---');
      
      this.qwenClient = axios.create({
        baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        timeout: 30000, // 30秒超时
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${hardcodedApiKey}`,
        }
      });
      // --- 硬编码测试结束 ---

      console.log(`[AiService] 通义千问 (Qwen) 手动模式已配置。`);
      console.log(`[AiService] -> 模型名称: ${this.qwenModelName}`);

    } else {
      throw new Error(`[AiService] 致命错误: 无效的AI提供商名称: "${this.provider}"`);
    }

    this.isInitialized = true;
  }

  public async generateDecision(prompt: string): Promise<string | null> {
    if (!this.isInitialized) {
      throw new Error('[AiService] 致命错误: AiService 未初始化。');
    }
    
    if (this.provider === 'ollama') {
      return this.generateWithOllama(prompt);
    }
    if (this.provider === 'qwen') {
      return this.generateWithQwenManual(prompt);
    }
    return null;
  }
  
  private async generateWithOllama(prompt: string): Promise<string | null> {
    // ... 此方法不变 ...
    try {
      const response = await this.ollamaClient.post('/api/generate', { /* ... */ });
      return response.data.response;
    } catch (error) {
      console.error('[AiService-Ollama] 调用失败:', error.message);
      return null;
    }
  }

  /**
   * [诊断模式] 手动构建并完整打印与Qwen的通信。
   */
  private async generateWithQwenManual(prompt: string): Promise<string | null> {
    const url = '/chat/completions';
    const payload = {
      model: this.qwenModelName,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    }; 

    // --- 完整请求打印 ---
    console.log('\n--- [QWEN OUTGOING REQUEST DETAILS (BLACKBOX)] ---');
    console.log(`- Time: ${new Date().toISOString()}`);
    console.log(`- Target URL: ${this.qwenClient.defaults.baseURL}${url}`);
    console.log(`- Headers: ${JSON.stringify(this.qwenClient.defaults.headers, null, 2)}`);
    console.log(`- Payload: ${JSON.stringify(payload, null, 2)}`);
    console.log('--------------------------------------------------\n');
    // --- 打印结束 ---

    try {
      const response = await this.qwenClient.post(url, payload);
      
      // --- 完整响应打印 ---
      console.log('\n--- [QWEN INCOMING RESPONSE (BLACKBOX)] ---');
      console.log(`- Time: ${new Date().toISOString()}`);
      console.log(`- Status: ${response.status} ${response.statusText}`);
      console.log(`- Headers: ${JSON.stringify(response.headers, null, 2)}`);
      console.log(`- Data: ${JSON.stringify(response.data, null, 2)}`);
      console.log('--------------------------------------------------\n');
      // --- 打印结束 ---

      const content = response.data?.choices?.[0]?.message?.content;
      if (content) {
        return content;
      }
      
      console.error('[AiService-QwenManual] 响应格式不正确，未找到content。');
      return null;

    } catch (error) {
        // --- 完整错误打印 ---
        console.error('\n--- [QWEN REQUEST FAILED (BLACKBOX)] ---');
        console.error(`- Time: ${new Date().toISOString()}`);
        console.error(`- Error Message: ${error.message}`);
        if (axios.isAxiosError(error)) {
             console.error(`- Response Status: ${error.response?.status}`);
             console.error(`- Response Headers: ${JSON.stringify(error.response?.headers, null, 2)}`);
             console.error(`- Response Data: ${JSON.stringify(error.response?.data, null, 2)}`);
        }
        console.error('--------------------------------------------------\n');
        // --- 打印结束 ---
        return null;
    }
  }
}