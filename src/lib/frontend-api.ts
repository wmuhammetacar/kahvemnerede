export function apiError(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const error = (data as { error?: unknown }).error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const details = error as { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
    const messages = [...(details.formErrors || []), ...Object.values(details.fieldErrors || {}).flat()];
    if (messages.length) return messages.join(". ");
  }
  return fallback;
}

export async function frontendRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, { credentials: "include", ...init });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && !url.startsWith("/api/auth/")) {
      const me = await fetch("/api/auth/me", { credentials: "include" });
      const session = me.ok ? await me.json() : null;
      window.location.assign(session?.user?.mustChangePassword ? "/change-password" : "/login");
    }
    throw new Error(apiError(data, "İşlem tamamlanamadı. Tekrar deneyin."));
  }
  return data;
}
