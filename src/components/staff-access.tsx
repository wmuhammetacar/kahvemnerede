"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export function StaffAccess({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/me", { signal: controller.signal, credentials: "include" })
      .then(async (res) => {
        if (res.status === 401) { router.replace("/login"); return; }
        if (!res.ok) throw new Error();
        const { user } = await res.json();
        if (user.mustChangePassword) router.replace("/change-password");
        else if (admin && user.role !== "ADMIN") router.replace("/panel");
        else setAllowed(true);
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [admin, router]);
  if (!allowed) return <main className="min-h-dvh bg-stone-950 text-stone-300 p-8" role="status">{error ? <><p>Oturum doğrulanamadı.</p><button onClick={() => window.location.reload()}>Tekrar dene</button></> : "Oturum doğrulanıyor..."}</main>;
  return children;
}
