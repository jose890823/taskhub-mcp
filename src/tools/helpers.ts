import type { Task, TaskStatus, Project, ProjectMember, Organization, Comment, Notification } from '../types.js';
import { ApiError, AuthRequiredError } from '../api-client.js';

export const DIAGNOSTIC_ENDPOINT_LABEL = 'configured endpoint';
const GENERIC_ERROR_MESSAGE = 'TaskHub request failed. Check your configuration and try again.';

export function redactEndpointForDiagnostic(_endpoint: string): string {
  return DIAGNOSTIC_ENDPOINT_LABEL;
}

export function startupDiagnostic(endpoint: string): string {
  return `TaskHub MCP Server running (API: ${redactEndpointForDiagnostic(endpoint)})`;
}

export function writeStartupDiagnostic(
  endpoint: string,
  writeError: (message: string) => void = console.error,
): void {
  writeError(startupDiagnostic(endpoint));
}

export function textResult(text: string): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text' as const, text }] };
}

export function errorResult(error: unknown): { content: Array<{ type: 'text'; text: string }>; isError: true } {
  const msg = error instanceof ApiError || error instanceof AuthRequiredError
    ? error.message
    : typeof error === 'string' && !/(authorization|bearer|password|token|https?:\/\/)/i.test(error)
      ? error
      : GENERIC_ERROR_MESSAGE;
  return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true };
}

// ─── Formatters ───────────────────────────────────────────────────

export function formatTask(t: Task): string {
  const parts: string[] = [
    `[${t.systemCode}] ${t.title}`,
    `  Type: ${t.type} | Priority: ${t.priority} | Status: ${t.status?.name || 'N/A'}`,
  ];
  if (t.project) parts.push(`  Project: ${t.project.name}`);
  if (t.assignees?.length) {
    const names = t.assignees
      .map(a => a.user ? `${a.user.firstName} ${a.user.lastName}` : a.firstName ? `${a.firstName} ${a.lastName}` : 'Unknown')
      .join(', ');
    parts.push(`  Assigned: ${names}`);
  }
  if (t.dueDate) parts.push(`  Due: ${t.dueDate}`);
  if (t.scheduledDate) parts.push(`  Scheduled: ${t.scheduledDate}`);
  if (t.completedAt) parts.push(`  Completed: ${t.completedAt}`);
  if (t.description) parts.push(`  Description: ${t.description.substring(0, 200)}${t.description.length > 200 ? '...' : ''}`);
  return parts.join('\n');
}

export function formatTaskList(tasks: Task[]): string {
  if (!tasks.length) return 'No tasks found.';
  return tasks.map(formatTask).join('\n\n');
}

export function formatProject(p: Project): string {
  const parts: string[] = [
    `[${p.systemCode}] ${p.name}`,
    `  Slug: ${p.slug}`,
  ];
  if (p.description) parts.push(`  Description: ${p.description}`);
  if (p.organizationId) {
    parts.push(`  Organization: ${p.organization?.name || p.organizationId}`);
  } else {
    parts.push(`  Type: Personal project`);
  }
  return parts.join('\n');
}

export function formatOrg(o: Organization): string {
  const parts: string[] = [
    `[${o.systemCode}] ${o.name}`,
    `  Slug: ${o.slug}`,
  ];
  if (o.description) parts.push(`  Description: ${o.description}`);
  return parts.join('\n');
}

export function formatComment(c: Comment): string {
  const author = c.user ? `${c.user.firstName} ${c.user.lastName}` : 'Unknown';
  return `[${c.createdAt}] ${author}:\n  ${c.content}`;
}

export function formatNotification(n: Notification): string {
  const read = n.readAt ? 'READ' : 'UNREAD';
  return `[${read}] ${n.title}\n  ${n.message}\n  ${n.createdAt}`;
}

export function formatStatus(s: TaskStatus): string {
  const flags: string[] = [];
  if (s.isDefault) flags.push('DEFAULT');
  if (s.isCompleted) flags.push('COMPLETED');
  const flagStr = flags.length ? ` [${flags.join(', ')}]` : '';
  return `  - ${s.name} (id: ${s.id})${flagStr}`;
}

export function formatStatusList(statuses: TaskStatus[]): string {
  if (!statuses.length) return 'No statuses found.';
  return statuses.map(formatStatus).join('\n');
}

export function formatMember(m: ProjectMember): string {
  const name = `${m.user.firstName} ${m.user.lastName}`;
  return `  - ${name} (${m.user.email}) — ${m.role} [userId: ${m.user.id}]`;
}

export function paginationInfo(data: unknown): string {
  const d = data as Record<string, unknown>;
  const p = d.__pagination as Record<string, number> | undefined;
  if (!p) return '';
  return `\n--- Page ${p.page}/${p.totalPages} (${p.total} total) ---`;
}
