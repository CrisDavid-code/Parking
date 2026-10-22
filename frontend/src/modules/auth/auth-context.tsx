import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, onSessionExpired, refreshSession, tokenStore } from "@/lib/api/client";
import { env } from "@/config/env";
import type { AuthResponse, Role, User } from "@/types/api";

type Status = "loading" | "authenticated" | "anonymous" | "expired";
interface AuthCtx {
  status: Status;
  user: User | null;
  login: (email: string, password: string) => Promise<User>;
  register: (d: {
    email: string;
    password: string;
    fullName: string;
    accountType: "personal" | "business";
  }) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
  hasRole: (...roles: Role[]) => boolean;
}
const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<User | null>(null);

  const accept = useCallback((r: AuthResponse) => {
    tokenStore.set(r.accessToken, r.refreshToken);
    setUser(r.user);
    setStatus("authenticated");
    return r.user;
  }, []);

  useEffect(() => {
    const off = onSessionExpired(() => {
      setUser(null);
      setStatus("expired");
      qc.clear();
    });
    if (env.demoMode) {
      if (tokenStore.getRefresh())
        api
          .post<AuthResponse>("/auth/refresh", {}, false)
          .then(accept)
          .catch(() => setStatus("anonymous"));
      else setStatus("anonymous");
    } else
      refreshSession().then((r) => {
        if (r) accept(r);
        else {
          tokenStore.clear();
          setStatus("anonymous");
        }
      });
    return () => {
      off();
    };
  }, [accept, qc]);

  const value = useMemo<AuthCtx>(
    () => ({
      status,
      user,
      setUser,
      login: async (email, password) =>
        accept(await api.post<AuthResponse>("/auth/login", { email, password }, false)),
      register: async (d) => accept(await api.post<AuthResponse>("/auth/register", d, false)),
      logout: async () => {
        const rt = tokenStore.getRefresh();
        try {
          if (rt) await api.post("/auth/logout", { refreshToken: rt });
        } catch {
          /* cerrar localmente igual */
        }
        tokenStore.clear();
        qc.clear();
        setUser(null);
        setStatus("anonymous");
      },
      hasRole: (...roles) => !!user && roles.some((r) => user.roles.includes(r)),
    }),
    [status, user, accept, qc],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("AuthProvider missing");
  return c;
}
