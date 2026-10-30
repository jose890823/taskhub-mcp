import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';

export interface Config {
  apiUrl: string;
  apiToken: string | null;
  credentialsPath: string;
}

export function getCredentialStorePath(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  home = env.HOME || homedir(),
): string {
  const explicitFile = env.TASKHUB_CREDENTIALS_FILE?.trim();
  if (explicitFile) {
    if (!isAbsolute(explicitFile)) {
      throw new Error('TASKHUB_CREDENTIALS_FILE must be an absolute path.');
    }
    return explicitFile;
  }

  const configHome = env.TASKHUB_CONFIG_DIR?.trim() || (
    platform === 'win32'
      ? join(env.APPDATA || join(home, 'AppData', 'Roaming'), 'TaskHub')
      : platform === 'darwin'
        ? join(home, 'Library', 'Application Support', 'TaskHub')
        : join(env.XDG_CONFIG_HOME || join(home, '.config'), 'taskhub')
  );

  if (!isAbsolute(configHome)) throw new Error('TASKHUB_CONFIG_DIR must be an absolute path.');
  return join(configHome, 'credentials.json');
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const apiUrl = env.TASKHUB_API_URL || 'http://localhost:3001/api';

  // Enforce HTTPS in production to prevent credential leaks
  const isLocal = apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1');
  if (!isLocal && !apiUrl.startsWith('https://')) {
    throw new Error(
      `TASKHUB_API_URL must use HTTPS for remote servers (got: ${apiUrl}). ` +
        'Only localhost URLs are allowed over HTTP.',
    );
  }

  return {
    apiUrl,
    apiToken: env.TASKHUB_API_TOKEN || null,
    credentialsPath: getCredentialStorePath(env),
  };
}
