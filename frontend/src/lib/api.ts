const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/**
 * API helper — uses httpOnly cookie for auth (set by backend on login).
 * credentials: "include" ensures cookies are sent with every request.
 * No JWT in localStorage — protects against XSS token theft.
 */
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };

  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  // Auto-redirect to login on 401 — but only from protected pages.
  // Skip redirect when already on /login or /register to prevent infinite loop
  // (AuthProvider calls /auth/me on every mount, which returns 401 when logged out).
  if (res.status === 401 && typeof window !== "undefined") {
    const path = window.location.pathname;
    if (!path.startsWith("/login") && !path.startsWith("/register")) {
      window.location.href = "/login";
    }
    throw new Error("Sesi berakhir, silakan login kembali.");
  }

  if (!res.ok) {
    const text = await res.text();
    let message = `API Error ${res.status}`;
    try {
      const error = JSON.parse(text);
      if (error?.detail) {
        // Handle string detail (most common: "Email atau password salah.")
        if (typeof error.detail === "string") {
          message = error.detail;
        }
        // Handle array detail (FastAPI validation errors: [{msg: "..."}])
        else if (Array.isArray(error.detail) && error.detail.length > 0) {
          const first = error.detail[0];
          message = first?.msg || first?.message || JSON.stringify(first);
        }
        // Handle object detail ({msg: "..."} or {message: "..."})
        else if (typeof error.detail === "object") {
          message = (error.detail as Record<string, string>).msg
            || (error.detail as Record<string, string>).message
            || JSON.stringify(error.detail);
        }
      }
    } catch {
      if (text) message = text;
    }
    throw new Error(String(message));
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function apiDelete(path: string): Promise<void> {
  return apiFetch<void>(path, { method: "DELETE" });
}
