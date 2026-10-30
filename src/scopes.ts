import type { ApiClient } from './api-client.js';
import type { McpScopesResponse } from './types.js';

export class ScopeChecker {
  private readonly cache = new Map<string, { scopes: string[]; cachedAt: number }>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes; advisory only

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
    const apiWithIdentity = this.api as ApiClient & {
      getCredentialContextKey?: () => string;
    };
    const cacheKey = apiWithIdentity.getCredentialContextKey?.() || 'default';
    const cached = this.cache.get(cacheKey);
    if (cached && now - cached.cachedAt < this.TTL) {
      return [...cached.scopes];
    }

    const result = await this.api.get<McpScopesResponse>('/auth/mcp-scopes');
    this.cache.set(cacheKey, { scopes: [...result.scopes], cachedAt: now });
    return [...result.scopes];
  }

  invalidateCache(): void {
    this.cache.clear();
  }
}
