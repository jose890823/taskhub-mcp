import type { Config } from './config.js';
import { CredentialStore } from './credential-store.js';

export class AuthManager {
  private readonly accessToken: string | null;
  private readonly credentials: CredentialStore;

  constructor(config: Config, credentials = new CredentialStore(config.credentialsPath)) {
    this.accessToken = config.apiToken;
    this.credentials = credentials;
  }

  getAccessToken(projectId?: string | null): string | null {
    if (projectId) {
      const profileToken = this.credentials.getToken(projectId);
      if (profileToken) return profileToken;
    }
    return this.accessToken;
  }

  getCredentialSource(projectId?: string | null): string {
    if (projectId && this.credentials.hasProfile(projectId)) return `profile:${projectId}`;
    if (this.accessToken) return 'environment';
    return 'missing';
  }

  isAuthenticated(projectId?: string | null): boolean {
    return this.getAccessToken(projectId) !== null;
  }
}
