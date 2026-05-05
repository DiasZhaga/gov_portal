"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { authApi, isFrontendConfigError } from "./api";
import type { UserPublic } from "./types";

interface AuthState {
  user: UserPublic | null;
  accessToken: string | null;
  refreshToken: string | null;
  loading: boolean;
  login: (tokens: {
    access_token: string;
    refresh_token: string;
  }) => Promise<UserPublic>;
  refreshUser: () => Promise<UserPublic | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const me = await authApi.me();
      setUser(me);
    } catch (error) {
      if (isFrontendConfigError(error)) {
        setUser(null);
        setLoading(false);
        return;
      }
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedAccessToken = localStorage.getItem("access_token");
    const storedRefreshToken = localStorage.getItem("refresh_token");
    if (storedAccessToken) {
      setAccessToken(storedAccessToken);
      setRefreshToken(storedRefreshToken);
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [fetchUser]);

  const login = async (tokens: {
    access_token: string;
    refresh_token: string;
  }) => {
    localStorage.setItem("access_token", tokens.access_token);
    localStorage.setItem("refresh_token", tokens.refresh_token);
    setAccessToken(tokens.access_token);
    setRefreshToken(tokens.refresh_token);
    const me = await authApi.me();
    setUser(me);
    return me;
  };

  const refreshUser = async () => {
    const me = await authApi.me();
    setUser(me);
    return me;
  };

  const logout = () => {
    const currentRefreshToken = localStorage.getItem("refresh_token");
    if (currentRefreshToken) {
      void authApi.logout().catch(() => undefined);
    }
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("mock_user_id");
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        refreshToken,
        loading,
        login,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
