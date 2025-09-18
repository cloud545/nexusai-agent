import axios, { AxiosInstance } from 'axios';
import { StorageService } from './storage.service';

/**
 * 负责与云端API交互的服务。
 * 该类被设计为由AgentLoop按需实例化，以确保在创建时就拥有正确的认证状态。
 */
export class ApiService {
  public axiosInstance: AxiosInstance;

  /**
   * 构造函数现在是公开的，并接收一个令牌。
   * 它会同步创建一个配置好认证头的axios实例。
   * @param token - 用于认证的JWT令牌，可以为null。
   */
  constructor(token: string | null) {
    this.axiosInstance = axios.create({
      baseURL: 'http://localhost:3333', // 后端API的统一基础URL
      timeout: 30000, // 为AI分析等长时任务设置30秒超时
    });

    // 如果在构造时传入了令牌，则立即将其设置为所有后续请求的默认认证头。
    if (token) {
      this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }
  
  /**
   * 使用账号凭证进行认证，并返回一个新的JWT令牌。
   * 这是一个静态方法，因此可以在没有ApiService实例的情况下调用。
   * @param email - 用户的邮箱。
   * @param password - 用户的密码。
   * @returns 成功则返回JWT令牌字符串，失败则返回null。
   */
  public static async login(email: string, password: string): Promise<string | null> {
    try {
      console.log(`[ApiService] 正在以 ${email} 的身份进行认证...`);
      // 使用一个干净独立的axios实例来登录，以避免任何可能存在的拦截器冲突。
      const response = await axios.post('http://localhost:3333/api/auth/login', { email, password });
      if (response.data && response.data.access_token) {
        console.log('[ApiService] 认证成功。');
        return response.data.access_token;
      }
      return null;
    } catch (error) {
      console.error('认证失败:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * 验证当前ApiService实例持有的令牌是否仍然有效。
   * @returns 如果令牌有效（API返回200 OK），则返回true，否则返回false。
   */
  public async verifyToken(): Promise<boolean> {
    try {
        console.log('[ApiService-Diag] 正在尝试 GET /api/auth/profile 以验证令牌...');
        const response = await this.axiosInstance.get('/api/auth/profile');
        console.log('[ApiService-Diag] 令牌验证成功 (200 OK)。');
        return response.status === 200;
    } catch (error) {
        console.warn('[ApiService-Diag] 令牌验证失败:', error.response?.status, error.response?.data?.message);
        return false;
    }
  }
  
  /**
   * 从云端获取动态的AI服务配置。
   * @returns 返回AI配置对象，失败则返回null。
   */
  public async getAiConfiguration(): Promise<any> {
    try {
        console.log('[ApiService] 正在从云端获取AI配置...');
        const response = await this.axiosInstance.get('/api/settings/ai');
        return response.data;
    } catch (error) {
        console.error('获取AI配置失败:', error.response?.data || error.message);
        return null;
    }
  }

  /**
   * 从API获取下一个可用的任务。
   * @returns 返回任务对象，失败或无任务则返回null。
   */
  public async getTasks(): Promise<any> {
    try {
      const response = await this.axiosInstance.get('/api/auth/agent/tasks/next');
      return response.data;
    } catch (error) {
      console.error('获取任务失败:', error.response?.data || error.message);
      return null;
    }
  }
  
  /**
   * 将页面HTML内容发送到云端进行分析，并返回Playwright选择器。
   * @param htmlContent - 页面的完整HTML内容。
   * @param pageDescription - 对页面上下文的简短描述 (例如 "一个Facebook小组页面")。
   * @returns 成功则返回一个包含选择器的对象，失败则返回null。
   */
  public async getSelectorsFromHtml(htmlContent: string, pageDescription: string): Promise<Record<string, string> | null> {
    try {
      console.log('[ApiService] 正在请求“声呐”探测 (HTML分析)...');
      const response = await this.axiosInstance.post('/api/vision/generate-selectors', {
        htmlContent: htmlContent,
        pageDescription: pageDescription,
      });
      return response.data;
    } catch (error) {
      console.error('从HTML分析API获取选择器失败:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * 向后端上报一个异常。这是一个“即发即忘”的操作。
   * @param reportData - 包含异常详情的对象。
   */
  public async reportException(reportData: Record<string, any>): Promise<void> {
    try {
      console.log('[ApiService] 正在向云端上报异常...');
      await this.axiosInstance.post('/api/exceptions/report', reportData);
      console.log('[ApiService] 异常报告发送成功。');
    } catch (error) {
      console.error(
        '[ApiService] 致命：向云端上报异常失败:',
        error.response?.data || error.message,
      );
    }
  }
}