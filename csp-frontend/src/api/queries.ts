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
};

type QueryListResponse = {
  success: boolean;
  data: QueryItem[];
};

type QueryOneResponse = {
  success: boolean;
  data: QueryItem;
};

export type CreateQueryPayload = {
  service_name: string;
  subject: string;
  message: string;
  category: 'Billing' | 'Technical' | 'Security' | 'Service' | 'General';
};

export async function getMyQueries() {
  const { data } = await api.get<QueryListResponse>('/queries/my');
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

export async function updateQueryStatus(id: string, status: 'Open' | 'In Progress' | 'Resolved') {
  const { data } = await api.patch<QueryOneResponse>(`/queries/admin/${id}/status`, { status });
  return data;
}

export async function replyToQuery(id: string, reply: string) {
  const { data } = await api.post<QueryOneResponse>(`/queries/admin/${id}/reply`, { reply });
  return data;
}
