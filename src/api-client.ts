import type { AuthManager } from './auth.js';
import type { Config } from './config.js';

export class AuthRequiredError extends Error {
  constructor() {
    super(
      'Not authenticated. Use taskhub_login to sign in, or set TASKHUB_API_TOKEN.',
    );
    this.name = 'AuthRequiredError';
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiClient {
  constructor(
    private config: Config,
    private auth: AuthManager,
  ) {}

  async get<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
    return this.request<T>('GET', path, undefined, params);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  async del<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string | undefined>,
  ): Promise<T> {
    const token = this.auth.getAccessToken();
    if (!token) throw new AuthRequiredError();

    const url = this.buildUrl(path, params);
    const res = await this.doFetch(url, method, body, token);

    // Retry once on 401 after refresh
    if (res.status === 401) {
      try {
        await this.auth.refresh();
      } catch {
        throw new AuthRequiredError();
      }
      const newToken = this.auth.getAccessToken();
      if (!newToken) throw new AuthRequiredError();

      const retry = await this.doFetch(url, method, body, newToken);
      return this.unwrap<T>(retry);
    }

    return this.unwrap<T>(res);
  }

  private async doFetch(
    url: string,
    method: string,
    body: unknown | undefined,
    token: string,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    return fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  private async unwrap<T>(res: Response): Promise<T> {
    if (res.status === 204) return undefined as T;

    const json = await res.json().catch(() => ({})) as Record<string, unknown>;

    if (!res.ok) {
      const err = json.error as Record<string, unknown> | undefined;
      throw new ApiError(
        res.status,
        (err?.code as string) || 'UNKNOWN',
        (err?.message as string) || json.message as string || `Request failed (${res.status})`,
        err?.details,
      );
    }

    // Unwrap the standard envelope { success, data, ... }
    if (json.success !== undefined && 'data' in json) {
      // For paginated responses, attach pagination info
      if ('pagination' in json) {
        const result = json.data as Record<string, unknown>;
        (result as Record<string, unknown>).__pagination = json.pagination;
        return result as T;
      }
      return json.data as T;
    }

    return json as T;
  }

  private buildUrl(
    path: string,
    params?: Record<string, string | undefined>,
  ): string {
    const base = `${this.config.apiUrl}${path}`;
    if (!params) return base;

    const search = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== '') {
        search.set(key, val);
      }
    }
    const qs = search.toString();
    return qs ? `${base}?${qs}` : base;
  }
}
