import { createContext, useContext, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorCode } from '../api/client';
import { authApi } from '../api/endpoints';

const AuthContext = createContext(null);
const ME_KEY = ['me'];

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const { data: user, isPending } = useQuery({ queryKey: ME_KEY, queryFn: authApi.me, staleTime: Infinity });

  // Keep the cached user in sync with what the server says about the session.
  useEffect(() => {
    const id = api.interceptors.response.use(undefined, (err) => {
      const isAuthCall = err.config?.url?.startsWith('/auth/');
      if (err.response?.status === 401 && !isAuthCall) {
        queryClient.setQueryData(ME_KEY, null);
      } else if (errorCode(err) === 'PASSWORD_CHANGE_REQUIRED') {
        queryClient.setQueryData(ME_KEY, (u) => (u ? { ...u, mustChangePassword: true } : u));
      }
      return Promise.reject(err);
    });
    return () => api.interceptors.response.eject(id);
  }, [queryClient]);

  const value = {
    user: user ?? null,
    isLoading: isPending,
    setUser: (u) => queryClient.setQueryData(ME_KEY, u),
    async logout() {
      try {
        await authApi.logout();
      } finally {
        // Keep the observed `me` query alive (clear() would detach it and leave the old user on screen).
        queryClient.setQueryData(ME_KEY, null);
        queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== ME_KEY[0] });
      }
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
