﻿import * as fs from 'fs';
import { ApiService } from '../services/api.service';
import { AiService } from '../services/ai.service';
import { BrowserService } from '../services/browser.service';
import { Page } from 'playwright-core';
import { actionRegistry, ActionName } from './actions';
import { ActionResult } from './actions/action.types';
import axios from 'axios';
import { StorageService } from '../services/storage.service';

/**
 * 从AI的文本响应中安全地解析出JSON指令。
 * @param response - AI返回的原始字符串。
 * @returns 解析成功则返回指令对象，否则返回null。
 */
const parseAiResponse = (response: string): { thought: string; action: ActionName; parameters: any } | null => {
    try {
        const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
        if (!jsonMatch || !jsonMatch[1]) {
            console.error('[解析器] AI响应中未找到有效的JSON块。');
            return null;
        }
        const parsed = JSON.parse(jsonMatch[1]);
        const action = parsed.action;
        if (action && typeof action === 'string' && actionRegistry.hasOwnProperty(action) && parsed.parameters !== undefined) {
            return {
                thought: parsed.thought || '未提供思考过程。',
                action: action as ActionName,
                parameters: parsed.parameters,
            };
        }
        console.error('[解析器] 解析出的JSON与要求的动作结构不匹配。找到:', parsed);
        return null;
    } catch (error) {
        console.error('[解析器] 解析AI的JSON响应失败:', error);
        return null;
    }
};

/**
 * 定义Agent的短期记忆结构。
 */
interface AgentState {
    lastScrapedPosts: any[];
    interactedPostUrls: string[];
}

export class AgentLoop {
    private apiService: ApiService;
    private aiService: AiService;
    private browserService: BrowserService;
    private page: Page | null = null;
    private history: string[] = [];
    private state: AgentState;

    constructor(apiService: ApiService) {
        this.apiService = apiService;
        this.aiService = new AiService();
        this.browserService = new BrowserService();
        this.state = {
            lastScrapedPosts: [],
            interactedPostUrls: [],
        };
    }

    private addToHistory(role: 'USER' | 'SYSTEM' | 'OBSERVATION', content: string) {
        this.history.push(`[${role}] ${content}`);
        if (this.history.length > 20) {
            this.history.splice(0, 5); // 保持历史记录大小适中
        }
    }

    private resetStateAndHistory() {
        console.log('[Agent循环] 为新任务重置状态和历史记录。');
        this.state = {
            lastScrapedPosts: [],
            interactedPostUrls: [],
        };
        this.history = [];
    }

    /**
     * 上报一个无法恢复的错误到云端“作战室”。
     */
    private async handleDefinitiveFailure(task: any, failedAction: ActionName | 'initialization' | 'AI_REASONING_FAILURE', errorMessage: string): Promise<void> {
        console.error(`[零容忍故障] 任务 ${task.taskId} 失败。动作: ${failedAction}, 原因: ${errorMessage}`);
        let screenshotPath = null;
        let screenshotBase64: string | null = null;
        let htmlPath = null;
        let htmlSnapshot: string | null = null;

        try {
            if (this.page && !this.page.isClosed()) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                screenshotPath = `failure-screenshot-${timestamp}.png`;
                htmlPath = `failure-page-${timestamp}.html`;

                const screenshotBuffer = await this.page.screenshot({ fullPage: true });
                screenshotBase64 = screenshotBuffer.toString('base64');
                fs.writeFileSync(screenshotPath, screenshotBuffer); // 仍然保存本地文件以供调试

                htmlSnapshot = await this.page.content();
                fs.writeFileSync(htmlPath, htmlSnapshot); // 仍然保存本地文件以供调试

                console.log(`[零容忍故障] 现场快照已保存: ${screenshotPath}, ${htmlPath}`);
            }
        } catch (snapshotError) {
            console.error('[零容忍故障] 致命：保存现场快照失败。', snapshotError);
        }

        // 修正上报数据结构以匹配 CreateExceptionReportDto
        const reportData = {
            accountId: task.execution_context.accountId, // 从任务上下文中获取
            personaId: task.execution_context.personaId, // 从任务上下文中获取
            task: JSON.stringify(task),
            failedAction: failedAction,
            errorMessage: errorMessage,
            pageUrl: this.page ? this.page.url() : 'N/A',
            htmlSnapshot: htmlSnapshot || '获取HTML失败',
            screenshotBase64: screenshotBase64 || '获取截图失败',
        };

        await this.apiService.reportException(reportData);
    }
    
    /**
     * Agent的启动入口和主生命周期。
     */
    public async run() {
        console.log('--- NexusAI Agent 启动 ---');
        console.log('[Agent循环] 初始化完成，开始轮询任务...');

        while(true) {
            try {
                const task = await this.apiService.getTasks();
                if (task && task.execution_context?.adspowerProfileId) {
                    await this.executeTask(task);
                } else {
                    if (task) {
                        const reason = `任务缺少必须的 execution_context.adspowerProfileId`;
                        console.warn(`[Agent循环] 收到无效任务 ${task.taskId}，原因: ${reason}。正在上报并跳过...`);
                        await this.handleDefinitiveFailure(task, 'initialization', reason);
                    } else {
                        console.log('[Agent循环] 无可用任务，等待中...');
                    }
                    await new Promise(resolve => setTimeout(resolve, 30000));
                }
            } catch (error) {
                console.error('[Agent循环] 任务轮询循环中发生严重错误:', error);
                if (axios.isAxiosError(error) && error.response?.status === 401) {
                    console.error('[Agent循环] 致命错误：认证令牌失效 (401)。Agent将退出。请重新启动以重新认证。');
                    // In a real-world scenario, you might want to trigger a re-authentication flow
                    // instead of exiting, but for this version, we'll keep it simple.
                    return; // Exit the run loop
                }
                console.log('[Agent循环] 正在恢复... 30秒后重试主循环。');
                await new Promise(resolve => setTimeout(resolve, 30000));
            }
        }
    }

   /**
    * 执行一个具体的、完整的任务，包含所有战前准备和战后清理。
    * @param task 从API获取的任务对象。
    */
   private async executeTask(task: any) {
        this.resetStateAndHistory();
        this.addToHistory('USER', `我的任务是: "${task.type}"，载荷: ${JSON.stringify(task.payload)}.`);
        
        const adspowerProfileId = task.execution_context.adspowerProfileId;

        try {
            console.log(`[Agent循环] 正在为任务 ${task.taskId} 初始化服务...`);
            const aiConfig = await this.apiService.getAiConfiguration();
            if (!aiConfig) throw new Error('获取AI配置失败。');
            await this.aiService.initialize(aiConfig);
            
            this.page = await this.browserService.startBrowser(adspowerProfileId);
            if(!this.page) throw new Error(`为配置 ${adspowerProfileId} 启动浏览器失败。`);

            console.log('✅ [Agent循环] 所有服务初始化完毕，开始ReAct循环...');
        } catch (initError) {
            await this.handleDefinitiveFailure(task, 'initialization', initError.message);
            // Cleanup browser if it was partially started
            if (this.page) await this.page.browser().close();
            this.page = null;
            return;
        }

        let observation = `浏览器已启动，当前在Facebook首页。`;
        for (let i = 0; i < 15; i++) { // ReAct Loop
            this.addToHistory('OBSERVATION', observation);
            const prompt = this.buildPrompt(task, observation);

            const aiResponse = await this.aiService.generateDecision(prompt);
            if (!aiResponse) {
                await this.handleDefinitiveFailure(task, 'AI_REASONING_FAILURE', 'AI未能生成响应。');
                break;
            }

            const command = parseAiResponse(aiResponse);
            if (!command) {
                await this.handleDefinitiveFailure(task, 'AI_REASONING_FAILURE', `AI响应解析失败: ${aiResponse}`);
                break;
            }

            this.addToHistory('SYSTEM', `思考: ${command.thought}\n动作: ${command.action}\n参数: ${JSON.stringify(command.parameters)}`);

            try {
                const actionFunc = actionRegistry[command.action];
                const mergedParams = { ...command.parameters, ...this.state };
                const result: ActionResult = await actionFunc(this.page, mergedParams);

                if (!result.success) {
                    await this.handleDefinitiveFailure(task, command.action, result.message);
                    break; // "Zero Tolerance" policy
                }

                observation = result.message;
                if (result.data) {
                    if (command.action === 'scrapePostsFromTarget') {
                        this.state.lastScrapedPosts = result.data;
                    }
                    // Future actions can update state here
                }
                if (result.newSelectors) {
                    // This is a special case for vision AI to update future actions.
                    // We don't have a mechanism for this yet, but the data is here.
                    console.log('[Agent循环] 收到新的选择器:', result.newSelectors);
                }

                if (command.action === 'finish_task') {
                    console.log(`[Agent循环] 任务 ${task.taskId} 已由 'finish_task' 动作正常完成。`);
                    break;
                }

            } catch (actionError) {
                await this.handleDefinitiveFailure(task, command.action, `执行动作时发生未捕获的异常: ${actionError.message}`);
                break;
            }
        }
        
        // 使用正确的清理逻辑
        console.log('[Agent循环] 任务执行完毕，关闭浏览器...');
        await this.browserService.closeBrowser();
        this.page = null;
    }

    /**
     * 构建发送给本地战术AI的“军事条令”Prompt。
     * @param task 当前任务。
     * @param observation 上一步的观察结果。
     * @returns 完整的Prompt字符串。
     */
    private buildPrompt(task: any, observation: string): string {
        const actionSop = `
### ACTION SOP (Standard Operating Procedure) ###
Here are the tools (actions) you can use. You MUST format your response as a JSON object inside a \`\`\`json code block.

{
  "thought": "Your reasoning and plan for the next step.",
  "action": "The name of the action to take.",
  "parameters": { /* An object with the parameters for the action */ }
}

Available Actions:
1.  **navigateToGroup(groupName: string)**
    - Navigates to a specific Facebook group page.
    - Use this to get to the target group before you can scrape posts.
    - Example: { "action": "navigateToGroup", "parameters": { "groupName": "Playwright Developers" } }

2.  **scrapePostsFromTarget(count: number, selectors?: { postContainer?: string })**
    - Scrapes a specified number of posts from the current page.
    - The 'selectors' parameter is OPTIONAL. Only provide it if a previous step failed and a vision AI gave you a new selector.
    - Example: { "action": "scrapePostsFromTarget", "parameters": { "count": 5 } }

3.  **finish_task(success: boolean, message: string)**
    - This is the FINAL action. Use it to end the current task.
    - Set 'success' to true if you achieved the goal, false otherwise.
    - The 'message' should be a summary of the outcome.
    - Example (Success): { "action": "finish_task", "parameters": { "success": true, "message": "Successfully scraped 5 posts from the group." } }
    - Example (Failure): { "action": "finish_task", "parameters": { "success": false, "message": "Could not find the group 'NonExistent Group'." } }
`;

        const planning = `
### HIGH-LEVEL PLAN ###
My primary objective is to execute the user's task flawlessly.
My current task is: **${task.type}**
The parameters for this task are: **${JSON.stringify(task.payload)}**

I will break down the task into small, logical steps using the available actions. I will think step-by-step. If a step fails, I must report it using 'finish_task'.

### CURRENT STATE & HISTORY ###
Here is what has happened so far in this task:
${this.history.join('\n')}

My current short-term memory state is:
${JSON.stringify(this.state, null, 2)}

Based on the last observation, I will now decide on the next action.
`;
        return `${actionSop}\n${planning}`;
    }
}