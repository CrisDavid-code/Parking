import { API_URL, env } from "@/config/env";
import type { ApiErrorBody, AuthResponse } from "@/types/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const RT_KEY = "app.refreshToken";
let accessToken: string | null = null;
const expiredListeners = new Set<() => void>();

export const tokenStore = {
  getAccess: () => accessToken,
  getRefresh: () => (typeof window === "undefined" ? null : localStorage.getItem(RT_KEY)),
  set(a: string, r: string) {
    accessToken = a;
    localStorage.setItem(RT_KEY, r);
  },
  clear() {
    accessToken = null;
    if (typeof window !== "undefined") localStorage.removeItem(RT_KEY);
  },
};
export function onSessionExpired(fn: () => void) {
  expiredListeners.add(fn);
  return () => expiredListeners.delete(fn);
}

type Query = Record<string, string | number | boolean | undefined | null>;
interface Opts {
  query?: Query | undefined;
  body?: unknown;
  form?: FormData | undefined;
  auth?: boolean | undefined;
}

// Single-flight: refresh tokens rotate on every use, so concurrent callers (app bootstrap,
// parallel 401s, React StrictMode double effects) must share one request or the API sees reuse.
let refreshing: Promise<AuthResponse | null> | null = null;
export function refreshSession(): Promise<AuthResponse | null> {
  const rt = tokenStore.getRefresh();
  if (!rt) return Promise.resolve(null);
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: rt }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as AuthResponse;
      tokenStore.set(data.accessToken, data.refreshToken);
      return data;
    } catch {
      return null;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}
const refresh = async () => (await refreshSession()) !== null;

function buildUrl(path: string, query?: Query) {
  const url = new URL(`${API_URL}${path}`);
  Object.entries(query ?? {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  });
  return url.toString();
}

async function request<T>(
  method: string,
  path: string,
  opts: Opts = {},
  retried = false,
): Promise<T> {
  if (env.demoMode) {
    const { demoRequest } = await import("./demo");
    return demoRequest<T>(method, path, opts.query, opts.body);
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) throw new ApiError(0, "Sin conexión");
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.auth !== false && accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method,
      headers,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : null),
    });
  } catch {
    throw new ApiError(0, "No se pudo conectar con el servidor");
  }
  if (res.status === 401 && opts.auth !== false && !retried) {
    if (await refresh()) return request<T>(method, path, opts, true);
    tokenStore.clear();
    expiredListeners.forEach((f) => f());
    throw new ApiError(401, "Sesión expirada");
  }
  if (!res.ok) {
    let body: ApiErrorBody | undefined;
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {
      /* sin cuerpo */
    }
    const msg = Array.isArray(body?.message)
      ? body.message.join(", ")
      : (body?.message ?? res.statusText);
    throw new ApiError(res.status, msg || `Error ${res.status}`, body);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export const api = {
  get: <T>(path: string, query?: Query, auth = true) => request<T>("GET", path, { query, auth }),
  post: <T>(path: string, body?: unknown, auth = true) =>
    request<T>("POST", path, { body: body ?? {}, auth }),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, { body }),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, { body }),
  delete: <T>(path: string, body?: unknown) => request<T>("DELETE", path, { body }),
  upload: <T>(path: string, form: FormData) => request<T>("POST", path, { form }),
};

export function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "Error inesperado";
}
