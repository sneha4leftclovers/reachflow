'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import { Role } from '@reachflow/shared';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: Role;
}

interface AuthContextType {
  user: User | null;
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginDemo: () => Promise<void>;
  signup: (data: { email: string; password: string; firstName: string; lastName: string; workspaceName?: string }) => Promise<void>;
  switchWorkspace: (workspace: Workspace) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session on mount
    const savedToken = localStorage.getItem('reachflow_access_token');
    const savedWorkspace = localStorage.getItem('reachflow_active_workspace');

    if (savedToken) {
      setAccessToken(savedToken);
      apiRequest<{ user: User; workspaces: Workspace[] }>('/auth/me', { token: savedToken })
        .then((data) => {
          setUser(data.user);
          setWorkspaces(data.workspaces);
          if (savedWorkspace) {
            try {
              const parsed = JSON.parse(savedWorkspace);
              const exists = data.workspaces.find((w) => w.id === parsed.id);
              setActiveWorkspace(exists || data.workspaces[0] || null);
            } catch {
              setActiveWorkspace(data.workspaces[0] || null);
            }
          } else {
            setActiveWorkspace(data.workspaces[0] || null);
          }
        })
        .catch(() => {
          // Token expired, clear
          localStorage.removeItem('reachflow_access_token');
          localStorage.removeItem('reachflow_active_workspace');
          setAccessToken(null);
          setUser(null);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const data = await apiRequest<{
      user: User;
      workspaces: Workspace[];
      activeWorkspace: Workspace | null;
      accessToken: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    setUser(data.user);
    setWorkspaces(data.workspaces);
    setActiveWorkspace(data.activeWorkspace || data.workspaces[0] || null);
    setAccessToken(data.accessToken);

    localStorage.setItem('reachflow_access_token', data.accessToken);
    if (data.activeWorkspace) {
      localStorage.setItem('reachflow_active_workspace', JSON.stringify(data.activeWorkspace));
    }
  };

  const loginDemo = async () => {
    const data = await apiRequest<{
      user: User;
      workspaces: Workspace[];
      activeWorkspace: Workspace | null;
      accessToken: string;
    }>('/auth/demo', {
      method: 'POST',
    });

    setUser(data.user);
    setWorkspaces(data.workspaces);
    setActiveWorkspace(data.activeWorkspace || data.workspaces[0] || null);
    setAccessToken(data.accessToken);

    localStorage.setItem('reachflow_access_token', data.accessToken);
    if (data.activeWorkspace) {
      localStorage.setItem('reachflow_active_workspace', JSON.stringify(data.activeWorkspace));
    }
  };

  const signup = async (formData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    workspaceName?: string;
  }) => {
    const data = await apiRequest<{
      user: User;
      workspace: Workspace;
      accessToken: string;
    }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(formData),
    });

    setUser(data.user);
    setWorkspaces([data.workspace]);
    setActiveWorkspace(data.workspace);
    setAccessToken(data.accessToken);

    localStorage.setItem('reachflow_access_token', data.accessToken);
    localStorage.setItem('reachflow_active_workspace', JSON.stringify(data.workspace));
  };

  const switchWorkspace = (workspace: Workspace) => {
    setActiveWorkspace(workspace);
    localStorage.setItem('reachflow_active_workspace', JSON.stringify(workspace));
  };

  const logout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST', token: accessToken });
    } catch {
      // Ignore network errors on logout
    }
    setUser(null);
    setWorkspaces([]);
    setActiveWorkspace(null);
    setAccessToken(null);
    localStorage.removeItem('reachflow_access_token');
    localStorage.removeItem('reachflow_active_workspace');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        workspaces,
        activeWorkspace,
        accessToken,
        loading,
        login,
        loginDemo,
        signup,
        switchWorkspace,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
