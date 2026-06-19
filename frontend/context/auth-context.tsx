'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from '@/lib/api';
import { useRouter } from 'next/navigation';

export interface UserSession {
  userId: string;
  role: string;
}

interface AuthContextType {
  user: UserSession | null;
  token: string | null;
  isLoading: boolean;
  login: (identifier: string, code: string) => Promise<UserSession>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Restore session from localStorage on load
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        // Clear corrupt storage
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (identifier: string, code: string): Promise<UserSession> => {
    setIsLoading(true);
    try {
      const response = await apiClient.post('/auth/login', { identifier, code });
      if (!response.data || !response.data.accessToken || !response.data.user) {
        throw new Error('Invalid authentication response.');
      }

      const { accessToken, refreshToken, user: userProfile } = response.data;
      const sessionUser: UserSession = {
        userId: userProfile.userId,
        role: userProfile.role,
      };

      localStorage.setItem('token', accessToken);
      if (refreshToken) {
        localStorage.setItem('refreshToken', refreshToken);
      }
      localStorage.setItem('user', JSON.stringify(sessionUser));
      setToken(accessToken);
      setUser(sessionUser);

      // Redirect based on role
      if (sessionUser.role === 'CITIZEN') {
        router.push('/dashboard');
      } else if (sessionUser.role === 'NOTARY') {
        router.push('/notary');
      } else {
        // Institutional/Auditor dashboards (e.g. Bank Officer, Court Clerk)
        router.push('/search');
      }

      return sessionUser;
    } catch (err) {
      setIsLoading(false);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
