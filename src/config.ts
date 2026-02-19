import { homedir } from 'node:os';
import { join } from 'node:path';

export interface Config {
  apiUrl: string;
  apiToken: string | null;
  credentialsPath: string;
}

export function loadConfig(): Config {
  return {
    apiUrl: process.env.TASKHUB_API_URL || 'http://localhost:3001/api',
    apiToken: process.env.TASKHUB_API_TOKEN || null,
    credentialsPath: join(homedir(), '.taskhub', 'credentials.json'),
  };
}
