import { useState, useEffect, useCallback } from 'react';
import { useNostrLogin } from '@nostrify/react/login';
import { clearAllStorage } from '@/utils/storageUtils';

export interface UseAuthStateReturn {
  isAuthenticated: boolean;
  authChecked: boolean;
  logout: () => Promise<void>;
  logins: readonly any[];
}

/**
 * Custom hook for managing authentication state
 * Handles authentication status tracking, login/logout operations,
 * user session persistence, and authentication checks
 */
export const useAuthState = (): UseAuthStateReturn => {
  const { logins, removeLogin } = useNostrLogin();
  const [authChecked, setAuthChecked] = useState(true);
  
  const isAuthenticated = logins.length > 0;

  const logout = useCallback(async () => {
    const login = logins[0];
    if (login) {
      removeLogin(login.id);
      clearAllStorage();
    }
  }, [logins, removeLogin]);

  // Set authChecked to true on initial render
  useEffect(() => {
    setAuthChecked(true);
  }, []);

  return {
    isAuthenticated,
    authChecked,
    logout,
    logins
  };
};