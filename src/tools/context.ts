import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../api-client.js';
import type { ScopeChecker } from '../scopes.js';
import type { Project, ProjectDetail } from '../types.js';
import { readContext, writeContext, resolveActiveProject } from '../context.js';
import { textResult, errorResult, formatProject } from './helpers.js';

/**
 * Helper: builds the "no project connected" message with available projects.
 * Used by taskhub_context and exported for other tools to reuse.
 */
export async function buildNoContextMessage(api: ApiClient): Promise<string> {
  const lines = [
    'No project linked to this directory.',
    '',
  ];

  try {
    const projects = await api.get<Project[]>('/projects');
    const arr = Array.isArray(projects) ? projects : [];

    if (arr.length) {
      lines.push('Available projects:');
      arr.forEach((p, i) => {
        const desc = p.description ? ` — ${p.description}` : '';
        lines.push(`  ${i + 1}. ${p.name} (${p.systemCode})${desc}`);
      });
      lines.push('');
      lines.push('To connect, ask the user which project this directory belongs to, then call:');
      lines.push('  taskhub_connect({systemCode: "PRJ-XXXXXX-XXXX"})');
      lines.push('Or create a new project with taskhub_project_create, then connect it.');
    } else {
      lines.push('No projects found. Create one with taskhub_project_create first.');
    }
  } catch {
    lines.push('Could not fetch projects (are you logged in?). Use taskhub_login first.');
  }

  return lines.join('\n');
}

export function registerContextTools(
  server: McpServer,
  api: ApiClient,
  _scopes: ScopeChecker,
) {
  // ─── taskhub_context ────────────────────────────────────────────
  server.tool(
    'taskhub_context',
    'Show the project linked to the current working directory. If no project is linked, automatically lists available projects so the user can choose one to connect.',
    {},
    async () => {
      try {
        const ctx = readContext();
        if (!ctx) {
          const msg = await buildNoContextMessage(api);
          return textResult(msg);
        }
        const lines = [
          `Linked Project: ${ctx.projectName}`,
          `  ID: ${ctx.projectId}`,
          `  Slug: ${ctx.projectSlug}`,
          `  SystemCode: ${ctx.systemCode}`,
          ctx.organizationName
            ? `  Organization: ${ctx.organizationName} (${ctx.organizationId})`
            : `  Type: Personal project`,
        ];

        if (ctx.subProjects && ctx.subProjects.length > 0) {
          lines.push(`\n  Sub-projects:`);
          for (const sub of ctx.subProjects) {
            lines.push(`    ${sub.path} → ${sub.projectName} (${sub.systemCode})`);
          }

          // Show active project based on cwd
          const activeSub = resolveActiveProject(ctx);
          if (activeSub) {
            lines.push(`\n  Active (based on cwd): ${activeSub.projectName} (${activeSub.systemCode})`);
          } else {
            lines.push(`\n  Active (based on cwd): ${ctx.projectName} (root)`);
          }
        }

        return textResult(lines.join('\n'));
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  // ─── taskhub_connect ────────────────────────────────────────────
  server.tool(
    'taskhub_connect',
    'Link the current directory to a TaskHub project. Subsequent task operations will default to this project. Use project ID, slug, or systemCode to identify the project.',
    {
      projectId: z.string().optional().describe('Project UUID'),
      slug: z.string().optional().describe('Project slug'),
      systemCode: z.string().optional().describe('Project systemCode (e.g. PRJ-260219-A3K7)'),
    },
    async ({ projectId, slug, systemCode }) => {
      try {
        let project: ProjectDetail;

        if (projectId) {
          project = await api.get<ProjectDetail>(`/projects/${projectId}`);
        } else if (slug) {
          project = await api.get<ProjectDetail>(`/projects/by-slug/${slug}`);
        } else if (systemCode) {
          const search = await api.get<{ type: string; entity: ProjectDetail }>('/search', { code: systemCode });
          if (search.type !== 'project') {
            return errorResult(`SystemCode ${systemCode} is not a project (found: ${search.type})`);
          }
          project = search.entity;
        } else {
          return errorResult('Provide one of: projectId, slug, or systemCode');
        }

        // Preserve subProjects if reconnecting to the same project
        const existingCtx = readContext();
        const preserveSubProjects = existingCtx?.projectId === project.id
          ? existingCtx.subProjects
          : undefined;

        // Build warning if sub-projects were dropped by switching to a different project
        let subProjectWarning = '';
        if (existingCtx?.subProjects?.length && !preserveSubProjects) {
          subProjectWarning = `\n\n⚠️ Previous sub-project mappings (${existingCtx.subProjects.length}) were cleared because you connected to a different project. Use taskhub_subproject_add to re-configure them.`;
        }

        writeContext({
          projectId: project.id,
          projectName: project.name,
          projectSlug: project.slug,
          systemCode: project.systemCode,
          organizationId: project.organizationId,
          organizationName: project.organization?.name || null,
          subProjects: preserveSubProjects,
        });

        return textResult(
          `Directory linked to project:\n${formatProject(project)}\n\n` +
            `.taskhub.json ${existingCtx ? 'updated' : 'created'}. Task operations will now default to this project.` +
            subProjectWarning,
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );
}
