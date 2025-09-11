import { Page } from 'playwright-core';
import { ActionResult } from './action.types';

// We create a single, shared delay function for this module.
const randomDelay = (minSeconds: number, maxSeconds: number): Promise<void> => {
    const delayMs = Math.floor(Math.random() * (maxSeconds - minSeconds + 1) + minSeconds) * 1000;
    console.log(`[Action Delay] Pausing for ${delayMs / 1000} seconds...`);
    return new Promise(resolve => setTimeout(resolve, delayMs));
};

export async function likePost(
  page: Page,
  params: { postUrl: string },
): Promise<ActionResult> {
  const { postUrl } = params;
  if (!postUrl || !postUrl.startsWith('http')) {
    return { success: false, message: 'Action failed: a valid postUrl starting with http is required.' };
  }

  try {
    console.log(`[Action:likePost] Attempting to like post: ${postUrl}`);
    await page.goto(postUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await randomDelay(3, 5);

    // More specific selector targeting the feedback section of an article
    const postContainer = page.locator('div[role="article"]').first();
    const likeButtonLocator = postContainer.locator('div[aria-label="Like"]');

    const isVisible = await likeButtonLocator.isVisible();
    if (!isVisible) {
      // Check if it's already liked
      const removeLikeButton = postContainer.locator('div[aria-label="Remove Like"]');
      if (await removeLikeButton.isVisible()) {
        return { success: true, message: 'Post was already liked.' };
      }
      return { success: false, message: 'Like button not found and post is not liked. UI may have changed.' };
    }

    console.log('[Action:likePost] Like button found. Clicking...');
    await likeButtonLocator.click();
    await randomDelay(2, 4);

    const removeLikeButton = postContainer.locator('div[aria-label="Remove Like"]');
    if (!(await removeLikeButton.isVisible())) {
         return { success: false, message: 'Verification failed: "Remove Like" button did not appear after clicking.' };
    }

    return { success: true, message: `Successfully liked post: ${postUrl}` };

  } catch (error: any) {
    console.error(`[Action:likePost] An unexpected error occurred:`, error);
    return { success: false, message: `Error in likePost: ${error.message}` };
  }
}

// In src/agent/actions/interaction.actions.ts

export async function sendFriendRequest(
  page: Page,
  params: { profileUrl: string },
): Promise<ActionResult> {
  const { profileUrl } = params;
  if (!profileUrl || !profileUrl.includes('facebook.com')) {
    return { success: false, message: 'Action failed: a valid profileUrl is required.' };
  }

  try {
    console.log(`[Action:sendFriendRequest] Attempting to send friend request to: ${profileUrl}`);
    await page.goto(profileUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await randomDelay(3, 6);

    // State check before action
    if (await page.locator('div[aria-label="Cancel request"]').isVisible()) {
      return { success: true, message: 'Friend request already sent.' };
    }
    if (await page.locator('div[aria-label="Friends"]').isVisible()) {
      return { success: true, message: 'Already friends.' };
    }

    const addFriendButton = page.locator('div[aria-label="Add friend"]');
    if (!(await addFriendButton.isVisible())) {
      return { success: false, message: 'Add friend button not found on the profile page.' };
    }

    console.log('[Action:sendFriendRequest] Add friend button found. Clicking...');
    await addFriendButton.click();
    await randomDelay(2, 4);

    // Verification
    const cancelRequestButton = page.locator('div[aria-label="Cancel request"]');
    if (!(await cancelRequestButton.isVisible())) {
      return { success: false, message: 'Verification failed: "Cancel request" button did not appear.' };
    }

    return { success: true, message: `Successfully sent friend request to: ${profileUrl}` };

  } catch (error: any) {
    console.error(`[Action:sendFriendRequest] An unexpected error occurred:`, error);
    return { success: false, message: `Error in sendFriendRequest: ${error.message}` };
  }
}
// In src/agent/actions/interaction.actions.ts

// ... (randomDelay, likePost, and sendFriendRequest functions remain the same) ...

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

  if (!postUrl || !postUrl.startsWith('http')) {
    return { success: false, message: 'Action failed: a valid postUrl is required.' };
  }
  if (!commentText && !generateSmartComment) {
    return { success: false, message: 'Action failed: either commentText or generateSmartComment must be provided.' };
  }

  try {
    console.log(`[Action:commentOnPost] Attempting to comment on post: ${postUrl}`);
    await page.goto(postUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await randomDelay(4, 7);
    
    let finalCommentText = commentText;

    // --- START OF INTELLIGENCE UPGRADE ---
    if (generateSmartComment) {
        console.log('[Action:commentOnPost] Smart comment mode enabled. Scraping post content for context...');
        const postArticle = page.locator('div[role="article"]').first();
        await postArticle.waitFor({ state: 'visible', timeout: 15000 });
        const postContent = await postArticle.innerText();

        if (!postContent) {
            return { success: false, message: 'Could not scrape post content to generate a smart comment.' };
        }

        const prompt = `You are a social media expert. Based on the following Facebook post content, write a short, engaging, and positive comment (less than 30 words) in the same language as the post. DO NOT include greetings like "Hello". Be direct and natural.\n\nPost Content:\n"""\n${postContent.substring(0, 1500)}\n"""\n\nYour Comment:`;
        
        // For this high-value task, we instantiate the service here to call the cloud.
        const { OllamaService } = await import('../../services/ollama.service');
        const intelligenceService = new OllamaService();
        const generatedComment = await intelligenceService.generateCloudCompletion(prompt);

        if (!generatedComment || generatedComment.includes('Error:')) {
            return { success: false, message: `Failed to generate smart comment: ${generatedComment}` };
        }
        finalCommentText = generatedComment.trim().replace(/["']/g, ''); // Clean up quotes
    }
    // --- END OF INTELLIGENCE UPGRADE ---

    const commentBoxLocator = page.locator('div[aria-label*="comment"]');
    await commentBoxLocator.waitFor({ state: 'visible', timeout: 15000 });

    console.log(`[Action:commentOnPost] Comment box found. Typing: "${finalCommentText}"`);
    await commentBoxLocator.click();
    await randomDelay(1, 2);
    await commentBoxLocator.fill(finalCommentText);
    await randomDelay(2, 4);

    console.log('[Action:commentOnPost] Submitting comment by pressing Enter...');
    await page.keyboard.press('Enter');
    await randomDelay(5, 8);
    
    // Wait for our comment to appear on the page for verification
    const submittedCommentLocator = page.locator(`div[role="article"]:has-text("${finalCommentText}")`);
    await submittedCommentLocator.first().waitFor({ state: 'visible', timeout: 20000 });
    
    return { success: true, message: `Successfully posted comment: "${finalCommentText}"` };

  } catch (error: any) {
    console.error(`[Action:commentOnPost] An unexpected error occurred:`, error);
    return { success: false, message: `Error in commentOnPost: ${error.message}` };
  }
 }
}