'use client';

import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { apiClient, setAccessToken, registerOnUnauthenticated } from '../lib/api-client';

export type UserRole = 'OWNER' | 'MANAGER' | 'EMPLOYEE';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string;
  tenantName: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupPayload {
  name: string;
  email: string;
  password: string;
  restaurantName: string;
}

export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isSubmitting: boolean;
  isAuthenticated: boolean;
  /** Logs in and returns the authenticated user — use the returned value for
   *  role-based redirect logic since React state updates are async. */
  login: (credentials: LoginCredentials) => Promise<AuthUser>;
  signup: (payload: SignupPayload) => Promise<void>;
  logout: (forced?: boolean) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

AuthContext.displayName = 'AuthContext';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): React.JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const didHydrate = useRef<boolean>(false);

  const logout = useCallback(async (forced = false): Promise<void> => {
    if (!forced) {
      setIsSubmitting(true);
    }
    try {
      if (!forced) {
        await apiClient.post('/auth/logout');
      }
    } catch {
      // Échec silencieux du serveur : l'invalidation client prime
    } finally {
      setAccessToken(null);
      setUser(null);
      if (!forced) {
        setIsSubmitting(false);
      }
    }
  }, []);

  useEffect(() => {
    // Liaison cruciale : vide l'état global si l'api-client intercepte un échec de refresh fatal
    registerOnUnauthenticated(() => {
      logout(true);
    });
  }, [logout]);

  useEffect(() => {
    if (didHydrate.current) return;
    didHydrate.current = true;

    async function hydrate(): Promise<void> {
      try {
        const { data } = await apiClient.post<{
          accessToken: string;
          user: AuthUser;
        }>('/auth/refresh');

        setAccessToken(data.accessToken);
        setUser(data.user);
      } catch {
        setAccessToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    hydrate();
  }, []);

  const login = useCallback(async (credentials: LoginCredentials): Promise<AuthUser> => {
    setIsSubmitting(true);
    try {
      const { data } = await apiClient.post<{
        accessToken: string;
        user: AuthUser;
      }>('/auth/login', credentials);

      setAccessToken(data.accessToken);
      setUser(data.user);
      // Return the user synchronously so callers can make role-based decisions
      // before React re-renders (state updates are async).
      return data.user;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const signup = useCallback(async (payload: SignupPayload): Promise<void> => {
    setIsSubmitting(true);
    try {
      const { data } = await apiClient.post<{
        accessToken: string;
        user: AuthUser;
      }>('/auth/signup', payload);

      setAccessToken(data.accessToken);
      setUser(data.user);
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isSubmitting,
      isAuthenticated: user !== null,
      login,
      signup,
      logout,
    }),
    [user, isLoading, isSubmitting, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
