import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ProjectContext, SubProjectEntry } from './types.js';

const CONTEXT_FILE = '.taskhub.json';

export interface RequestContext {
  projectId: string | null;
  projectName?: string;
  projectSlug?: string;
  systemCode?: string;
  organizationId?: string | null;
  organizationName?: string | null;
}

export type ProjectRequestParams = Record<string, string | undefined>;

export function readContext(cwd?: string): ProjectContext | null {
  try {
    const filePath = join(cwd || process.cwd(), CONTEXT_FILE);
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as ProjectContext;
  } catch {
    return null;
  }
}

/**
 * Resolves the project identity that may be sent to the API for this request.
 * A missing context deliberately produces a null project so callers can keep
 * the backend's global-status path without inventing a project binding.
 */
export function getRequestContext(contextDir?: string): RequestContext {
  const ctx = readContext(contextDir);
  if (!ctx?.projectId) return { projectId: null };

  const activeSubProject = resolveActiveProject(ctx, contextDir);
  if (activeSubProject) {
    return {
      projectId: activeSubProject.projectId,
      projectName: activeSubProject.projectName,
      systemCode: activeSubProject.systemCode,
      organizationId: ctx.organizationId,
      organizationName: ctx.organizationName,
    };
  }

  return {
    projectId: ctx.projectId,
    projectName: ctx.projectName,
    projectSlug: ctx.projectSlug,
    systemCode: ctx.systemCode,
    organizationId: ctx.organizationId,
    organizationName: ctx.organizationName,
  };
}

/**
 * Adds the effective linked project to request parameters without allowing an
 * explicit project to override it. With no linked project, projectId is
 * removed so global endpoints retain their global behavior.
 */
export function withProjectContext(
  params: ProjectRequestParams,
  context: RequestContext,
): ProjectRequestParams {
  if (!context.projectId) {
    const { projectId: _projectId, ...globalParams } = params;
    return globalParams;
  }

  if (params.projectId && params.projectId !== context.projectId) {
    throw new Error('Explicit project does not match the linked project context.');
  }

  return { ...params, projectId: context.projectId };
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
