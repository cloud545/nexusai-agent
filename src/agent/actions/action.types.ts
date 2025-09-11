export interface ActionResult {
  success: boolean;
  message: string;
  data?: any; // Optional data returned by the action
}
