import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { fetchSession, signOutSession } from '../lib/api';

/** Signed-in snapshot plus loading/refresh/sign-out controls. */
export type SessionState = {
  email: string | null;
  emailVerified: boolean;
  enabled: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

/**
 * Fetch `/api/auth/session` once on mount and share it with every page.
 *
 * @param props.children - App tree that may call {@link useSession}.
 */
export function SessionProvider({ children }: { children: ReactNode }): JSX.Element {
  const [email, setEmail] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  /** Re-fetch `/api/auth/session` and update the shared snapshot. */
  const refresh = useCallback(async (): Promise<void> => {
    try {
      const data = await fetchSession();
      setEmail(data.email);
      setEmailVerified(data.emailVerified);
      setEnabled(data.enabled);
    } catch {
      setEmail(null);
      setEmailVerified(false);
      setEnabled(false);
    } finally {
      setLoading(false);
    }
  }, []);

  /** POST `/api/auth/signout` and refresh so every page sees a signed-out state. */
  const signOut = useCallback(async (): Promise<void> => {
    try {
      await signOutSession();
    } finally {
      setEmail(null);
      setEmailVerified(false);
      await refresh();
    }
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<SessionState>(
    () => ({ email, emailVerified, enabled, loading, refresh, signOut }),
    [email, emailVerified, enabled, loading, refresh, signOut]
  );

  return createElement(SessionContext.Provider, { value }, children);
}

/**
 * Read the shared session. Must be used under {@link SessionProvider}.
 *
 * @returns Current session snapshot and actions.
 */
export function useSession(): SessionState {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return value;
}
