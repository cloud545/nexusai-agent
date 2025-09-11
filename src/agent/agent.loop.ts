// All imports remain the same
import { ApiService } from '../services/api.service';
import { OllamaService } from '../services/ollama.service';
import { BrowserService } from '../services/browser.service';
import { Page } from 'playwright-core';
import { actionRegistry, ActionName } from './actions';


// Parser remains the same
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
    lastScrapedPosts: { postUrl: string, textContent: string }[];
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
                taskId: 'task-789',
                type: 'INTERACT_WITH_FIRST_POST_IN_GROUP',
                payload: {
                    groupName: '上海交友',
                    commentText: '这个分享很有意思！',
                }
            };

            if (task) {
                console.log('[AgentLoop] Received task:', task);
                this.history = [];
                this.state = { lastScrapedPosts: [], interactedPostUrls: [] };
                this.addToHistory('USER', `My high-level task is: "${task.type}" with payload: ${JSON.stringify(task.payload)}.`);
                
                let observation = `I am on the Facebook homepage. The user wants me to interact with the first post in the group '${task.payload.groupName}'.`;
                
                for (let i = 0; i < 15; i++) {
                    const prompt = this.buildPrompt(task, observation);
                    const aiResponse = await this.ollamaService.generateCompletion(prompt, 'mistral:7b-instruct');

                    if (!aiResponse) { break; }
                    const parsedResponse = parseAiResponse(aiResponse);
                    if (!parsedResponse) {
                        observation = 'My last response was unparsable. Please provide a valid JSON response.';
                        this.addToHistory('SYSTEM', observation);
                        continue;
                    }
                    
                    const { thought, action, parameters: aiParameters } = parsedResponse;
                    this.addToHistory('SYSTEM', `Thought: ${thought}\nAction: ${action} with parameters: ${JSON.stringify(aiParameters)}`);
                    console.log(`[AI Thought] ${thought}`);
                    console.log(`[Agent Action] Executing: ${action}`);

                    const actionFunction = actionRegistry[action];
                    if (typeof actionFunction === 'function') {
                        let finalParameters = { ...task.payload, ...aiParameters };
                        
                        if (['likePost', 'commentOnPost'].includes(action) && this.state.lastScrapedPosts.length > 0) {
                            const targetPost = this.state.lastScrapedPosts.find(p => !this.state.interactedPostUrls.includes(p.postUrl));
                            if (targetPost) {
                                finalParameters.postUrl = targetPost.postUrl;
                            }
                        }
                        console.log(`[Agent Action] Final merged parameters:`, finalParameters);
                        
                        let result;
                        if (this.page) {
                            result = await actionFunction(this.page, finalParameters);
                        } else {
                            result = { success: false, message: "Browser page is not available." };
                        }
                        
                        console.log(`[Agent Result] Action outcome:`, result);
                        observation = `Action '${action}' completed. Outcome: ${result.message}`;
                        
                        if (action === 'scrapePostsFromTarget' && result.success && result.data.length > 0) {
                            this.state.lastScrapedPosts = result.data;
                            observation += ` I have saved ${result.data.length} posts to my short-term memory.`;
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
                        observation = `Action "${action}" is not a valid action. Please choose from the provided list.`;
                        this.addToHistory('OBSERVATION', observation);
                        console.error(`[AgentLoop] Action "${action}" not found in registry!`);
                    }
                }
            } else {
                console.log('[AgentLoop] No tasks found, waiting...');
            }
            
            await new Promise(resolve => setTimeout(resolve, 30000));
        }
    }

    // --- START OF FINAL PROMPT UPGRADE ---
    private buildPrompt(task: any, observation: string): string {
        const availableActions = Object.keys(actionRegistry);
        
        return `
          You are a methodical AI agent. Your goal is to create a step-by-step plan and execute it. You MUST respond with a single JSON object in a markdown code block.

          **CRITICAL RULES:**
          1. Your response MUST be a single JSON object inside a \`\`\`json code block.
          2. The "action" MUST be ONE of the EXACT names from the 'Available Actions' list.
          3. When the task is complete, your final action MUST be "finish_task".

          **THINKING PROCESS (Follow these steps):**
          1.  **Analyze the GOAL:** What is the final objective of the task: \`${JSON.stringify(task)}\`?
          2.  **Analyze the current SITUATION:** What does the last observation tell me: \`${observation.substring(0, 300)}...\`?
          3.  **CREATE A PLAN:** Based on the goal and situation, what is the logical sequence of actions?
              *   IF the task is to interact in a group AND my last observation says I am on the homepage, my FIRST step is ALWAYS \`navigateToGroup\`.
              *   IF I have successfully navigated to the group but have no post information in my memory, my NEXT step is ALWAYS \`scrapePostsFromTarget\`.
              *   IF I have scraped posts (check memory), my NEXT step is to interact with the first un-interacted post, starting with \`likePost\`.
              *   IF I have liked a post, my NEXT step is \`commentOnPost\` on the SAME post.
              *   IF all interactions for the required number of posts are done, my FINAL step is \`finish_task\`.
          4.  **Select ONE action:** Choose the VERY NEXT action from your plan.
          5.  **Determine Parameters:** What parameters does this single action need? For scraping, I will decide on a reasonable number of posts to scrape (e.g., 5).

          **CONTEXT:**
          - Available Actions: ${JSON.stringify(availableActions)}
          - Short-Term Memory (State): ${JSON.stringify(this.state)}

          **YOUR RESPONSE (JSON ONLY):**
          \`\`\`json
          {
            "thought": "My plan is to navigate, scrape, like, and comment. My current situation is '${observation.substring(0, 50)}...'. My next action is to scrape posts to get information. I'll scrape 5 posts to have some options.",
            "action": "scrapePostsFromTarget",
            "parameters": { "count": 5 }
          }
          \`\`\`
        `;
    }
    // --- END OF FINAL PROMPT UPGRADE ---
}