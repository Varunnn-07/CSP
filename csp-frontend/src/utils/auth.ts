import { jwtDecode } from 'jwt-decode';

type TokenPayload = {
  sub: string;
  role: 'admin' | 'user';
  exp: number;
  iat: number;
  iss: string;
  type?: 'access';
};

const TOKEN_KEY = 'csp_token';
const LOGIN_AT_KEY = 'csp_login_at';
const SESSION_TTL_MS = 30 * 60 * 1000;
let logoutTimer: number | undefined;

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(LOGIN_AT_KEY, String(Date.now()));
  scheduleAutoLogout();
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LOGIN_AT_KEY);
  if (typeof window !== 'undefined' && logoutTimer) {
    window.clearTimeout(logoutTimer);
    logoutTimer = undefined;
  }
}

function getLoginTimestamp(): number | null {
  const raw = localStorage.getItem(LOGIN_AT_KEY);
  if (!raw) {
    return null;
  }

  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function scheduleAutoLogout() {
  if (typeof window === 'undefined') {
    return;
  }

  if (logoutTimer) {
    window.clearTimeout(logoutTimer);
    logoutTimer = undefined;
  }

  const token = getToken();
  if (!token) {
    return;
  }

  let loginAt = getLoginTimestamp();
  if (!loginAt) {
    loginAt = Date.now();
    localStorage.setItem(LOGIN_AT_KEY, String(loginAt));
  }

  const remainingMs = loginAt + SESSION_TTL_MS - Date.now();

  if (remainingMs <= 0) {
    clearToken();
    if (window.location.pathname !== '/login') {
      window.location.replace('/login');
    }
    return;
  }

  logoutTimer = window.setTimeout(() => {
    clearToken();
    if (window.location.pathname !== '/login') {
      window.location.replace('/login');
    }
  }, remainingMs);
}

export function initSessionTimeout() {
  scheduleAutoLogout();
}

function decodeToken(token: string): TokenPayload | null {
  try {
    return jwtDecode<TokenPayload>(token);
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = decodeToken(token);
  if (!payload?.exp) {
    return true;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  return payload.exp <= nowSeconds;
}

export function getTokenRole(token: string): 'admin' | 'user' | null {
  const payload = decodeToken(token);

  if (!payload || isTokenExpired(token)) {
    return null;
  }

  if (payload.role === 'admin' || payload.role === 'user') {
    return payload.role;
  }

  return null;
}

export function getTokenUserId(token: string): string | null {
  const payload = decodeToken(token);

  if (!payload || isTokenExpired(token)) {
    return null;
  }

  return payload.sub || null;
}
