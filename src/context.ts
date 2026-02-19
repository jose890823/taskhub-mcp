import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectContext } from './types.js';

const CONTEXT_FILE = '.taskhub.json';

export function readContext(cwd?: string): ProjectContext | null {
  try {
    const filePath = join(cwd || process.cwd(), CONTEXT_FILE);
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as ProjectContext;
  } catch {
    return null;
  }
}

export function writeContext(ctx: ProjectContext, cwd?: string): void {
  const filePath = join(cwd || process.cwd(), CONTEXT_FILE);
  writeFileSync(filePath, JSON.stringify(ctx, null, 2) + '\n');
}

export function requireContext(cwd?: string): ProjectContext {
  const ctx = readContext(cwd);
  if (!ctx) {
    throw new Error(
      'No project linked to this directory. Use taskhub_connect to link a project first, or use taskhub_projects_list to see available projects.',
    );
  }
  return ctx;
}
