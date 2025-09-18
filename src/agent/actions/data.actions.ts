// FILE: nexusai-agent/src/agent/actions/data.actions.ts

import { Page } from 'playwright-core';
import { ActionResult } from './action.types';
import { randomDelay } from '../../utils/delay';

export async function scrapePostsFromTarget(
    page: Page,
    params: {
        count: number,
        selectors?: { postContainer?: string }
    },
): Promise<ActionResult> {
    const { count, selectors } = params;
    if (!count || count <= 0) {
        return { success: false, message: 'Invalid parameter: count must be a positive number.' };
    }

    try {
        console.log(`[Action:scrapePostsFromTarget] Scraping up to ${count} posts...`);

        // --- MODIFIED SABOTAGE ---
        // The sabotage is now conditional. We only fail if the Hawkeye hasn't provided a better selector.
        const defaultSelector = "#this-selector-will-definitely-fail-12345";
        const postContainerSelector = selectors?.postContainer || defaultSelector;

        if (postContainerSelector === defaultSelector) {
            console.warn(`[SABOTAGE ACTIVE] Using the deliberately failing DEFAULT selector: "${postContainerSelector}"`);
        } else {
            console.log(`[HAWKEYE INTEL] Using cloud-provided selector: "${postContainerSelector}"`);
        }
        // --- END OF MODIFICATION ---

        // Use a short timeout to fail fast if the selector is bad.
        await page.waitForSelector(postContainerSelector, { state: 'attached', timeout: 5000 });
        const postContainers = await page.locator(postContainerSelector).all();

        if (postContainers.length === 0) {
            console.error('[Action:scrapePostsFromTarget] No post containers found using the selector.');
            return { success: false, message: 'Selector issue: No post containers found on the page.' };
        }
        
        // In a real run, you would loop through postContainers here and extract data.
        // For this test, simply finding them is a success.
        const scrapedData = postContainers.slice(0, count).map((_, index) => ({
            postUrl: `https://fake-post-url.com/${index}`,
            textContent: `This is a simulated scraped post #${index + 1}.`,
        }));
        
        await randomDelay(1000, 2000);

        return {
            success: true,
            message: `Successfully simulated scraping of ${scrapedData.length} posts.`,
            data: scrapedData,
        };

    } catch (error) {
        console.error(`[Action:scrapePostsFromTarget] An error occurred:`, error.message);
        return { success: false, message: `Selector issue or critical error during scraping: ${error.message}` };
    }
}