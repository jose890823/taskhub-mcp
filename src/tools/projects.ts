import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../api-client.js';
import type { ScopeChecker } from '../scopes.js';
import type { Project, ProjectDetail, Invitation } from '../types.js';
import { textResult, errorResult, formatProject, paginationInfo } from './helpers.js';

export function registerProjectTools(
  server: McpServer,
  api: ApiClient,
  scopes: ScopeChecker,
) {
  // ─── taskhub_projects_list ──────────────────────────────────────
  server.tool(
    'taskhub_projects_list',
    'List projects. Optionally filter by organization or personal projects.',
    {
      organizationId: z.string().optional().describe('Filter by organization UUID'),
      personal: z.boolean().optional().describe('Show only personal projects (no organization)'),
    },
    async ({ organizationId, personal }) => {
      try {
        await scopes.checkScope('projects:read');
        const params: Record<string, string | undefined> = {};
        if (organizationId) params.organizationId = organizationId;
        if (personal) params.personal = 'true';

        const projects = await api.get<Project[]>('/projects', params);
        if (!Array.isArray(projects) || !projects.length)
          return textResult('No projects found.');
        return textResult(
          projects.map(formatProject).join('\n\n') + paginationInfo(projects),
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  // ─── taskhub_project_info ───────────────────────────────────────
  server.tool(
    'taskhub_project_info',
    'Get detailed information about a project, including members, statuses, and modules.',
    {
      projectId: z.string().optional().describe('Project UUID'),
      slug: z.string().optional().describe('Project slug'),
    },
    async ({ projectId, slug }) => {
      try {
        await scopes.checkScope('projects:read');
        let project: ProjectDetail;

        if (projectId) {
          project = await api.get<ProjectDetail>(`/projects/${projectId}`);
        } else if (slug) {
          project = await api.get<ProjectDetail>(`/projects/by-slug/${slug}`);
        } else {
          return errorResult('Provide projectId or slug');
        }

        const lines = [formatProject(project)];

        if (project.statuses?.length) {
          lines.push(`\n  Statuses:`);
          project.statuses.forEach((s) =>
            lines.push(`    - ${s.name} (color: ${s.color}, pos: ${s.position}${s.isDefault ? ', DEFAULT' : ''})`),
          );
        }

        if (project.modules?.length) {
          lines.push(`\n  Modules:`);
          project.modules.forEach((m) =>
            lines.push(`    - ${m.name} [${m.systemCode}]`),
          );
        }

        if (project.members?.length) {
          lines.push(`\n  Members:`);
          project.members.forEach((m) =>
            lines.push(
              `    - ${m.user.firstName} ${m.user.lastName} (${m.user.email}) — ${m.role}`,
            ),
          );
        }

        return textResult(lines.join('\n'));
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  // ─── taskhub_project_create ─────────────────────────────────────
  server.tool(
    'taskhub_project_create',
    'Create a new project. Specify organizationId for org project, or omit for personal project.',
    {
      name: z.string().describe('Project name'),
      description: z.string().optional().describe('Project description'),
      organizationId: z.string().optional().describe('Organization UUID (omit for personal project)'),
    },
    async ({ name, description, organizationId }) => {
      try {
        await scopes.checkScope('projects:write');
        const project = await api.post<Project>('/projects', {
          name,
          description,
          organizationId,
        });
        return textResult(`Project created:\n${formatProject(project)}`);
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  // ─── taskhub_project_invite ─────────────────────────────────────
  server.tool(
    'taskhub_project_invite',
    'Invite a user to a project by email.',
    {
      projectId: z.string().describe('Project UUID'),
      email: z.string().email().describe('Email to invite'),
      role: z
        .enum(['admin', 'member', 'viewer'])
        .default('member')
        .describe('Role for the invited user'),
    },
    async ({ projectId, email, role }) => {
      try {
        await scopes.checkScope('invitations:write');
        const inv = await api.post<Invitation>(
          `/projects/${projectId}/invitations`,
          { email, role },
        );
        return textResult(
          `Invitation sent to ${email} as ${role}.\n` +
            `Status: ${inv.status} | Expires: ${inv.expiresAt}`,
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );
}
