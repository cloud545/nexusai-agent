import * as keytar from 'keytar';

/**
 * Service for securely storing and retrieving credentials using the system's keychain.
 * All methods are static, so no instance of the class is needed.
 */
export class StorageService {
  private static readonly SERVICE_NAME = 'NexusAI-Agent';
  private static readonly ACCOUNT_NAME = 'apiToken';

  /**
   * Saves a token securely in the system's keychain.
   * @param token The token to be stored.
   * @returns A promise that resolves when the token has been saved.
   */
  public static async setToken(token: string): Promise<void> {
    await keytar.setPassword(this.SERVICE_NAME, this.ACCOUNT_NAME, token);
  }

  /**
   * Retrieves the stored token from the system's keychain.
   * @returns A promise that resolves with the stored token, or null if no token is found.
   */
  public static async getToken(): Promise<string | null> {
    return await keytar.getPassword(this.SERVICE_NAME, this.ACCOUNT_NAME);
  }

  /**
   * Deletes the stored token from the system's keychain.
   * @returns A promise that resolves to true if the token was successfully deleted, and false otherwise.
   */
  public static async deleteToken(): Promise<boolean> {
    return await keytar.deletePassword(this.SERVICE_NAME, this.ACCOUNT_NAME);
  }
}