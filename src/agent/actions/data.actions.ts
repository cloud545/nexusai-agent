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
        console.log(`[Action:scrapePostsFromTarget] Scraping the top ${count} posts using new strategy...`);
        
        // --- START OF TACTICAL UPGRADE V2 ---

        // 1. First, locate all the permalink locators directly. This is our "beacon".
        const permalinkLocator = page.locator('a[href*="/posts/"], a[href*="/videos/"], a[href*="/reel/"]');

        // 2. Wait for at least one link to be visible to ensure the page is loaded.
        console.log('[Action:scrapePostsFromTarget] Waiting for post links to become visible...');
        await permalinkLocator.first().waitFor({ state: 'visible', timeout: 30000 });
        console.log('[Action:scrapePostsFromTarget] Post links are visible.');
        
        // 3. Smart Scrolling to load enough posts.
        let allLinks = await permalinkLocator.all();
        let retries = 3;
        while (allLinks.length < count && retries > 0) {
            console.log(`[Action:scrapePostsFromTarget] Only ${allLinks.length} post links visible. Scrolling to load more...`);
            await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
            await page.waitForTimeout(3000); // Wait for new content to load
            allLinks = await permalinkLocator.all();
            retries--;
        }

        if (allLinks.length === 0) {
            return { success: true, message: 'No post links found on the current page.', data: [] };
        }
        
        // --- END OF TACTICAL UPGRADE V2 ---

        const linksToScrape = allLinks.slice(0, count);
        const results = [];

        for (const linkElement of linksToScrape) {
            try {
                const postUrl = await linkElement.getAttribute('href');
                if (!postUrl) {
                    console.warn('[Action:scrapePostsFromTarget] Found a link element without an href, skipping.');
                    continue;
                }
                
                // For each link, go up to the ancestor 'article' container.
                const postContainer = linkElement.locator('xpath=./ancestor::div[@role="article"]');
                const containerCount = await postContainer.count();

                if (containerCount === 0) {
                    console.warn(`[Action:scrapePostsFromTarget] Could not find article container for link ${postUrl}, skipping.`);
                    continue;
                }

                const textContent = await postContainer.first().innerText();

                results.push({
                    postUrl: postUrl,
                    textContent: textContent.trim().substring(0, 300) + '...',
                });

            } catch (e) {
                console.warn('[Action:scrapePostsFromTarget] Could not process one post element, skipping.', e.message);
            }
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