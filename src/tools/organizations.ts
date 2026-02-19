import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../api-client.js';
import type { ScopeChecker } from '../scopes.js';
import type { Organization, OrganizationMember, Invitation } from '../types.js';
import { textResult, errorResult, formatOrg } from './helpers.js';

export function registerOrganizationTools(
  server: McpServer,
  api: ApiClient,
  scopes: ScopeChecker,
) {
  // ─── taskhub_orgs_list ──────────────────────────────────────────
  server.tool(
    'taskhub_orgs_list',
    'List your organizations.',
    {},
    async () => {
      try {
        await scopes.checkScope('organizations:read');
        const orgs = await api.get<Organization[]>('/organizations');
        if (!orgs.length) return textResult('No organizations found.');
        return textResult(orgs.map(formatOrg).join('\n\n'));
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  // ─── taskhub_org_create ─────────────────────────────────────────
  server.tool(
    'taskhub_org_create',
    'Create a new organization.',
    {
      name: z.string().describe('Organization name'),
      description: z.string().optional().describe('Organization description'),
    },
    async ({ name, description }) => {
      try {
        await scopes.checkScope('organizations:write');
        const org = await api.post<Organization>('/organizations', {
          name,
          description,
        });
        return textResult(`Organization created:\n${formatOrg(org)}`);
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  // ─── taskhub_org_members ────────────────────────────────────────
  server.tool(
    'taskhub_org_members',
    'List members of an organization.',
    {
      organizationId: z.string().describe('Organization UUID'),
    },
    async ({ organizationId }) => {
      try {
        await scopes.checkScope('organizations:read');
        const members = await api.get<OrganizationMember[]>(
          `/organizations/${organizationId}/members`,
        );
        if (!members.length) return textResult('No members found.');
        const lines = members.map(
          (m) =>
            `${m.user.firstName} ${m.user.lastName} (${m.user.email}) — ${m.role}`,
        );
        return textResult(lines.join('\n'));
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  // ─── taskhub_org_invite ─────────────────────────────────────────
  server.tool(
    'taskhub_org_invite',
    'Invite a user to an organization by email.',
    {
      organizationId: z.string().describe('Organization UUID'),
      email: z.string().email().describe('Email to invite'),
      role: z
        .enum(['admin', 'member'])
        .default('member')
        .describe('Role for the invited user'),
    },
    async ({ organizationId, email, role }) => {
      try {
        await scopes.checkScope('invitations:write');
        const inv = await api.post<Invitation>(
          `/organizations/${organizationId}/invitations`,
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
