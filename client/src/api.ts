const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';
let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => { accessToken = token; };
export const getAccessToken = () => accessToken;

export async function api<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'include' });
  if (response.status === 401 && retry && !path.startsWith('/auth/')) {
    const refreshed = await refreshSession();
    if (refreshed) return api<T>(path, options, false);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function refreshSession(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
    if (!response.ok) { setAccessToken(null); return false; }
    const data = await response.json() as { accessToken: string };
    setAccessToken(data.accessToken);
    return true;
  } catch { setAccessToken(null); return false; }
}

export const login = (email: string, password: string) => api<{ accessToken: string; user: import('./types').SessionUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }, false);
export const signup = (data: { name: string; email: string; password: string; organizationName: string; organizationSlug: string }) => api<{ accessToken: string; user: import('./types').SessionUser }>('/auth/signup', { method: 'POST', body: JSON.stringify(data) }, false);
export const logout = () => api<void>('/auth/logout', { method: 'POST' }, false);
