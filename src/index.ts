import { app } from 'electron';
import { AgentLoop } from './agent/agent.loop';
import { ApiService } from './services/api.service';
import { StorageService } from './services/storage.service';

async function initializeAndAuth(): Promise<ApiService | null> {
  console.log('[Agent引导程序] 正在初始化并确保认证...');
  let token = await StorageService.getToken();

  if (token) {
      console.log('[Agent引导程序] 发现已存在的令牌，正在验证...');
      const tempApiService = new ApiService(token);
      if (await tempApiService.verifyToken()) {
          console.log('[Agent引导程序] 令牌有效。ApiService已准备就绪。');
          return tempApiService;
      }
      console.warn('[Agent引导程序] 已存在的令牌无效或已过期，尝试重新登录。');
  }

  console.log('[Agent引导程序] 无有效令牌，尝试使用凭证登录...');
  const newToken = await ApiService.login('user123@test.com', 'StrongPassword123'); // 【【【 请替换为您的测试凭证 】】】

  if (newToken) {
      await StorageService.setToken(newToken);
      console.log('[Agent引导程序] 登录成功，新令牌已获取并存储。');
      return new ApiService(newToken);
  }

  console.error('[Agent引导程序] 致命错误：登录失败，无法获取有效令牌。');
  return null;
}

async function main() {
  console.log('--- NexusAI Agent Starting ---');

  try {
    const apiService = await initializeAndAuth();
    if (apiService) {
      const agentLoop = new AgentLoop(apiService);
      await agentLoop.run();
    } else {
      console.error("无法初始化ApiService，Agent无法启动。将在1分钟后重试...");
      // In a real app, you might want a more robust retry mechanism here
      // or exit the app completely.
      setTimeout(main, 60000);
    }
  } catch (error) {
    console.error('An unhandled error occurred during agent initialization:', error);
  }
}

app.whenReady().then(main);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});