"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { apiFetch, apiPost } from "@/lib/api";
import type { User } from "@/types";

interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    role: string
  ) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // On mount: validate session via GET /auth/me (cookie-based, no localStorage token)
  useEffect(() => {
    apiFetch<User>("/auth/me")
      .then((me) => setUser(me))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiPost<AuthResponse>("/auth/login", { email, password });
    setUser(res.user);
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    role: string
  ) => {
    const res = await apiPost<AuthResponse>("/auth/register", {
      name,
      email,
      password,
      role,
    });
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await apiPost("/auth/logout", {});
    } catch {
      // ignore — cookie will be cleared by backend response
    }
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
