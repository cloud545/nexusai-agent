import { BrowserService } from './src/services/browser.service';
import { actionRegistry } from './src/agent/actions';
import { Page } from 'playwright-core';

// This is a standalone script for debugging with Playwright Inspector.

async function runInspection() {
  console.log('--- LAUNCHING INSPECTOR TEST ---');
  
  const adspowerProfileId = 'k1470xgl'; // 【【【 请确认您的ID 】】】
  const groupName = 'Bag store'; // 【【【 请设置为您要分析的小组 】】】
  
  const browserService = new BrowserService();
  let page: Page | null = null;

  try {
    console.log('[Inspector] Starting browser...');
    page = await browserService.startBrowser(adspowerProfileId);
    if (!page) throw new Error('Failed to start browser.');
    console.log('✅ Browser started.');

    console.log(`[Inspector] Navigating to group: "${groupName}"...`);
    const navResult = await actionRegistry.navigateToGroup(page, { groupName });
    if (!navResult.success) throw new Error(`Navigation failed: ${navResult.message}`);
    console.log('✅ Navigation successful.');

    // --- THE PAUSE FOR INSPECTION ---
    console.log('\n\n======================================================================');
    console.log('🚀 SCRIPT PAUSED FOR INSPECTION 🚀');
    console.log('======================================================================');
    console.log('1. Click the "Explore" button in the Playwright Inspector window.');
    console.log('2. Move your mouse over the elements in the browser to see their selectors.');
    console.log('3. Find the best, most stable selector for a single POST CONTAINER.');
    console.log('4. Copy that selector.');
    console.log('5. Press the "Resume" button (▶️) in the Inspector to end the script.');
    console.log('======================================================================\n\n');
    
    await page.pause(); // This is the magic command!

    console.log('[Inspector] Script resumed by user. Test finished.');

  } catch (error) {
    console.error('[Inspector] Test failed:', error);
  } finally {
    // We don't close the browser so you can continue to inspect if needed.
    // In a real scenario, you might want to add page.browser().close() here.
    console.log('[Inspector] To close the browser, close the Adspower window manually.');
  }
}

runInspection();