// FILE: nexusai-agent/src/utils/delay.ts

/**
 * Pauses execution for a random duration within a specified range.
 * This is crucial for mimicking human behavior and avoiding detection.
 * @param minMs The minimum delay in milliseconds.
 * @param maxMs The maximum delay in milliseconds.
 */
export const randomDelay = (minMs: number, maxMs: number): Promise<void> => {
  const delayTime = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  console.log(`[Action Delay] Pausing for ${Math.round(delayTime / 1000)} seconds...`);
  return new Promise(resolve => setTimeout(resolve, delayTime));
};