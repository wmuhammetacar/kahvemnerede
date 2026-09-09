"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { frontendRequest } from "@/lib/frontend-api";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [required, setRequired] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/me", { signal: controller.signal }).then(async (res) => {
      if (res.status === 401) { router.replace("/login"); return; }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRequired(!!data.user.mustChangePassword);
      setLoaded(true);
    }).catch(() => { if (!controller.signal.aborted) setError("Oturum yüklenemedi. Sayfayı yenileyin."); });
    return () => controller.abort();
  }, [router]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError("");
    if (newPassword !== confirm) { setError("Yeni şifreler eşleşmiyor."); return; }
    if (newPassword === currentPassword) { setError("Yeni şifreniz mevcut şifrenizden farklı olmalı."); return; }
    setPending(true);
    try {
      await frontendRequest("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) });
      setCurrentPassword(""); setNewPassword(""); setConfirm("");
      router.replace("/panel"); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Şifre değiştirilemedi."); }
    finally { setPending(false); }
  }
  return <main className="min-h-dvh bg-stone-950 text-stone-100 flex items-center justify-center p-4"><div className="w-full max-w-sm space-y-6">
    <h1 className="text-2xl font-bold">Şifre değiştir</h1>
    <p className="text-sm text-stone-400">{required ? "Devam etmek için geçici şifrenizi değiştirin." : "Hesabınız için yeni bir şifre belirleyin."} En az 8 karakter, büyük harf, küçük harf ve rakam kullanın.</p>
    <form onSubmit={submit} className="space-y-4">
      <fieldset disabled={pending || !loaded} className="space-y-4">
        <label className="block text-sm">Mevcut şifre<input required type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="mt-2 w-full p-3 bg-stone-900 border border-stone-800 rounded-xl" /></label>
        <label className="block text-sm">Yeni şifre<input required minLength={8} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,}" type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="mt-2 w-full p-3 bg-stone-900 border border-stone-800 rounded-xl" /></label>
        <label className="block text-sm">Yeni şifre tekrar<input required type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} className="mt-2 w-full p-3 bg-stone-900 border border-stone-800 rounded-xl" /></label>
        <button className="w-full p-3 rounded-xl bg-amber-500 text-stone-950 font-bold disabled:opacity-50">{pending ? "Kaydediliyor..." : "Şifreyi değiştir"}</button>
      </fieldset>
      {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
    </form>
    {loaded && !required && <a href="/panel/settings" className="text-stone-400 text-sm">Ayarlara dön</a>}
  </div></main>;
}
