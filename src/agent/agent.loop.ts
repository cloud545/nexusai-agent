// All imports and the parser function remain the same.
import { ApiService } from '../services/api.service';
import { OllamaService } from '../services/ollama.service';
import { BrowserService } from '../services/browser.service';
import { Page } from 'playwright-core';
import { actionRegistry, ActionName } from './actions';

const parseAiResponse = (response: string): { thought: string; action: ActionName; parameters: any } | null => {
    try {
        const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
        if (!jsonMatch || !jsonMatch[1]) { return null; }
        const parsed = JSON.parse(jsonMatch[1]);
        const action = parsed.action;
        if (action && typeof action === 'string' && actionRegistry.hasOwnProperty(action) && parsed.parameters !== undefined) {
            return {
                thought: parsed.thought || 'No thought provided.',
                action: action as ActionName,
                parameters: parsed.parameters,
            };
        }
        return null;
    } catch (error) {
        return null;
    }
};

interface AgentState {
    lastScrapedPosts: { postUrl: string, textContent: string, authorProfileUrl?: string }[];
    interactedPostUrls: string[];
}

export class AgentLoop {
    private apiService: ApiService;
    private ollamaService: OllamaService;
    private browserService: BrowserService;
    private page: Page | null = null;
    private history: string[] = [];
    private state: AgentState;

    constructor() {
        this.apiService = new ApiService();
        this.ollamaService = new OllamaService();
        this.browserService = new BrowserService();
        this.state = { lastScrapedPosts: [], interactedPostUrls: [] };
    }

    private addToHistory(role: 'USER' | 'SYSTEM' | 'OBSERVATION', content: string) {
        this.history.push(`[${role}] ${content}`);
        if (this.history.length > 10) { this.history.shift(); }
    }

    public async start() {
        console.log('[AgentLoop] Starting up...');
        const adspowerProfileId = 'k1470xgl';
        this.page = await this.browserService.startBrowser(adspowerProfileId);
        if (!this.page) { return; }

        while (true) {
            console.log('\n--- AgentLoop: New Iteration ---');
            const task = {
                taskId: 'task-FINAL-DEMO',
                type: 'FULL_ENGAGEMENT_AND_CONNECT',
                payload: {
                    groupName: '上海交友',
                    commentText: '这个分享很有意思！', // Default comment text
                }
            };

            if (task) {
                console.log('[AgentLoop] Received task:', task);
                this.history = [];
                this.state = { lastScrapedPosts: [], interactedPostUrls: [] };
                this.addToHistory('USER', `My task is to perform a full engagement cycle in the group: '${task.payload.groupName}'.`);
                
                let observation = `I am on the Facebook homepage.`;
                
                for (let i = 0; i < 15; i++) {
                    const prompt = this.buildPrompt(task, observation);
                    const aiResponse = await this.ollamaService.generateLocalCompletion(prompt, 'mistral:7b-instruct');

                    if (!aiResponse) { break; }
                    const parsedResponse = parseAiResponse(aiResponse);
                    if (!parsedResponse) {
                        observation = 'My last response was unparsable.';
                        this.addToHistory('SYSTEM', observation);
                        continue;
                    }
                    
                    const { thought, action } = parsedResponse; // We only trust the AI's action choice
                    this.addToHistory('SYSTEM', `Thought: ${thought}\nAction: ${action}`);
                    console.log(`[AI Thought] ${thought}`);
                    console.log(`[Agent Action] Decided Action: ${action}`);

                    const actionFunction = actionRegistry[action];
                    if (typeof actionFunction === 'function') {
                        // --- START OF ULTIMATE FIX: CODE HAS ABSOLUTE CONTROL ---
                        
                        // 1. Start with the base parameters from the original task
                        let finalParameters: any = { ...task.payload };

                        // 2. Based on the action chosen by the AI, CODE assembles the parameters
                        if (action === 'scrapePostsFromTarget') {
                            finalParameters.count = 5; // Code decides a reasonable count
                        } else if (['likePost', 'commentOnPost', 'sendFriendRequest'].includes(action)) {
                            const targetPost = this.state.lastScrapedPosts.find(p => !this.state.interactedPostUrls.includes(p.postUrl));
                            if (targetPost) {
                                finalParameters.postUrl = targetPost.postUrl;
                                // If we're commenting and there's no text, trigger smart mode
                                if (action === 'commentOnPost' && !finalParameters.commentText) {
                                    finalParameters.generateSmartComment = true;
                                }
                            } else {
                                // If no target post is available, the only logical action is to scrape more or finish
                                observation = `I wanted to interact, but I have no unscraped posts in my memory. I should probably scrape some.`;
                                this.addToHistory('OBSERVATION', observation);
                                console.log('[Code Override] No target post found for interaction. Forcing re-evaluation.');
                                continue; // Skip to the next loop iteration to re-think
                            }
                        } else if (action === 'finish_task') {
                            finalParameters = { success: true, message: "Task completed successfully." };
                        }
                        
                        console.log(`[Code Control] Assembled final parameters:`, finalParameters);
                        // --- END OF ULTIMATE FIX ---
                        
                        let result;
                        if (this.page) {
                            result = await actionFunction(this.page, finalParameters);
                        } else {
                            result = { success: false, message: "Browser page is not available." };
                        }
                        
                        console.log(`[Agent Result] Action outcome:`, result);
                        observation = `Action '${action}' completed. Outcome: ${result.message}`;
                        
                        if (action === 'scrapePostsFromTarget' && result.success && result.data?.length > 0) {
                            this.state.lastScrapedPosts = result.data;
                            observation += ` I have saved ${result.data.length} posts to my memory.`;
                        }
                        if (['likePost', 'commentOnPost'].includes(action) && result.success) {
                            this.state.interactedPostUrls.push(finalParameters.postUrl);
                        }

                        this.addToHistory('OBSERVATION', observation);

                        if (action === 'finish_task' && result.success) {
                            console.log('[AgentLoop] Task finished successfully as per AI decision.');
                            break;
                        }
                    } else {
                       // ... (error handling)
                    }
                }
            } else {
                console.log('[AgentLoop] No tasks found, waiting...');
            }
            
            // For testing, we break the outer while loop after one task cycle.
            break;
        }
        console.log('--- AgentLoop: Test Iteration Finished ---');
    }

    private buildPrompt(task: any, observation: string): string {
        const availableActions = Object.keys(actionRegistry);
        
        // --- PROMPT SIMPLIFIED: AI's ONLY JOB IS TO CHOOSE THE NEXT ACTION ---
        return `
          You are a logical AI agent. Your ONLY job is to choose the single next action to perform. Respond with a single JSON object.

          **THINKING PROCESS:**
          1.  **GOAL:** ${JSON.stringify(task)}
          2.  **SITUATION (Last Observation):** \`${observation.substring(0, 300)}...\`
          3.  **PLAN (Your internal thought process):**
              *   IF I need to be in a group and I'm not, I'll choose \`navigateToGroup\`.
              *   IF I'm in a group but have no posts in memory, I'll choose \`scrapePostsFromTarget\`.
              *   IF I have posts in memory and haven't interacted, I'll choose \`likePost\`.
              *   IF I have liked a post, I'll choose \`commentOnPost\`.
              *   IF the task is done, I'll choose \`finish_task\`.
          4.  **CHOOSE ONE ACTION:** Based on your plan, what is the single next action?

          **CONTEXT:**
          - Available Actions: ${JSON.stringify(availableActions)}
          - Short-Term Memory (State): ${JSON.stringify(this.state)}

          **YOUR RESPONSE (JSON ONLY - The 'parameters' object can be empty, the code will handle it):**
          \`\`\`json
          {
            "thought": "Based on my plan and the situation, the next logical action is to scrape posts.",
            "action": "scrapePostsFromTarget",
            "parameters": {}
          }
          \`\`\`
        `;
    }
}