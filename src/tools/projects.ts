import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../api-client.js';
import type { ScopeChecker } from '../scopes.js';
import type { Project, ProjectDetail, ProjectMember, TaskStatus, Invitation } from '../types.js';
import { getRequestContext, readContext, withProjectContext, writeContext } from '../context.js';
import { textResult, errorResult, formatProject, formatMember, paginationInfo } from './helpers.js';

function requireProjectParams(params: Record<string, string | undefined>) {
  const linked = readContext();
  const context = getRequestContext();
  if (!linked || !context.projectId) throw new Error('A linked project context is required.');
  if (linked?.subProjects && new Set(linked.subProjects.map((sub) => sub.path)).size !== linked.subProjects.length) {
    throw new Error('Ambiguous linked project context.');
  }
  return { linked, context, params: withProjectContext(params, context) };
}

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
        const { params } = requireProjectParams({
          organizationId,
          personal: personal ? 'true' : undefined,
        });

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
        const { context, params } = requireProjectParams({ projectId });
        let project: ProjectDetail;

        if (projectId) {
          project = await api.get<ProjectDetail>(`/projects/${projectId}`, params);
        } else if (slug) {
          project = await api.get<ProjectDetail>(`/projects/by-slug/${slug}`, params);
        } else {
          return errorResult('Provide projectId or slug');
        }

        const pid = context.projectId;

        // Fetch related data from separate endpoints
        const [statuses, members, modules] = await Promise.all([
          api.get<TaskStatus[]>(`/projects/${pid}/statuses`, params).catch(() => []),
          api.get<ProjectDetail['members']>(`/projects/${pid}/members`, params).catch(() => []),
          api.get<ProjectDetail['modules']>(`/projects/${pid}/modules`, params).catch(() => []),
        ]);

        const lines = [formatProject(project)];

        const statusArr = Array.isArray(statuses) ? statuses : [];
        if (statusArr.length) {
          lines.push(`\n  Statuses:`);
          statusArr.forEach((s) =>
            lines.push(`    - ${s.name} (color: ${s.color}, pos: ${s.position}${s.isDefault ? ', DEFAULT' : ''}${s.isCompleted ? ', COMPLETED' : ''})`),
          );
        }

        const moduleArr = Array.isArray(modules) ? modules : [];
        if (moduleArr.length) {
          lines.push(`\n  Modules:`);
          moduleArr.forEach((m: { name: string; systemCode: string }) =>
            lines.push(`    - ${m.name} [${m.systemCode}]`),
          );
        }

        const memberArr = Array.isArray(members) ? members : [];
        if (memberArr.length) {
          lines.push(`\n  Members:`);
          memberArr.forEach((m: { user: { firstName: string; lastName: string; email: string }; role: string }) =>
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
      parentId: z.string().optional().describe('Parent project UUID (for creating sub-projects)'),
    },
    async ({ name, description, organizationId, parentId }) => {
      try {
        await scopes.checkScope('projects:write');
        const { context, params } = requireProjectParams({});
        const project = await api.post<Project>('/projects', {
          name,
          description,
          organizationId,
          parentId,
          projectId: context.projectId,
          ...params,
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
        const { params } = requireProjectParams({ projectId });
        const inv = await api.post<Invitation>(
          `/projects/${projectId}/invitations`,
          { email, role, ...params },
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

  // ─── taskhub_project_members ──────────────────────────────────
  server.tool(
    'taskhub_project_members',
    'List members of a project with their roles and user IDs. Useful for finding user IDs when assigning tasks. Auto-detects project from .taskhub.json if not specified.',
    {
      projectId: z.string().optional().describe('Project UUID (auto-detected from .taskhub.json if omitted)'),
    },
    async ({ projectId }) => {
      try {
        await scopes.checkScope('projects:read');

        const { linked, params } = requireProjectParams({ projectId });
        const pid = projectId || linked?.projectId;

        const members = await api.get<ProjectMember[]>(`/projects/${pid}/members`, params);
        const arr = Array.isArray(members) ? members : [];

        if (!arr.length) return textResult('No members found in this project.');

        let header = '';
        if (!projectId && linked) {
          header = `[Project: ${linked.projectName}]\n\n`;
        }

        return textResult(
          header + `Members (${arr.length}):\n` + arr.map(formatMember).join('\n'),
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  // ─── taskhub_subproject_add ─────────────────────────────────────
  server.tool(
    'taskhub_subproject_add',
    'Map a subdirectory to an existing TaskHub project (sub-project). Adds the mapping to .taskhub.json. If the project does not exist, creates it as a child of the root project.',
    {
      path: z.string().describe('Relative path to the subdirectory (e.g. "./backend")'),
      projectId: z.string().optional().describe('Existing project UUID to map'),
      projectName: z.string().optional().describe('Name for a new sub-project (will be created as a child of the root project)'),
    },
    async ({ path: subPath, projectId, projectName }) => {
      try {
        await scopes.checkScope('projects:write');
        const { linked: ctx, params } = requireProjectParams({});

        let resolvedProject: Project;

        if (projectId) {
          // Map to existing project
          resolvedProject = await api.get<Project>(`/projects/${projectId}`, params);
          // Validate the project is actually a child of the root project.
          // Using strict inequality (no short-circuit) so null parentId (root project) is also rejected.
          if (resolvedProject.parentId !== ctx.projectId) {
            return errorResult(
              `Project "${resolvedProject.name}" belongs to a different parent project. ` +
              `Expected parent: ${ctx.projectId}, found: ${resolvedProject.parentId}`
            );
          }
        } else if (projectName) {
          // Create new child project under the root project
          resolvedProject = await api.post<Project>('/projects', {
            name: projectName,
            parentId: ctx.projectId,
            organizationId: ctx.organizationId,
            projectId: ctx.projectId,
            ...params,
          });
        } else {
          return errorResult('Provide projectId (existing) or projectName (to create new sub-project)');
        }

        // Add to subProjects in context
        const subProjects = ctx.subProjects || [];

        // Remove existing mapping for same path (replace it)
        const filtered = subProjects.filter(s => s.path !== subPath);

        filtered.push({
          path: subPath,
          projectId: resolvedProject.id,
          projectName: resolvedProject.name,
          systemCode: resolvedProject.systemCode,
        });

        writeContext({
          ...ctx,
          subProjects: filtered,
        });

        return textResult(
          `Sub-project mapped:\n  ${subPath} → ${resolvedProject.name} (${resolvedProject.systemCode})\n\n` +
          `.taskhub.json updated.`,
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  // ─── taskhub_subproject_remove ──────────────────────────────────
  server.tool(
    'taskhub_subproject_remove',
    'Remove a subdirectory mapping from .taskhub.json. Does NOT delete the project from TaskHub.',
    {
      path: z.string().describe('Relative path to remove (e.g. "./backend")'),
    },
    async ({ path: subPath }) => {
      try {
        await scopes.checkScope('projects:write');
        const { linked: ctx } = requireProjectParams({});
        if (!ctx.subProjects || ctx.subProjects.length === 0) {
          return errorResult('No sub-projects configured.');
        }

        const before = ctx.subProjects.length;
        const filtered = ctx.subProjects.filter(s => s.path !== subPath);

        if (filtered.length === before) {
          return errorResult(`No sub-project found at path "${subPath}"`);
        }

        writeContext({
          ...ctx,
          subProjects: filtered.length > 0 ? filtered : undefined,
        });

        return textResult(`Sub-project mapping removed: ${subPath}\n.taskhub.json updated.`);
      } catch (e) {
        return errorResult(e);
      }
    },
  );
}
