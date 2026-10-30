import type { LoginResult, SessionUser } from './types';

const SESSION_KEY = 'tutorlink.scrum17.session';

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

export function loadSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.user) return null;
    return parsed as StoredSession;
  } catch {
    return null;
  }
}

export function saveSession(result: LoginResult | StoredSession): StoredSession {
  const session: StoredSession = {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    user: result.user,
  };
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function clearSession(): void {
  window.localStorage.removeItem(SESSION_KEY);
}

export function getAccessToken(): string | null {
  return loadSession()?.accessToken ?? null;
}

export function getRefreshToken(): string | null {
  return loadSession()?.refreshToken ?? null;
}
