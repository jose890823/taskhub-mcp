import type { Config } from './config.js';

export class AuthManager {
  private readonly accessToken: string | null;

  constructor(config: Config) {
    this.accessToken = config.apiToken;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }
}
