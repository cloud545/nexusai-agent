export interface ActionResult {
  success: boolean;
  message: string;
  data?: any; // Optional data returned by the action
  newSelectors?: Record<string, string>; // Optional: for the vision AI to return new selectors
}
