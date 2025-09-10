import { app } from 'electron';
import { AgentLoop } from './agent/agent.loop';
import { OllamaService } from './services/ollama.service';

const main = async () => {
  console.log('--- NexusAI Agent Starting ---');

  // 1. Pre-flight check: Ensure Ollama is running
  const ollamaService = new OllamaService();
  const isOllamaRunning = await ollamaService.checkHealth();

  if (!isOllamaRunning) {
    console.error('!!! FATAL: Ollama service is not running. Please start Ollama and try again. !!!');
    // In a real app, you might try to start it programmatically here.
    app.quit();
    return;
  }
  console.log('✅ Ollama health check passed.');

  // 2. Initialize and start the main agent loop
  try {
    const agentLoop = new AgentLoop();
    await agentLoop.start();
  } catch (error) {
    console.error('An unhandled error occurred in the agent loop:', error);
  }
};


app.whenReady().then(main);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});