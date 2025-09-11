import { Page } from 'playwright-core';
import { ActionResult } from './action.types';

const randomDelay = (minSeconds: number, maxSeconds: number): Promise<void> => {
    const delayMs = Math.floor(Math.random() * (maxSeconds - minSeconds + 1) + minSeconds) * 1000;
    console.log(`[Action Delay] Pausing for ${delayMs / 1000} seconds...`);
    return new Promise(resolve => setTimeout(resolve, delayMs));
};

/**
 * Likes a specific Facebook post.
 * @param page The Playwright Page object.
 * @param params An object containing the postUrl.
 */
export async function likePost(
  page: Page,
  params: { postUrl: string },
): Promise<ActionResult> {
  const { postUrl } = params;
  if (!postUrl || !postUrl.includes('facebook.com')) {
    return { success: false, message: 'Action failed: a valid postUrl parameter is required.' };
  }

  try {
    console.log(`[Action:likePost] Attempting to like post: ${postUrl}`);
    await page.goto(postUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await randomDelay(3, 5);

    // This selector is more robust as it looks for the container of all reaction buttons.
    const reactionBarLocator = page.locator('div[aria-label="Reactions"]');
    const likeButtonLocator = reactionBarLocator.locator('div[aria-label="Like"]');

    if (!(await likeButtonLocator.isVisible())) {
      return { success: false, message: 'Like button not found. The post might already be liked or UI changed.' };
    }

    console.log('[Action:likePost] Like button found. Clicking...');
    await likeButtonLocator.click();
    await randomDelay(2, 4);

    // Verification: Check if the button's label changed to "Remove Like"
    const removeLikeButtonLocator = reactionBarLocator.locator('div[aria-label="Remove Like"]');
    if (!(await removeLikeButtonLocator.isVisible())) {
         return { success: false, message: 'Verification failed: "Remove Like" button did not appear after clicking.' };
    }

    return { success: true, message: `Successfully liked post: ${postUrl}` };

  } catch (error: any) {
    console.error(`[Action:likePost] An unexpected error occurred:`, error);
    return { success: false, message: `Error in likePost: ${error.message}` };
  }
}

/**
 * Comments on a specific Facebook post.
 * @param page The Playwright Page object.
 * @param params An object containing the postUrl and commentText.
 */
export async function commentOnPost(
  page: Page,
  params: { postUrl: string, commentText: string },
): Promise<ActionResult> {
  const { postUrl, commentText } = params;
  if (!postUrl || !commentText) {
    return { success: false, message: 'Action failed: postUrl and commentText parameters are required.' };
  }

  try {
    console.log(`[Action:commentOnPost] Attempting to comment on post: ${postUrl}`);
    await page.goto(postUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await randomDelay(4, 7);

    const commentBoxLocator = page.locator('div[aria-label="Write a comment..."], div[aria-label="Write a public comment..."]');

    if (!(await commentBoxLocator.isVisible())) {
      return { success: false, message: 'Comment input box not found.' };
    }

    console.log(`[Action:commentOnPost] Comment box found. Typing: "${commentText}"`);
    await commentBoxLocator.click();
    await randomDelay(1, 2);
    await commentBoxLocator.fill(commentText);
    await randomDelay(2, 4);

    console.log('[Action:commentOnPost] Submitting comment by pressing Enter...');
    await page.keyboard.press('Enter');
    await randomDelay(5, 8);

    // Verification: Wait for the comment to appear on the page.
    const submittedCommentLocator = page.locator(`div[role="article"]:has-text("${commentText}")`);
    await submittedCommentLocator.first().waitFor({ state: 'visible', timeout: 15000 });
    
    return { success: true, message: 'Successfully posted comment.' };

  } catch (error: any) {
    console.error(`[Action:commentOnPost] An unexpected error occurred:`, error);
    return { success: false, message: `Error in commentOnPost: ${error.message}` };
  }
}