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
await page.goto(postUrl, { timeout: 60000 });
// After navigation, we wait for a reliable element of a post to appear.
// The reaction bar is a good candidate.
await page.locator('div[aria-label="Reactions"]').first().waitFor({ state: 'visible', timeout: 30000 });    await randomDelay(3, 5);

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
 * Can operate in standard mode (fixed text) or smart mode (AI-generated).
 * @param page The Playwright Page object.
 * @param params An object containing postUrl and either commentText or a flag to generate a smart comment.
 */
export async function commentOnPost(
  page: Page,
  params: { 
    postUrl: string, 
    commentText?: string, 
    generateSmartComment?: boolean 
  },
): Promise<ActionResult> {
  const { postUrl, commentText, generateSmartComment } = params;

  if (!postUrl) {
    return { success: false, message: 'Action failed: postUrl parameter is required.' };
  }
  if (!commentText && !generateSmartComment) {
    return { success: false, message: 'Action failed: either commentText or generateSmartComment must be provided.' };
  }

  try {
    console.log(`[Action:commentOnPost] Attempting to comment on post: ${postUrl}`);
await page.goto(postUrl, { timeout: 60000 });
// After navigation, we wait for a reliable element of a post to appear.
// The reaction bar is a good candidate.
await page.locator('div[aria-label="Reactions"]').first().waitFor({ state: 'visible', timeout: 30000 });    await randomDelay(4, 7);
    
    let finalCommentText = commentText;

    // --- START OF INTELLIGENCE UPGRADE ---
    if (generateSmartComment) {
        console.log('[Action:commentOnPost] Smart comment mode enabled. Scraping post content...');
        const postArticle = page.locator('div[role="article"]').first();
        const postContent = await postArticle.innerText();

        if (!postContent) {
            return { success: false, message: 'Could not scrape post content to generate a smart comment.' };
        }

        const prompt = `You are a social media expert. Based on the following Facebook post content, write a short, engaging, and positive comment (less than 30 words). DO NOT include greetings like "Hello". Be direct and natural.\n\nPost Content:\n"""\n${postContent.substring(0, 1000)}\n"""\n\nYour Comment:`;
        
        // For this high-value task, we instantiate OllamaService here to call the cloud.
        // In a more advanced architecture, this might be passed in via dependency injection.
        const { OllamaService } = await import('../../services/ollama.service');
        const intelligenceService = new OllamaService();
        
        const generatedComment = await intelligenceService.generateCloudCompletion(prompt);

        if (!generatedComment || generatedComment.includes('Error:')) {
            return { success: false, message: `Failed to generate smart comment: ${generatedComment}` };
        }
        finalCommentText = generatedComment.trim().replace(/["']/g, ''); // Clean up quotes
    }
    // --- END OF INTELLIGENCE UPGRADE ---

    const commentBoxLocator = page.locator('div[aria-label="Write a comment..."], div[aria-label="Write a public comment..."]');
    if (!(await commentBoxLocator.isVisible())) {
      return { success: false, message: 'Comment input box not found.' };
    }

    console.log(`[Action:commentOnPost] Comment box found. Typing: "${finalCommentText}"`);
    await commentBoxLocator.click();
    await randomDelay(1, 2);
    await commentBoxLocator.fill(finalCommentText);
    await randomDelay(2, 4);

    console.log('[Action:commentOnPost] Submitting comment by pressing Enter...');
    await page.keyboard.press('Enter');
    await randomDelay(5, 8);
    
    const submittedCommentLocator = page.locator(`div[role="article"]:has-text("${finalCommentText}")`);
    await submittedCommentLocator.first().waitFor({ state: 'visible', timeout: 15000 });
    
    return { success: true, message: `Successfully posted comment: "${finalCommentText}"` };

  } catch (error: any) {
    console.error(`[Action:commentOnPost] An unexpected error occurred:`, error);
    return { success: false, message: `Error in commentOnPost: ${error.message}` };
  }
}

/**
 * Navigates to a user's profile and sends a friend request.
 * @param page The Playwright Page object.
 * @param params An object containing the profileUrl.
 * @param params.profileUrl The full URL of the user's profile.
 * @returns A Promise resolving to an ActionResult indicating success or failure.
 */
export async function sendFriendRequest(
  page: Page,
  params: { profileUrl: string },
): Promise<ActionResult> {
  const { profileUrl } = params;
  if (!profileUrl) {
    return { success: false, message: 'Action failed: "profileUrl" parameter is required.' };
  }

  console.log(`[Action:sendFriendRequest] Attempting to send friend request to: ${profileUrl}`);

  try {
await page.goto(postUrl, { timeout: 60000 });
// After navigation, we wait for a reliable element of a post to appear.
// The reaction bar is a good candidate.
await page.locator('div[aria-label="Reactions"]').first().waitFor({ state: 'visible', timeout: 30000 });    await randomDelay(3, 5);

    // Define locators for all possible states
    const cancelRequestButton = page.locator('[aria-label*="Cancel request"]');
    const friendsButton = page.locator('[aria-label*="Friends"]');
    const addFriendButton = page.locator('[aria-label="Add friend"]');

    // Check for existing states before attempting to add
    if (await cancelRequestButton.isVisible()) {
      return { success: true, message: 'Friend request already sent.' };
    }
    if (await friendsButton.isVisible()) {
      return { success: true, message: 'Already friends.' };
    }

    // Proceed with adding friend
    if (!(await addFriendButton.isVisible())) {
      const message = 'Add friend button not found. The user may not be accepting requests or the UI has changed.';
      console.log(`[Action:sendFriendRequest] ${message}`);
      return { success: false, message };
    }

    console.log('[Action:sendFriendRequest] Add friend button found. Clicking...');
    await addFriendButton.click();
    await randomDelay(2, 4);

    // Verification: Check if the "Add friend" button is gone and "Cancel request" has appeared.
    if (await cancelRequestButton.isVisible() && await addFriendButton.isHidden()) {
      return { success: true, message: `Successfully sent friend request to: ${profileUrl}` };
    } else {
      return { success: false, message: 'Failed to verify friend request submission. The button state did not change as expected.' };
    }

  } catch (error: any) {
    console.error(`[Action:sendFriendRequest] An unexpected error occurred:`, error);
    return { success: false, message: `Error in sendFriendRequest: ${error.message}` };
  }
}