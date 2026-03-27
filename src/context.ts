import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ProjectContext, SubProjectEntry } from './types.js';

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

/**
 * Resolves which sub-project entry is "active" based on the current working directory.
 * Uses longest-match: if cwd is /root/backend/src, and subProjects has "./backend",
 * it matches "./backend" because /root/backend is a prefix of cwd.
 *
 * NOTE: In MCP server context, process.cwd() is fixed at server startup and may not
 * reflect the agent's current working directory. For accurate resolution, callers
 * should pass `contextDir` explicitly when available. When no match is found,
 * the parent project is used as fallback.
 *
 * @param ctx - The project context read from .taskhub.json
 * @param contextDir - The directory where .taskhub.json lives (defaults to process.cwd())
 * @returns The matching SubProjectEntry, or null (meaning: use parent project)
 */
export function resolveActiveProject(ctx: ProjectContext, contextDir?: string): SubProjectEntry | null {
  if (!ctx.subProjects || ctx.subProjects.length === 0) return null;

  const currentDir = resolve(process.cwd());
  const baseDir = resolve(contextDir || process.cwd());

  let bestMatch: SubProjectEntry | null = null;
  let bestMatchLength = 0;

  for (const sub of ctx.subProjects) {
    const subAbsPath = resolve(baseDir, sub.path);
    if (currentDir === subAbsPath || currentDir.startsWith(subAbsPath + '/')) {
      if (subAbsPath.length > bestMatchLength) {
        bestMatch = sub;
        bestMatchLength = subAbsPath.length;
      }
    }
  }

  return bestMatch;
}

/**
 * Returns the effective projectId for the current working directory.
 * If in a sub-project directory, returns that sub-project's ID.
 * Otherwise returns the parent project's ID.
 *
 * @param ctx - The project context read from .taskhub.json
 * @param contextDir - The directory where .taskhub.json lives (defaults to process.cwd())
 */
export function getEffectiveProjectId(ctx: ProjectContext, contextDir?: string): string {
  const sub = resolveActiveProject(ctx, contextDir);
  return sub ? sub.projectId : ctx.projectId;
}

/**
 * Returns all project IDs (parent + all sub-projects).
 * Useful for fetching tasks from all projects at once.
 */
export function getAllProjectIds(ctx: ProjectContext): string[] {
  const ids = new Set<string>([ctx.projectId]);
  if (ctx.subProjects) {
    for (const sub of ctx.subProjects) {
      ids.add(sub.projectId);
    }
  }
  return Array.from(ids);
}
