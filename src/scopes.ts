import type { ApiClient } from './api-client.js';
import type { McpScopesResponse } from './types.js';

export class ScopeChecker {
  private scopes: string[] | null = null;
  private cachedAt: number = 0;
  private readonly TTL = 5 * 60 * 1000; // 5 minutes

  constructor(private api: ApiClient) {}

  async checkScope(scope: string): Promise<void> {
    const scopes = await this.fetchScopes();
    if (!scopes.includes(scope)) {
      throw new Error(
        `Tu plan no incluye esta funcionalidad (scope requerido: ${scope}). Contacta al administrador para más información.`,
      );
    }
  }

  async fetchScopes(): Promise<string[]> {
    const now = Date.now();
    if (this.scopes && now - this.cachedAt < this.TTL) {
      return this.scopes;
    }

    const result = await this.api.get<McpScopesResponse>('/auth/mcp-scopes');
    this.scopes = result.scopes;
    this.cachedAt = now;
    return this.scopes;
  }

  invalidateCache(): void {
    this.scopes = null;
    this.cachedAt = 0;
  }
}
