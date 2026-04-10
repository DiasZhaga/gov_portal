"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { authApi } from "./api";
import type { UserPublic } from "./types";

interface AuthState {
  user: UserPublic | null;
  token: string | null;
  loading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const me = await authApi.me();
      setUser(me);
    } catch {
      setUser(null);
      setToken(null);
      localStorage.removeItem("access_token");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("access_token");
    if (stored) {
      setToken(stored);
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [fetchUser]);

  const login = async (accessToken: string) => {
    localStorage.setItem("access_token", accessToken);
    setToken(accessToken);
    const me = await authApi.me();
    setUser(me);
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("mock_user_id");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
