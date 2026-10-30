import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';

const STORE_VERSION = 1;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_LABEL_PATTERN = /^[A-Za-z0-9 ._-]{1,80}$/;

interface StoredProfile {
  token: string;
  label?: string;
  updatedAt: string;
}

interface CredentialStoreDocument {
  version: typeof STORE_VERSION;
  profiles: Record<string, StoredProfile>;
}

export interface CredentialProfileMetadata {
  projectId: string;
  label?: string;
  updatedAt: string;
}

export class CredentialStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CredentialStoreError';
  }
}

export function isProjectUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function assertProjectUuid(projectId: string): void {
  if (!isProjectUuid(projectId)) {
    throw new CredentialStoreError('A valid project UUID is required. Do not use a display code or slug.');
  }
}

function assertSafeLabel(label: string | undefined): void {
  if (label !== undefined && !SAFE_LABEL_PATTERN.test(label)) {
    throw new CredentialStoreError('Labels may contain only letters, numbers, spaces, dots, underscores, and hyphens.');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseStore(raw: string): CredentialStoreDocument {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new CredentialStoreError('The TaskHub credential store is unreadable. Repair or remove it, then register the profiles again.');
  }

  if (!isRecord(value) || value.version !== STORE_VERSION || !isRecord(value.profiles)) {
    throw new CredentialStoreError('The TaskHub credential store has an unsupported format. Repair or remove it, then register the profiles again.');
  }

  const profiles: Record<string, StoredProfile> = {};
  for (const [projectId, profile] of Object.entries(value.profiles)) {
    if (!isProjectUuid(projectId) || !isRecord(profile)
      || typeof profile.token !== 'string' || profile.token.length === 0
      || /[\r\n]/.test(profile.token)
      || typeof profile.updatedAt !== 'string') {
      throw new CredentialStoreError('The TaskHub credential store contains invalid profile metadata. Repair or remove it, then register the profiles again.');
    }

    const label = profile.label;
    if (label !== undefined && typeof label !== 'string') {
      throw new CredentialStoreError('The TaskHub credential store contains invalid profile metadata. Repair or remove it, then register the profiles again.');
    }
    assertSafeLabel(label);
    profiles[projectId] = { token: profile.token, ...(label ? { label } : {}), updatedAt: profile.updatedAt };
  }

  return { version: STORE_VERSION, profiles };
}

export class CredentialStore {
  constructor(public readonly filePath: string) {}

  getToken(projectId: string | null | undefined): string | null {
    if (!projectId || !isProjectUuid(projectId)) return null;
    return this.read().profiles[projectId]?.token || null;
  }

  hasProfile(projectId: string | null | undefined): boolean {
    if (!projectId || !isProjectUuid(projectId)) return false;
    return Boolean(this.read().profiles[projectId]);
  }

  listMetadata(): CredentialProfileMetadata[] {
    return Object.entries(this.read().profiles)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([projectId, profile]) => ({
        projectId,
        ...(profile.label ? { label: profile.label } : {}),
        updatedAt: profile.updatedAt,
      }));
  }

  setToken(projectId: string, token: string, label?: string): void {
    assertProjectUuid(projectId);
    if (!token || /[\r\n]/.test(token)) {
      throw new CredentialStoreError('A non-empty API key must be entered without line breaks.');
    }
    assertSafeLabel(label);

    const document = this.read();
    document.profiles[projectId] = {
      token,
      ...(label ? { label } : {}),
      updatedAt: new Date().toISOString(),
    };
    this.write(document);
  }

  remove(projectId: string): boolean {
    assertProjectUuid(projectId);
    const document = this.read();
    if (!document.profiles[projectId]) return false;
    delete document.profiles[projectId];
    this.write(document);
    return true;
  }

  private read(): CredentialStoreDocument {
    try {
      const raw = readFileSync(this.filePath, 'utf8');
      return parseStore(raw);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { version: STORE_VERSION, profiles: {} };
      }
      if (error instanceof CredentialStoreError) throw error;
      throw new CredentialStoreError('The TaskHub credential store could not be read. Check its permissions.');
    }
  }

  private write(document: CredentialStoreDocument): void {
    const directory = dirname(this.filePath);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    if (process.platform !== 'win32') chmodSync(directory, 0o700);

    const temporaryPath = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    let descriptor: number | undefined;
    try {
      descriptor = openSync(temporaryPath, 'wx', 0o600);
      writeFileSync(descriptor, JSON.stringify(document, null, 2) + '\n', 'utf8');
      if (process.platform !== 'win32') {
        fsyncSync(descriptor);
        chmodSync(temporaryPath, 0o600);
      }
      closeSync(descriptor);
      descriptor = undefined;
      renameSync(temporaryPath, this.filePath);
      if (process.platform !== 'win32') chmodSync(this.filePath, 0o600);
    } catch {
      if (descriptor !== undefined) closeSync(descriptor);
      if (existsSync(temporaryPath)) rmSync(temporaryPath, { force: true });
      throw new CredentialStoreError('The TaskHub credential store could not be written. Check its directory permissions.');
    }
  }
}
