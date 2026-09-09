"use client";

import { useState, useEffect, type FormEvent } from "react";
import { StaffAccess } from "@/components/staff-access";
import { frontendRequest } from "@/lib/frontend-api";

interface Business {
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  trackingTitle: string | null;
  readyMessage: string | null;
}
interface SessionUser {
  role: string;
  branchId: string;
  branchSlug: string | null;
  branchName: string;
  business: Business;
}
const inputClass = "mt-2 w-full px-4 py-3 bg-stone-900 border border-stone-800 rounded-xl text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40";
const buttonClass = "px-5 py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl disabled:opacity-50";

export default function SettingsPage() {
  return <StaffAccess><Settings /></StaffAccess>;
}

function Settings() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [branchName, setBranchName] = useState("");
  const [origin, setOrigin] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setOrigin(window.location.origin);
    async function load() {
      try {
        const { user: session } = await frontendRequest("/api/auth/me", { signal: controller.signal });
        const result = session.role === "ADMIN" ? await frontendRequest("/api/admin/business", { signal: controller.signal }) : { business: session.business };
        if (controller.signal.aborted) return;
        setUser(session); setBranchName(session.branchName || ""); setBusiness(result.business);
      } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Ayarlar yüklenemedi."); }
    }
    void load();
    return () => controller.abort();
  }, []);

  async function save(event: FormEvent, target: "business" | "branch") {
    event.preventDefault();
    if (!business || !user || pending) return;
    setPending(true); setError(""); setMessage("");
    try {
      if (target === "business") {
        const result = await frontendRequest("/api/admin/business", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: business.name.trim(), primaryColor: business.primaryColor, trackingTitle: business.trackingTitle, readyMessage: business.readyMessage }) });
        setBusiness(result.business);
        setUser(prev => prev ? { ...prev, business: result.business } : prev);
      } else {
        const result = await frontendRequest(`/api/admin/branches/${user.branchId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: branchName.trim() }) });
        setBranchName(result.branch.name);
        setUser(prev => prev ? { ...prev, branchName: result.branch.name, branchSlug: result.branch.slug } : prev);
      }
      setMessage(target === "business" ? "İşletme ayarları kaydedildi." : "Şube adı kaydedildi.");
    } catch (err) { setError(err instanceof Error ? err.message : "Kaydedilemedi."); }
    finally { setPending(false); }
  }

  async function upload(file?: File) {
    if (!file || pending) return;
    setError(""); setMessage("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) { setError("En fazla 2 MB PNG, JPEG veya WebP seçin."); return; }
    setPending(true);
    try {
      const form = new FormData(); form.append("logo", file);
      const result = await frontendRequest("/api/admin/logo", { method: "POST", body: form });
      setBusiness(prev => prev ? { ...prev, logoUrl: result.logoUrl } : prev);
      setMessage("Logo yüklendi. Diğer değişikliklerinizi işletme ayarlarını kaydederek uygulayın.");
    } catch (err) { setError(err instanceof Error ? err.message : "Logo yüklenemedi."); }
    finally { setPending(false); }
  }

  async function removeLogo() {
    if (pending) return;
    setPending(true); setError(""); setMessage("");
    try {
      await frontendRequest("/api/admin/logo", { method: "DELETE" });
      setBusiness(prev => prev ? { ...prev, logoUrl: null } : prev);
      setMessage("Logo kaldırıldı.");
    } catch (err) { setError(err instanceof Error ? err.message : "Logo kaldırılamadı."); }
    finally { setPending(false); }
  }

  const trackUrl = origin && user?.branchSlug ? `${origin}/b/${encodeURIComponent(user.branchSlug)}/track` : "";
  const displayUrl = origin && user?.branchSlug ? `${origin}/b/${encodeURIComponent(user.branchSlug)}/display` : "";
  async function copy(url: string) {
    if (!url) return;
    setError(""); setMessage("");
    try { await navigator.clipboard.writeText(url); setMessage("Bağlantı kopyalandı."); }
    catch { setError("Kopyalanamadı. Aşağıdaki bağlantıyı seçerek kopyalayabilirsiniz."); }
  }

  return <div className="min-h-dvh bg-stone-950 text-stone-100">
    <header className="print:hidden border-b border-stone-800"><div className="max-w-3xl mx-auto p-4 flex justify-between"><h1 className="text-lg font-bold">Ayarlar</h1><a href="/panel" className="text-stone-400">Geri</a></div></header>
    <main className="print:hidden max-w-3xl mx-auto px-4 py-6 space-y-8">
      {error && <p role="alert" className="text-red-400">{error}</p>}
      {message && <p role="status" className="text-emerald-400">{message}</p>}
      {!user || !business ? <div role="status">{error ? <button onClick={() => window.location.reload()} className={buttonClass}>Tekrar dene</button> : "Ayarlar yükleniyor..."}</div> : <>
        <a href="/change-password" className="inline-block text-amber-400">Şifremi değiştir</a>
        {user.role === "ADMIN" ? <>
          <form onSubmit={e => save(e, "business")}><fieldset disabled={pending} className="space-y-4">
            <h2 className="font-semibold text-lg">İşletme ve marka</h2>
            <label className="block text-sm">İşletme adı<input required maxLength={100} value={business.name} onChange={e => setBusiness({ ...business, name: e.target.value })} className={inputClass} /></label>
            <label className="block text-sm">Takip ekranı başlığı<input maxLength={100} value={business.trackingTitle || ""} onChange={e => setBusiness({ ...business, trackingTitle: e.target.value })} className={inputClass} /></label>
            <label className="block text-sm">Sipariş hazır mesajı<textarea maxLength={200} value={business.readyMessage || ""} onChange={e => setBusiness({ ...business, readyMessage: e.target.value })} className={inputClass} /></label>
            <label className="block text-sm">Marka rengi<select value={business.primaryColor || ""} onChange={e => setBusiness({ ...business, primaryColor: e.target.value || null })} className={inputClass}><option value="">Varsayılan</option>{["ESPRESSO", "FOREST", "BURGUNDY", "NAVY", "AMBER", "STONE"].map(color => <option key={color}>{color}</option>)}</select></label>
            <label className="block text-sm">Logo (PNG, JPEG, WebP, en fazla 2 MB)<input type="file" accept="image/png,image/jpeg,image/webp" className={inputClass} onChange={e => { void upload(e.target.files?.[0]); e.target.value = ""; }} /></label>
            {business.logoUrl && <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={business.logoUrl} alt="İşletme logosu" width={80} height={80} className="object-contain" />
              <button type="button" onClick={removeLogo} className="text-sm text-stone-300">Logoyu kaldır</button>
            </div>}
            <button disabled={pending} className={buttonClass}>{pending ? "İşleniyor..." : "İşletme ayarlarını kaydet"}</button>
          </fieldset></form>
          <form onSubmit={e => save(e, "branch")}><fieldset disabled={pending} className="space-y-4"><h2 className="font-semibold text-lg">Şube</h2><label className="block text-sm">Şube adı<input required maxLength={100} value={branchName} onChange={e => setBranchName(e.target.value)} className={inputClass} /></label><button className={buttonClass}>Şube adını kaydet</button></fieldset></form>
          <a href="/panel/staff" className="inline-block text-amber-400">Personeli yönet</a>
        </> : <p className="text-stone-400">{user.business.name} / {user.branchName}. İşletme ayarlarını yalnızca yöneticiler değiştirebilir.</p>}
        <section className="border-t border-stone-800 pt-6 space-y-5"><h2 className="text-lg font-semibold">Şube QR kodu ve bağlantıları</h2>
          {!trackUrl ? <p role="alert" className="text-amber-300">Şube bağlantısı bulunamadı. QR kod oluşturmak için yöneticinize başvurun.</p> : <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(trackUrl)}`} alt={`${user.branchName} takip QR kodu`} width={240} height={240} className="p-3 bg-stone-100 rounded-xl" />
            {[{ title: "Müşteri takip", url: trackUrl }, { title: "Hazır sipariş ekranı", url: displayUrl }].map(link => <div key={link.title} className="space-y-2"><h3 className="font-medium">{link.title}</h3><p className="text-sm font-mono text-stone-400 break-all select-all">{link.url}</p><div className="flex gap-4"><button onClick={() => copy(link.url)} className="py-2 text-amber-400">Kopyala</button><a href={link.url} target="_blank" rel="noopener noreferrer" className="py-2 text-stone-300">Aç</a></div></div>)}
            <button onClick={() => window.print()} className={buttonClass}>QR kartını yazdır</button>
          </>}
        </section>
      </>}
    </main>
    {trackUrl && user && <section className="hidden print:flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center bg-stone-100 text-stone-900"><h1 className="text-3xl font-bold">{user.business.name}</h1><p className="text-lg">{user.branchName}</p><p>QR kodunu okutun ve sipariş numaranızı girin.</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(trackUrl)}`} alt="Şube takip QR kodu" width={300} height={300} />
      <p className="break-all text-sm">{trackUrl}</p>
    </section>}
  </div>;
}
