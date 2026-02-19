import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../api-client.js';
import type { ScopeChecker } from '../scopes.js';
import type { ProjectDetail } from '../types.js';
import { readContext, writeContext } from '../context.js';
import { textResult, errorResult, formatProject } from './helpers.js';

export function registerContextTools(
  server: McpServer,
  api: ApiClient,
  _scopes: ScopeChecker,
) {
  // ─── taskhub_context ────────────────────────────────────────────
  server.tool(
    'taskhub_context',
    'Show the project linked to the current working directory (from .taskhub.json).',
    {},
    async () => {
      try {
        const ctx = readContext();
        if (!ctx) {
          return textResult(
            'No project linked to this directory.\n' +
              'Use taskhub_connect to link a project, or taskhub_projects_list to see available projects.',
          );
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

        writeContext({
          projectId: project.id,
          projectName: project.name,
          projectSlug: project.slug,
          systemCode: project.systemCode,
          organizationId: project.organizationId,
          organizationName: project.organization?.name || null,
        });

        return textResult(
          `Directory linked to project:\n${formatProject(project)}\n\n` +
            `.taskhub.json created. Task operations will now default to this project.`,
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );
}
