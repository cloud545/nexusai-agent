import { Page } from 'playwright-core';
import { ActionResult } from './action.types';

// We accept the page object for a consistent function signature, even if we don't use it.
export async function finish_task(page: Page, params: { success: boolean; message: string }): Promise<ActionResult> {
  console.log(`[Action:finish_task] Task finished with status: ${params.success}. Message: ${params.message}`);
  return { ...params };
}