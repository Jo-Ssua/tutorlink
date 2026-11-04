import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getMe, login as loginRequest, logoutRemote, onSessionExpired } from '../api';
import { SESSION_KEY, clearSession, loadSession } from '../session';
import type { Role, SessionUser } from '../types';

/**
 * - `loading`: hay una sesión guardada y se está confirmando con la API.
 * - `authenticated` / `anonymous`: estado final.
 */
export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  user: SessionUser | null;
  status: AuthStatus;
  /** `true` cuando la sesión se cerró sola (expiró o fue revocada). */
  expired: boolean;
  signIn: (email: string, password: string) => Promise<SessionUser>;
  signOut: () => Promise<void>;
  dismissExpired: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Pantalla inicial de cada rol. */
export function homePathFor(role: Role): string {
  switch (role) {
    case 'TUTOR':
      return '/app/tutor';
    case 'ADMIN':
      return '/app/admin';
    default:
      return '/app/calificaciones';
  }
}

/**
 * Único dueño de la sesión en el frontend. Antes el usuario vivía en un
 * `useState` de `App.tsx`, así que cada pantalla tenía que resolver por su
 * cuenta qué hacer con un 401.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [stored] = useState(() => loadSession());
  const [user, setUser] = useState<SessionUser | null>(() => stored?.user ?? null);
  const [status, setStatus] = useState<AuthStatus>(() => (stored ? 'loading' : 'anonymous'));
  const [expired, setExpired] = useState(false);

  // Al arrancar se confirma la sesión guardada contra la API: el token pudo
  // expirar o quedar revocado (logout en otro dispositivo) mientras la pestaña
  // estaba cerrada.
  useEffect(() => {
    if (!stored) return;

    let active = true;

    void getMe()
      .then((fresh) => {
        if (!active) return;
        setUser(fresh);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!active) return;
        clearSession();
        setUser(null);
        setStatus('anonymous');
      });

    return () => {
      active = false;
    };
  }, [stored]);

  // La API avisa cuando no pudo renovar el token.
  useEffect(
    () =>
      onSessionExpired(() => {
        setUser(null);
        setStatus('anonymous');
        setExpired(true);
      }),
    [],
  );

  // Cierre de sesión en otra pestaña del mismo navegador.
  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== null && event.key !== SESSION_KEY) return;

      const current = loadSession();
      if (current) {
        setUser(current.user);
        setStatus('authenticated');
        return;
      }

      setUser(null);
      setStatus('anonymous');
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await loginRequest(email, password);
    setUser(result.user);
    setStatus('authenticated');
    setExpired(false);
    return result.user;
  }, []);

  const signOut = useCallback(async () => {
    await logoutRemote();
    setUser(null);
    setStatus('anonymous');
    setExpired(false);
  }, []);

  const dismissExpired = useCallback(() => setExpired(false), []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, expired, signIn, signOut, dismissExpired }),
    [user, status, expired, signIn, signOut, dismissExpired],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }

  return context;
}
