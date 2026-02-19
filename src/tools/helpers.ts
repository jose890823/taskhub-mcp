import type { Task, Project, Organization, Comment, Notification } from '../types.js';

export function textResult(text: string): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text' as const, text }] };
}

export function errorResult(error: unknown): { content: Array<{ type: 'text'; text: string }>; isError: true } {
  const msg = error instanceof Error ? error.message : String(error);
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
    parts.push(`  Assigned: ${t.assignees.map(a => `${a.user.firstName} ${a.user.lastName}`).join(', ')}`);
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

export function paginationInfo(data: unknown): string {
  const d = data as Record<string, unknown>;
  const p = d.__pagination as Record<string, number> | undefined;
  if (!p) return '';
  return `\n--- Page ${p.page}/${p.totalPages} (${p.total} total) ---`;
}
