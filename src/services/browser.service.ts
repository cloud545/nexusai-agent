import axios, { type AxiosInstance } from 'axios';
// highlight-next-line
import { chromium, type Browser, type Page } from 'playwright-core'; // <-- 确认已修改

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class BrowserService {
  // ... (私有属性和构造函数保持不变) ...
  private axiosInstance: AxiosInstance;
  private playwrightPage: Page | null = null;
  private playwrightBrowser: Browser | null = null;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: 'http://localhost:50325',
      timeout: 30000,
      proxy: false, 
    });
  }

  public async startBrowser(adspowerProfileId: string): Promise<Page | null> {
    try {
      // --- STEP 1: START (与之前相同) ---
      console.log(`[BrowserService] Sending START command for profile ${adspowerProfileId}...`);
      await this.axiosInstance.get('/api/v1/browser/start', {
        params: { user_id: adspowerProfileId, open_tabs: '0' },
        timeout: 30000,
      });
      console.log(`[BrowserService] START command sent. Waiting...`);

      // --- STEP 2: POLL (与之前相同) ---
      let wsEndpoint: string | null = null;
      const maxRetries = 15;
      for (let i = 0; i < maxRetries; i++) {
        await delay(2000);
        console.log(`[BrowserService] Checking status... (Attempt ${i + 1}/${maxRetries})`);
        const activeResponse = await this.axiosInstance.get('/api/v1/browser/active', {
          params: { user_id: adspowerProfileId },
        });
        const endpoint = activeResponse.data?.data?.ws?.puppeteer;
        const status = activeResponse.data?.data?.status;
        if (status === 'Active' && endpoint) {
          wsEndpoint = endpoint;
          console.log(`[BrowserService] Browser is ACTIVE. WS Endpoint found: ${wsEndpoint}`);
          break;
        }
      }

      if (!wsEndpoint) {
        throw new Error('Browser did not become active or WS endpoint not found.');
      }

      // --- STEP 3: CONNECT (核心修改) ---
      console.log('[BrowserService] Attempting to connect with Playwright...');
      
      // 使用 .connectOverCDP()，这是一个更底层的连接方式，有时更稳定
      this.playwrightBrowser = await chromium.connectOverCDP(wsEndpoint, { timeout: 60000 }); // 增加超时到60秒
      
      console.log('[BrowserService] Successfully connected to browser instance.');

      const defaultContext = this.playwrightBrowser.contexts()[0];
      if (!defaultContext) {
        throw new Error('Browser connected but no default context found.');
      }
      
      this.playwrightPage = defaultContext.pages()[0];
      if (!this.playwrightPage) {
        console.log('[BrowserService] No initial page found, creating a new one.');
        this.playwrightPage = await defaultContext.newPage();
      }

      console.log('✅ [BrowserService] Playwright page object is ready.');
      return this.playwrightPage;

    } catch (error) {
      const errorMessage = error.response?.data?.msg || error.message;
      console.error(`[BrowserService] An error occurred: ${errorMessage}`);
      throw error;
    }
  }

  // ... (getPage方法保持不变) ...
  public getPage(): Page {
    if (!this.playwrightPage) {
      throw new Error('Page is not initialized. Please call startBrowser() first.');
    }
    return this.playwrightPage;
  }
}