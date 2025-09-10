import { apiService } from '../services/api.service';
import { BrowserService } from '../services/browser.service';
import { OllamaService } from '../services/ollama.service';

/**
 * 一个用于引入延迟的工具函数。
 * @param ms 等待的毫秒数。
 * @returns 一个在指定延迟后解析的 Promise。
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 代理的主要控制循环。
 * 它负责协调获取任务、使用 LLM 做出决策以及与浏览器交互。
 */
export class AgentLoop {
  private ollamaService: OllamaService;
  private browserService: BrowserService;

  constructor() {
    // 注意：我们直接使用单例的 `apiService`。
    this.ollamaService = new OllamaService();
    this.browserService = new BrowserService();
  }

  /**
   * 启动代理的主要执行循环。
   */
  public async start(): Promise<void> {
    while (true) {
      console.log('--- Starting new loop iteration ---');

      const task = await apiService.getTasks();

      if (task) {
        console.log('Received task:', task);

        const prompt = `My task is: "${task.type}". What is my first step?`;
        console.log(`Generating decision for prompt: "${prompt}"`);

        const decision = await this.ollamaService.generateCompletion(prompt, 'qwen:7b');
        console.log('LLM Decision:', decision);

        // 未来的步骤将涉及使用 browserService 对此决策采取行动。
      } else {
        console.log('No tasks found, waiting...');
      }

      await delay(10000); // 在下一次迭代前等待10秒
    }
  }
}