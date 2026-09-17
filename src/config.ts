export interface Config {
  apiUrl: string;
  apiToken: string | null;
}

export function loadConfig(): Config {
  const apiUrl = process.env.TASKHUB_API_URL || 'http://localhost:3001/api';

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
    apiToken: process.env.TASKHUB_API_TOKEN || null,
  };
}
