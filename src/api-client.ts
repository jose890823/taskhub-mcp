import type { AuthManager } from './auth.js';
import type { Config } from './config.js';

export class AuthRequiredError extends Error {
  constructor() {
    super('TASKHUB_API_TOKEN is required. Configure an API key before using TaskHub.');
    this.name = 'AuthRequiredError';
  }
}

export const API_KEY_INVALID = 'API_KEY_INVALID';
export const INSUFFICIENT_SCOPE = 'INSUFFICIENT_SCOPE';
export const PROJECT_ACCESS_DENIED = 'PROJECT_ACCESS_DENIED';

const GENERIC_FAILURE_MESSAGE =
  'TaskHub request failed. Check your configuration and try again.';

function isConfirmedApiFailure(status: number, code: string): boolean {
  return (status === 401 && code === API_KEY_INVALID)
    || (status === 403 && [INSUFFICIENT_SCOPE, PROJECT_ACCESS_DENIED].includes(code));
}

export function safeApiFailureMessage(status: number, code: string): string {
  if (status === 401 && code === API_KEY_INVALID) {
    return 'API key is invalid, expired, revoked, or inactive. Configure a valid TASKHUB_API_TOKEN.';
  }
  if (status === 403 && code === INSUFFICIENT_SCOPE) {
    return 'The API key does not include the required scope. Contact a TaskHub administrator.';
  }
  if (status === 403 && code === PROJECT_ACCESS_DENIED) {
    return 'The API key is not authorized for this project. Verify the project context or contact a TaskHub administrator.';
  }
  return GENERIC_FAILURE_MESSAGE;
}

export class ApiError extends AuthRequiredError {
  constructor(
    public status: number,
    public code: string,
    _message?: string,
    _details?: unknown,
  ) {
    super();
    this.code = isConfirmedApiFailure(status, code)
      ? code
      : 'UNKNOWN';
    this.message = safeApiFailureMessage(status, this.code);
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
      const backendCode = typeof err?.code === 'string' ? err.code : '';
      throw new ApiError(res.status, backendCode, undefined, undefined);
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
