import axios, { type AxiosInstance } from 'axios';
import { chromium, type Browser, type Page } from 'playwright';

/**
 * Service to manage the browser instance controlled by Adspower via Playwright.
 */
export class BrowserService {
  private axiosInstance: AxiosInstance;
  private playwrightPage: Page | null = null;
  private playwrightBrowser: Browser | null = null;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: 'http://localhost:50325',
    });
  }

  /**
   * Starts a browser instance for a given Adspower profile ID and connects to it using Playwright.
   * @param adspowerProfileId The ID of the Adspower profile to launch.
   * @returns The Playwright Page object for the started browser.
   */
  public async startBrowser(adspowerProfileId: string): Promise<Page> {
    try {
      console.log(`Attempting to start browser for profile ${adspowerProfileId}...`);

      const response = await this.axiosInstance.get('/api/v1/browser/start', {
        params: {
          user_id: adspowerProfileId,
        },
      });

      const wsEndpoint = response.data?.data?.ws?.playwright;

      if (wsEndpoint) {
        this.playwrightBrowser = await chromium.connect(wsEndpoint);
        const contexts = this.playwrightBrowser.contexts();
        this.playwrightPage = contexts[0].pages()[0];

        console.log('Browser started and connected successfully.');
        return this.playwrightPage;
      } else {
        throw new Error('Playwright WebSocket endpoint not found in API response.');
      }
    } catch (error) {
      console.error('Failed to start or connect to the browser:', error);
      // Re-throwing the error allows the caller to handle it, which is good practice.
      throw error;
    }
  }

  /**
   * Retrieves the currently active Playwright Page object.
   * @returns The active Playwright Page.
   * @throws An error if the page has not been initialized by calling startBrowser first.
   */
  public getPage(): Page {
    if (!this.playwrightPage) {
      throw new Error('Page is not initialized. Please call startBrowser() first.');
    }
    return this.playwrightPage;
  }
}
