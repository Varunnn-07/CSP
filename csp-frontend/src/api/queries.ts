import { api } from './client';

export type QueryItem = {
  id: string;
  user_id: string;
  service_name: string;
  subject: string;
  message: string;
  category: 'Billing' | 'Technical' | 'Security' | 'Service' | 'General';
  priority: 1 | 2 | 3;
  status: 'Open' | 'In Progress' | 'Resolved';
  admin_reply: string | null;
  replied_by: string | null;
  replied_at: string | null;
  created_at: string;
  updated_at: string;
  last_updated?: string;
  lastUpdated?: string;
};

export type SecurityAuditLog = {
  id: string;
  user_id: string | null;
  action: string;
  event_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'success' | 'failure';
  ip: string | null;
  user_agent: string | null;
  request_id: string | null;
  event_timestamp: string;
  metadata: Record<string, unknown> | null;
};

export type FailedLoginAttempt = {
  ip: string;
  failed_count: number;
  last_failed_at: string;
};

export type BlockedIp = {
  id: string;
  ip: string;
  blocked_until: string;
  reason: string | null;
  created_at: string;
};

type QueryListResponse = {
  success: boolean;
  data: QueryItem[];
};

type QueryOneResponse = {
  success: boolean;
  data: QueryItem;
};

type SecurityEventsResponse = {
  success: boolean;
  data: {
    recentAuditLogs: SecurityAuditLog[];
    failedLoginAttempts: FailedLoginAttempt[];
    blockedIps: BlockedIp[];
  };
};

export type CreateQueryPayload = {
  service_name: string;
  subject: string;
  message: string;
  category: 'Billing' | 'Technical' | 'Security' | 'Service' | 'General';
};

export async function getMyQueries() {
  const { data } = await api.get<QueryListResponse>('/queries');
  return data;
}

export async function getAllQueries() {
  const { data } = await api.get<QueryListResponse>('/queries/admin/all');
  return data;
}

export async function createQuery(payload: CreateQueryPayload) {
  const { data } = await api.post<QueryOneResponse>('/queries', payload);
  return data;
}

export async function getQueryById(id: string) {
  const { data } = await api.get<QueryOneResponse>(`/queries/${id}`);
  return data;
}

export async function replyToOwnQuery(id: string, message: string) {
  const { data } = await api.post<QueryOneResponse>(`/queries/${id}/reply`, { message });
  return data;
}

export async function updateQueryStatus(id: string, status: 'Open' | 'In Progress' | 'Resolved') {
  const { data } = await api.patch<QueryOneResponse>(`/queries/admin/${id}/status`, { status });
  return data;
}

export async function replyToQuery(id: string, reply: string) {
  const { data } = await api.post<QueryOneResponse>(`/queries/admin/${id}/reply`, { reply });
  return data;
}

export async function getSecurityEvents() {
  const { data } = await api.get<SecurityEventsResponse>('/admin/security/events');
  return data;
}
