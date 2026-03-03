import { jwtDecode } from 'jwt-decode';

type TokenPayload = {
  sub: string;
  role: 'admin' | 'user';
  exp: number;
  iat: number;
  iss: string;
};

const TOKEN_KEY = 'csp_token';
const OTP_USER_ID_KEY = 'csp_otp_user_id';

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function setOtpUserId(userId: string) {
  sessionStorage.setItem(OTP_USER_ID_KEY, userId);
}

export function getOtpUserId() {
  return sessionStorage.getItem(OTP_USER_ID_KEY);
}

export function clearOtpUserId() {
  sessionStorage.removeItem(OTP_USER_ID_KEY);
}

export function getTokenRole(token: string): 'admin' | 'user' | null {
  try {
    const payload = jwtDecode<TokenPayload>(token);
    if (payload.role === 'admin' || payload.role === 'user') {
      return payload.role;
    }
    return null;
  } catch {
    return null;
  }
}
