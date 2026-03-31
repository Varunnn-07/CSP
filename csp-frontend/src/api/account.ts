import { api } from './client';

export type AccountProfile = {
  email?: string;
  full_name?: string;
  fullName?: string;
  phone?: string;
  company_name?: string;
  companyName?: string;
  country?: string;
  plan_name?: string;
  planName?: string;
  storage_limit_gb?: number | string;
  storageLimitGb?: number | string;
  api_limit_per_day?: number | string;
  apiLimitPerDay?: number | string;
  data_transfer_limit_gb?: number | string;
  dataTransferLimitGb?: number | string;
  data_transfer_used_gb?: number | string;
  dataTransferUsedGb?: number | string;
  api_requests_used?: number | string;
  apiRequestsUsed?: number | string;
};

type AccountProfileResponse = {
  success?: boolean;
  data?: AccountProfile;
} & AccountProfile;

export async function getAccountProfile() {
  const { data } = await api.get<AccountProfileResponse>('/account/profile');

  if (typeof data === 'object' && data !== null && 'data' in data && data.data) {
    return data.data;
  }

  return data as AccountProfile;
}
