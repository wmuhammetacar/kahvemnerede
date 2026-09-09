"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function BranchLinkNeeded({ destination }: { destination: "track" | "display" }) {
  const router = useRouter();
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/me", { signal: controller.signal }).then(async res => {
      if (!res.ok) return;
      const { user } = await res.json();
      if (user?.mustChangePassword) router.replace("/change-password");
      else if (user?.branchSlug) router.replace(`/b/${encodeURIComponent(user.branchSlug)}/${destination}`);
    }).catch(() => {});
    return () => controller.abort();
  }, [destination, router]);
  return <main className="min-h-dvh bg-stone-950 text-stone-100 flex items-center justify-center px-6"><div className="max-w-sm text-center space-y-4">
    <h1 className="text-2xl font-bold">Şube bağlantısı gerekli</h1>
    <p className="text-stone-400">Siparişler doğru şubeden takip edilir. Lütfen bulunduğunuz şubenin QR kodunu okutun veya personelden şube bağlantısını isteyin.</p>
    <a href="/login" className="inline-block py-3 text-amber-400">Personel girişi</a>
  </div></main>;
}
