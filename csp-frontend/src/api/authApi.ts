import { api } from './client';

export type LoginPayload = {
  email: string;
  password: string;
};

export type LoginApiResponse = {
  success: boolean;
  requireOtp?: boolean;
  mfa_required?: boolean;
  mfaRequired?: boolean;
  mfaSetupRequired?: boolean;
  mfa_setup_required?: boolean;
  userId?: string;
  preAuthToken?: string;
  token?: string;
  accessToken?: string;
  refreshToken?: string;
  qrCode?: string;
  manualCode?: string;
  message?: string;
  errorCode?: string;
};

export type VerifyOtpPayload = {
  userId: string;
  otp: string;
  preAuthToken?: string;
};

export type VerifyOtpApiResponse = {
  success: boolean;
  token?: string;
  accessToken?: string;
  refreshToken?: string;
  remainingTime?: number;
  message?: string;
  errorCode?: string;
};

export type MfaSetupApiResponse = {
  success: boolean;
  qrCode?: string;
  manualCode?: string;
  secret?: string;
  userId?: string;
  preAuthToken?: string;
  message?: string;
  errorCode?: string;
};

export type VerifyMfaSetupPayload = {
  userId: string;
  otp: string;
  preAuthToken?: string;
};

export type VerifyMfaSetupApiResponse = {
  success: boolean;
  token?: string;
  accessToken?: string;
  refreshToken?: string;
  remainingTime?: number;
  message?: string;
  errorCode?: string;
};

export async function login(payload: LoginPayload) {
  const { data } = await api.post<LoginApiResponse>('/auth/login', payload);
  return data;
}

export async function verifyOtp(payload: VerifyOtpPayload) {
  const { data } = await api.post<VerifyOtpApiResponse>('/auth/verify-otp', payload);
  return data;
}

export async function setupMfa(payload: { userId: string; preAuthToken?: string }) {
  const { data } = await api.post<MfaSetupApiResponse>('/auth/mfa/setup', payload);
  return data;
}

export async function verifyMfaSetup(payload: VerifyMfaSetupPayload) {
  const { data } = await api.post<VerifyMfaSetupApiResponse>('/auth/mfa/verify-setup', payload);
  return data;
}
