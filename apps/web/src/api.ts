import type { AuthenticatedUser } from "@attendance/contracts";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

interface ApiErrorBody { error?: { message?: string } }

export const api = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as ApiErrorBody;
    throw new Error(body.error?.message ?? `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
};

export const getCurrentUser = (): Promise<{ user: AuthenticatedUser }> => api("/auth/me");

export const download = async (path: string, filename: string): Promise<void> => {
  const response = await fetch(`${API_URL}${path}`, { credentials: "include" });
  if (!response.ok) throw new Error("Download failed");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click();
  URL.revokeObjectURL(url);
};
