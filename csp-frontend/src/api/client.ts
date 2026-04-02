import axios from 'axios';
import { API } from '../config/api';
import { clearToken, getToken } from '../utils/auth';

const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_STORAGE_KEY = 'csp_csrf_token';
const AUTH_FAILURE_CODES = new Set(['AUTH_REQUIRED', 'INVALID_TOKEN']);
const STATE_CHANGING_METHODS = new Set(['post', 'put', 'patch', 'delete']);

function readStoredCsrfToken() {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.sessionStorage.getItem(CSRF_STORAGE_KEY) || '';
}

let csrfToken = readStoredCsrfToken();

function storeCsrfToken(nextToken?: string) {
  if (!nextToken || typeof nextToken !== 'string') {
    return;
  }

  csrfToken = nextToken;

  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(CSRF_STORAGE_KEY, nextToken);
  }
}

function clearCsrfToken() {
  csrfToken = '';

  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(CSRF_STORAGE_KEY);
  }
}

type ApiErrorPayload = {
  message?: string;
  remainingTime?: number;
};

export function getApiErrorPayload(error: unknown): ApiErrorPayload {
  if (typeof error !== 'object' || error === null) {
    return {};
  }

  const payload = (
    error as {
      response?: {
        data?: ApiErrorPayload;
      };
      message?: string;
    }
  ).response?.data;

  if (payload && typeof payload === 'object') {
    return payload;
  }

  const message = (error as { message?: string }).message;
  return typeof message === 'string' && message ? { message } : {};
}

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = getToken();
  const method = String(config.method || 'get').toLowerCase();

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Added: forward the server-issued CSRF token on unsafe requests only.
  if (STATE_CHANGING_METHODS.has(method) && csrfToken) {
    config.headers = config.headers || {};
    config.headers[CSRF_HEADER_NAME] = csrfToken;
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    storeCsrfToken(response.headers?.[CSRF_HEADER_NAME]);
    return response;
  },
  (error) => {
    const status = error?.response?.status as number | undefined;
    const errorCode = error?.response?.data?.errorCode as string | undefined;

    storeCsrfToken(error?.response?.headers?.[CSRF_HEADER_NAME]);

    if (status === 401 || (status === 403 && AUTH_FAILURE_CODES.has(errorCode || ''))) {
      clearToken();
      clearCsrfToken();
      if (window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    }

    return Promise.reject(error);
  }
);
