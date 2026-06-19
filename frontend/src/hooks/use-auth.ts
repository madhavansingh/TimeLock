'use client';

import { useState, useEffect } from 'react';

export function useAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ userId: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('ltn_token');
      const storedUser = localStorage.getItem('ltn_user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
      setLoading(false);
    }
  }, []);

  const login = (newToken: string, newUser: { userId: string; role: string }) => {
    localStorage.setItem('ltn_token', newToken);
    localStorage.setItem('ltn_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('ltn_token');
    localStorage.removeItem('ltn_user');
    setToken(null);
    setUser(null);
  };

  return {
    token,
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!token
  };
}
