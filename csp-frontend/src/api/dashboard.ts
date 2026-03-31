import { api } from './client';

export type DashboardUsagePoint = {
  usage_date: string;
  storage_used_gb: number;
};

export type DashboardQuerySummary = {
  id: string;
  subject: string;
  status: 'Open' | 'In Progress' | 'Resolved';
  lastUpdated: string;
};

export type DashboardFeedbackSummary = {
  message: string;
  createdAt: string;
  serviceName?: string;
  rating?: number;
};

export type DashboardFullData = {
  user: {
    name: string;
    email: string;
    plan: string;
    phone?: string | null;
    companyName?: string | null;
    country?: string | null;
  };
  stats: {
    resolvedQueriesCount: number;
    feedbackCount: number;
    totalQueries: number;
  };
  usage: {
    currentUsageGB: number;
    usagePercentage: number;
    dailyLimit: number;
    apiRequestsToday: number;
    dataTransferToday: number;
    storageLimitGB?: number;
    apiLimitPerDay?: number;
    dataTransferLimitGB?: number;
    history: DashboardUsagePoint[];
  };
  queries: DashboardQuerySummary[];
  feedback: DashboardFeedbackSummary[];
};

export async function getDashboardFull() {
  const { data } = await api.get<DashboardFullData>('/dashboard/full');
  return data;
}

export async function getDashboard() {
  return getDashboardFull();
}
