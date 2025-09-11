import { Page } from 'playwright-core';
import { ActionResult } from './action.types';

const randomDelay = (minSeconds: number, maxSeconds: number): Promise<void> => {
    const delayMs = Math.floor(Math.random() * (maxSeconds - minSeconds + 1) + minSeconds) * 1000;
    console.log(`[Action Delay] Pausing for ${delayMs / 1000} seconds...`);
    return new Promise(resolve => setTimeout(resolve, delayMs));
};

export async function navigateToGroup(
  page: Page,
  params: { groupName: string },
): Promise<ActionResult> {
  const { groupName } = params;
  if (!groupName) {
    return { success: false, message: 'Action failed: groupName parameter was not provided.' };
  }

  try {
    console.log(`[Action:navigateToGroup] Navigating to group search for: "${groupName}"`);
    const encodedGroupName = encodeURIComponent(groupName);
    const searchUrl = `https://www.facebook.com/groups/search/groups/?q=${encodedGroupName}`;

    await page.goto(searchUrl, { timeout: 60000 });

    console.log('[Action:navigateToGroup] Waiting for search results to appear...');

    // --- START OF CRITICAL FIX ---
    // We are now using a RegExp object directly, which Playwright handles correctly,
    // instead of embedding a regex literal into a string.
    const groupLinkLocator = page.locator(`div[role="main"] a[href*="/groups/"]`).filter({ hasText: new RegExp(`^${groupName}$`, 'i') }).first();
    // --- END OF CRITICAL FIX ---

    await groupLinkLocator.waitFor({ state: 'visible', timeout: 30000 });
    
    await randomDelay(1, 3);
    console.log('[Action:navigateToGroup] Group link found. Clicking...');
    await groupLinkLocator.click();

    console.log('[Action:navigateToGroup] Waiting for group page to load...');
    
    // --- START OF CRITICAL FIX ---
    // Using RegExp object here as well for consistency and safety.
    const groupTitleLocator = page.locator('h1').filter({ hasText: new RegExp(groupName, 'i') });
    // --- END OF CRITICAL FIX ---
    
    await groupTitleLocator.waitFor({ state: 'visible', timeout: 30000 });

    await randomDelay(2, 4);
    console.log(`[Action:navigateToGroup] Successfully navigated to group: "${groupName}".`);
    return { success: true, message: `Successfully navigated to group: "${groupName}"` };

  } catch (error: any) {
    console.error(`[Action:navigateToGroup] An unexpected error occurred:`, error);
    return { success: false, message: `Error in navigateToGroup: ${error.message}` };
  }
}