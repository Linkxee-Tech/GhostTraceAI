import type { UserAccount } from './types';

export type DashboardType = 'admin' | 'demo' | 'user';

export const AUTH_TOKEN_KEY = 'gt_token';
export const AUTH_ROLE_KEY = 'gt_role';
export const AUTH_ACCOUNT_TYPE_KEY = 'gt_account_type';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_ROLE_KEY);
  localStorage.removeItem(AUTH_ACCOUNT_TYPE_KEY);
}

export function getDashboardPath(type: DashboardType): string {
  if (type === 'admin') return '/admin';
  if (type === 'demo') return '/demo';
  return '/dashboard';
}

export function resolveDashboardType(user: Pick<UserAccount, 'role' | 'email'>): DashboardType {
  if (user.role === 'admin') return 'admin';
  if ((user.email || '').toLowerCase().includes('demo')) return 'demo';
  return 'user';
}

export function persistSession(token: string, user?: Pick<UserAccount, 'role' | 'email'>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  if (user) {
    const type = resolveDashboardType(user);
    localStorage.setItem(AUTH_ROLE_KEY, user.role);
    localStorage.setItem(AUTH_ACCOUNT_TYPE_KEY, type);
  }
}

