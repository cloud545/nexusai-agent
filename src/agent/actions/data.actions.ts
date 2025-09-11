import { Page } from 'playwright-core';
import { ActionResult } from './action.types';

const randomDelay = (minSeconds: number, maxSeconds: number): Promise<void> => {
    const delayMs = Math.floor(Math.random() * (maxSeconds - minSeconds + 1) + minSeconds) * 1000;
    console.log(`[Action Delay] Pausing for ${delayMs / 1000} seconds...`);
    return new Promise(resolve => setTimeout(resolve, delayMs));
};

export async function scrapePostsFromTarget(
    page: Page,
    params: { count: number },
): Promise<ActionResult> {
    const { count } = params;
    if (!count || count <= 0) {
        return { success: false, message: 'Action failed: "count" parameter must be a positive number.' };
    }

    try {
        console.log(`[Action:scrapePostsFromTarget] Scraping up to ${count} posts using VISIBILITY strategy...`);
        
        // --- START OF TACTICAL UPGRADE V3 ---

        const results: { postUrl: string, textContent: string }[] = [];
        const seenPostUrls = new Set<string>();
        let scrollAttempts = 0;
        
        // We will scroll up to 5 times to find enough posts.
        while (results.length < count && scrollAttempts < 5) {
            
            // 1. Find ALL article containers currently in the DOM.
            const articleLocators = page.locator('div[role="article"]');
            const articleCount = await articleLocators.count();

            if (articleCount === 0 && scrollAttempts === 0) {
                await articleLocators.first().waitFor({ state: 'attached', timeout: 20000 });
            }

            // 2. Iterate through the found containers.
            for (let i = 0; i < articleCount; i++) {
                const article = articleLocators.nth(i);
                
                // 3. Find the permalink inside this specific article.
                const linkLocator = article.locator('a[href*="/posts/"], a[href*="/videos/"], a[href*="/reel/"]').first();
                const linkCount = await linkLocator.count();

                if (linkCount > 0) {
                    const postUrl = await linkLocator.getAttribute('href');
                    if (postUrl && !seenPostUrls.has(postUrl)) {
                        seenPostUrls.add(postUrl);
                        const textContent = await article.innerText();
                        results.push({
                            postUrl,
                            textContent: textContent.trim().substring(0, 300) + '...',
                        });

                        // If we have found enough posts, we can stop.
                        if (results.length >= count) {
                            break;
                        }
                    }
                }
            }
            
            // If we still need more posts, scroll down and try again.
            if (results.length < count) {
                console.log(`[Action:scrapePostsFromTarget] Found ${results.length}/${count} posts. Scrolling to find more...`);
                await page.evaluate(() => window.scrollBy(0, window.innerHeight));
                await page.waitForTimeout(3000); // Wait for new content to load
                scrollAttempts++;
            }
        }
        
        // --- END OF TACTICAL UPGRADE V3 ---

        if (results.length === 0) {
            return { success: true, message: 'No posts found on the current page.', data: [] };
        }

        return {
            success: true,
            message: `Successfully scraped ${results.length} posts.`,
            data: results
        };

    } catch (error: any) {
        console.error(`[Action:scrapePostsFromTarget] An unexpected error occurred:`, error);
        return { success: false, message: `Error in scrapePostsFromTarget: ${error.message}` };
    }
}