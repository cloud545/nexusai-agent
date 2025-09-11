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
    // We still encode for the URL, this part is correct.
    const encodedGroupName = encodeURIComponent(groupName);
    const searchUrl = `https://www.facebook.com/groups/search/groups/?q=${encodedGroupName}`;

    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await randomDelay(3, 6);

    console.log('[Action:navigateToGroup] Searching for the group link on the page...');
    
    // --- START OF FIX ---
    // Playwright's :has-text() accepts a string or a RegExp object, but not a string literal of a regex.
    // We create a new RegExp object to perform a case-insensitive, exact match.
    const groupNameRegex = new RegExp(`^${groupName}$`, 'i');
    const groupLinkLocator = page.locator('div[role="main"] a[href*="/groups/"]').filter({ hasText: groupNameRegex }).first();
    // --- END OF FIX ---

    const count = await groupLinkLocator.count();
    if (count === 0) {
      const errorMsg = `Could not find a clickable link for group: "${groupName}" on the search results page.`;
      console.log(`[Action:navigateToGroup] ${errorMsg}`);
      return { success: false, message: errorMsg };
    }

    console.log('[Action:navigateToGroup] Group link found. Clicking...');
    await groupLinkLocator.click();

    await page.waitForURL('**/groups/**', { waitUntil: 'networkidle', timeout: 60000 });
    await randomDelay(4, 7);

    const currentUrl = page.url();
    console.log(`[Action:navigateToGroup] Navigation complete. Current URL: ${currentUrl}`);
    return { success: true, message: `Successfully navigated to a group page for "${groupName}".` };

  } catch (error: any) {
    console.error(`[Action:navigateToGroup] An unexpected error occurred:`, error);
    return { success: false, message: `Error in navigateToGroup: ${error.message}` };
  }
}