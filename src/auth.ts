import { readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Config } from './config.js';
import type { Credentials, LoginResponse } from './types.js';

export class AuthManager {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private refreshPromise: Promise<void> | null = null;

  constructor(private config: Config) {
    // Try env var first
    if (config.apiToken) {
      this.accessToken = config.apiToken;
    } else {
      this.loadFromDisk();
    }
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const res = await fetch(`${this.config.apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as Record<string, unknown>;
      const err = body.error as Record<string, unknown> | undefined;
      throw new Error(
        (err?.message as string) || `Login failed (${res.status})`,
      );
    }

    const json = (await res.json()) as { success: boolean; data: LoginResponse };
    const data = json.data;

    this.accessToken = data.accessToken;
    this.refreshToken = data.refreshToken;
    this.saveToDisk();

    return data;
  }

  async refresh(): Promise<void> {
    // Dedup concurrent refreshes
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this._doRefresh();
    try {
      await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async _doRefresh(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available. Please login again.');
    }

    const res = await fetch(`${this.config.apiUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify({ refreshToken: this.refreshToken }),
    });

    if (!res.ok) {
      this.accessToken = null;
      this.refreshToken = null;
      this.deleteDisk();
      throw new Error('Session expired. Please login again with taskhub_login.');
    }

    const json = (await res.json()) as {
      success: boolean;
      data: { accessToken: string; refreshToken: string };
    };

    this.accessToken = json.data.accessToken;
    this.refreshToken = json.data.refreshToken;
    this.saveToDisk();
  }

  logout(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.deleteDisk();
  }

  // ─── Disk persistence ──────────────────────────────────────────

  private loadFromDisk(): void {
    try {
      const raw = readFileSync(this.config.credentialsPath, 'utf-8');
      const creds: Credentials = JSON.parse(raw);
      if (creds.apiUrl === this.config.apiUrl) {
        this.accessToken = creds.accessToken;
        this.refreshToken = creds.refreshToken;
      }
    } catch {
      // No credentials file — not an error
    }
  }

  private saveToDisk(): void {
    const dir = dirname(this.config.credentialsPath);
    mkdirSync(dir, { recursive: true });

    const creds: Credentials = {
      accessToken: this.accessToken!,
      refreshToken: this.refreshToken!,
      apiUrl: this.config.apiUrl,
      savedAt: new Date().toISOString(),
    };

    writeFileSync(this.config.credentialsPath, JSON.stringify(creds, null, 2));
    try {
      chmodSync(this.config.credentialsPath, 0o600);
    } catch {
      // Windows doesn't support chmod — ignore
    }
  }

  private deleteDisk(): void {
    try {
      const { unlinkSync } = require('node:fs') as typeof import('node:fs');
      unlinkSync(this.config.credentialsPath);
    } catch {
      // File might not exist
    }
  }
}
