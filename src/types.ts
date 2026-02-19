// ─── API Response Envelope ────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
  path: string;
}

export interface PaginatedResponse<T = unknown> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
  path: string;
}

// ─── Auth ─────────────────────────────────────────────────────────
export interface Credentials {
  accessToken: string;
  refreshToken: string;
  apiUrl: string;
  savedAt: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  roles: string[];
  emailVerified: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface McpScopesResponse {
  scopes: string[];
}

// ─── Context (.taskhub.json) ──────────────────────────────────────
export interface ProjectContext {
  projectId: string;
  projectName: string;
  projectSlug: string;
  systemCode: string;
  organizationId: string | null;
  organizationName: string | null;
}

// ─── Organizations ────────────────────────────────────────────────
export interface Organization {
  id: string;
  name: string;
  slug: string;
  systemCode: string;
  description: string | null;
  createdAt: string;
}

export interface OrganizationMember {
  id: string;
  role: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  joinedAt: string;
}

// ─── Projects ─────────────────────────────────────────────────────
export interface Project {
  id: string;
  name: string;
  slug: string;
  systemCode: string;
  description: string | null;
  organizationId: string | null;
  organization?: Organization;
  createdAt: string;
}

export interface ProjectDetail extends Project {
  members?: ProjectMember[];
  statuses?: TaskStatus[];
  modules?: ProjectModule[];
}

export interface ProjectMember {
  id: string;
  role: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface ProjectModule {
  id: string;
  name: string;
  systemCode: string;
}

// ─── Task Statuses ────────────────────────────────────────────────
export interface TaskStatus {
  id: string;
  name: string;
  color: string;
  position: number;
  isDefault: boolean;
}

// ─── Tasks ────────────────────────────────────────────────────────
export interface Task {
  id: string;
  title: string;
  description: string | null;
  type: 'project' | 'daily';
  priority: string;
  systemCode: string;
  statusId: string | null;
  status?: TaskStatus;
  projectId: string | null;
  project?: { id: string; name: string; slug: string };
  parentId: string | null;
  assignees?: TaskAssignee[];
  scheduledDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskAssignee {
  id: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

// ─── Comments ─────────────────────────────────────────────────────
export interface Comment {
  id: string;
  content: string;
  taskId: string;
  userId: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  createdAt: string;
  updatedAt: string;
}

// ─── Notifications ────────────────────────────────────────────────
export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ─── Invitations ──────────────────────────────────────────────────
export interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

// ─── Activity ─────────────────────────────────────────────────────
export interface ActivityLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface DailySummary {
  date: string;
  tasksCreated: number;
  tasksCompleted: number;
  commentsAdded: number;
  activities: ActivityLog[];
}

// ─── Search ───────────────────────────────────────────────────────
export interface SearchResult {
  type: string;
  entity: Record<string, unknown>;
}
