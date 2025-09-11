import axios, { AxiosInstance } from 'axios';
import * as ty from 'ty-sdk';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

type AnyClient = any;

function pick<T = any>(obj: any, pathStr: string): T | undefined {
  return pathStr.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
}

/**
 * 尝试多种常见的导出形态来构建 ty-sdk 客户端
 */
function buildTyClient(apiKey?: string): AnyClient | null {
  if (!apiKey) return null;

  // 兼容 ESM/CJS：有些包挂在 default 上
  const mod: any = (ty as any)?.default ?? ty;

  // 1) 如果是类（可被 new）
  if (typeof mod === 'function') {
    try {
      return new mod({ apiKey });
    } catch {
      // 2) 如果是工厂函数
      try {
        return mod({ apiKey });
      } catch {
        // ignore
      }
    }
  }

  // 3) 命名导出里常见的构造/工厂
  const candidates = [
    (m: any) => (m?.Client ? new m.Client({ apiKey }) : undefined),
    (m: any) => (typeof m?.createClient === 'function' ? m.createClient({ apiKey }) : undefined),
    (m: any) => (typeof m?.init === 'function' ? m.init({ apiKey }) : undefined),
  ];

  for (const make of candidates) {
    try {
      const c = make(mod);
      if (c) return c;
    } catch {
      // 尝试下一个
    }
  }

  // 4) 最后兜底：有些 SDK 直接导出已经初始化好的客户端，看看能不能用
  return mod;
}

/**
 * 兼容多种聊天/文本生成调用形态，并尽量抽出纯文本
 */
async function tyChat(client: AnyClient, prompt: string, model = 'qwen-plus'): Promise<string> {
  // 1) OpenAI 风格：chat.completions.create
  if (pick(client, 'chat.completions.create')) {
    const res = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
    });
    return (
      pick<string>(res, 'choices.0.message.content') ??
      pick<string>(res, 'choices.0.text') ??
      JSON.stringify(res)
    );
  }

  // 2) OpenAI 新 SDK 风格：responses.create
  if (pick(client, 'responses.create')) {
    const res = await client.responses.create({
      model,
      input: [{ role: 'user', content: prompt }],
    });
    // 常见位置：res.output_text 或 segments
    return (
      (res as any).output_text ??
      pick<string>(res, 'output.0.content.0.text') ??
      JSON.stringify(res)
    );
  }

  // 3) 简化风格：client.generate / client.chat.create / client.text.generate
  const tryCalls: Array<(c: any) => Promise<any>> = [
    (c) => c.generate({ model, prompt }),
    (c) => c.chat?.create?.({ model, messages: [{ role: 'user', content: prompt }] }),
    (c) => c.text?.generate?.({ model, prompt }),
    (c) => c.completions?.create?.({ model, prompt }),
  ].filter(Boolean) as any;

  for (const call of tryCalls) {
    try {
      const res = await call(client);
      // 常见返回字段尝试
      const text =
        pick<string>(res, 'choices.0.message.content') ??
        pick<string>(res, 'choices.0.text') ??
        pick<string>(res, 'data.0.text') ??
        (res as any).text ??
        (res as any).output_text ??
        JSON.stringify(res);
      if (text) return text;
    } catch {
      // 尝试下一个形态
    }
  }

  throw new Error('Unsupported ty-sdk client shape: cannot find a compatible chat/generate method.');
}

export class OllamaService {
  private axiosInstance: AxiosInstance;
  private readonly OLLAMA_BASE_URL = 'http://localhost:11434';
  private cloudClient: AnyClient | null;

  constructor() {
    this.axiosInstance = axios.create({ baseURL: this.OLLAMA_BASE_URL });

    const apiKey = process.env.DASHSCOPE_API_KEY;
    this.cloudClient = buildTyClient(apiKey);

    if (this.cloudClient) {
      console.log('[OllamaService] Cloud client (ty-sdk) initialized.');
    } else {
      console.warn('[OllamaService] DASHSCOPE_API_KEY not found or ty-sdk init failed. Cloud completion disabled.');
    }
  }

  public async checkHealth(): Promise<boolean> {
    try {
      await this.axiosInstance.get('/');
      return true;
    } catch {
      return false;
    }
  }

  public async generateLocalCompletion(prompt: string, model: string): Promise<string | null> {
    try {
      console.log(`[OllamaService] Generating completion with LOCAL model: ${model}...`);
      const response = await this.axiosInstance.post('/api/generate', {
        model,
        prompt,
        stream: false,
      });
      return response.data?.response ?? null;
    } catch (error: any) {
      console.error(`Error communicating with Ollama model ${model}:`, error?.message || error);
      return null;
    }
  }

  /**
   * 使用 ty-sdk 走云端（如 qwen-plus）
   */
  public async generateCloudCompletion(prompt: string, model = 'qwen-plus'): Promise<string | null> {
    if (!this.cloudClient) {
      const msg = 'Error: Cloud client is not initialized. Check DASHSCOPE_API_KEY and ty-sdk.';
      console.error(`[OllamaService] ${msg}`);
      return msg;
    }

    try {
      console.log(`[OllamaService] Generating completion with CLOUD model: ${model}...`);
      const text = await tyChat(this.cloudClient, prompt, model);
      return text ?? null;
    } catch (error: any) {
      console.error(`Error communicating with ty-sdk API:`, error?.message || error);
      return null;
    }
  }
}
