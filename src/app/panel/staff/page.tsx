"use client";

import { useEffect, useState, type FormEvent } from "react";
import { StaffAccess } from "@/components/staff-access";
import { frontendRequest } from "@/lib/frontend-api";

interface Branch { id: string; name: string; active: boolean }
interface Staff { id: string; email: string; role: string; active: boolean; mustChangePassword: boolean; branch: { id: string; name: string } }
const inputClass = "w-full mt-2 p-3 rounded-xl bg-stone-900 border border-stone-800 text-stone-100";

export default function StaffPage() {
  return <StaffAccess admin><StaffManagement /></StaffAccess>;
}
function StaffManagement() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selfId, setSelfId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("CASHIER");
  const [branchId, setBranchId] = useState("");
  const [editing, setEditing] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([frontendRequest("/api/admin/staff", { signal: controller.signal }), frontendRequest("/api/admin/branches", { signal: controller.signal }), frontendRequest("/api/auth/me", { signal: controller.signal })]).then(([people, locations, me]) => {
      if (controller.signal.aborted) return;
      setStaff(people.staff); setBranches(locations.branches); setSelfId(me.user.id);
      setBranchId(locations.branches.find((b: Branch) => b.active)?.id || "");
    }).catch(err => { if (!controller.signal.aborted) setError(err.message || "Personel yüklenemedi."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true); setError(""); setMessage("");
    try {
      const { user } = await frontendRequest("/api/admin/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), password, role, branchId }) });
      setStaff(prev => [...prev, user]); setEmail(""); setPassword("");
      setMessage("Personel oluşturuldu. Geçici şifreyi güvenli şekilde paylaşın; ilk girişte değiştirilmesi gerekir.");
    } catch (err) { setError(err instanceof Error ? err.message : "Personel oluşturulamadı."); }
    finally { setPending(false); }
  }
  async function update(person: Staff, changes: { role?: string; branchId?: string; active?: boolean }) {
    if (pending) return;
    setPending(true); setError(""); setMessage("");
    try {
      const { user } = await frontendRequest(`/api/admin/staff/${person.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) });
      setStaff(prev => prev.map(p => p.id === user.id ? user : p)); setEditing(null); setMessage("Personel güncellendi.");
    } catch (err) { setError(err instanceof Error ? err.message : "Personel güncellenemedi."); }
    finally { setPending(false); }
  }
  return <main className="min-h-dvh bg-stone-950 text-stone-100 max-w-3xl mx-auto p-4 md:p-8 space-y-6">
    <header className="flex justify-between"><h1 className="text-2xl font-bold">Personel</h1><a href="/panel" className="text-stone-400">Geri</a></header>
    {error && <p role="alert" className="text-red-400">{error}</p>}{message && <p role="status" className="text-emerald-400">{message}</p>}
    {loading ? <p role="status">Personel yükleniyor...</p> : <>
      <form onSubmit={create}><fieldset disabled={pending} className="space-y-4 border-b border-stone-800 pb-6"><h2 className="font-semibold text-lg">Yeni personel</h2>
        <label className="block text-sm">E-posta<input required type="email" autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} /></label>
        <label className="block text-sm">Geçici şifre<input required minLength={8} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,}" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className={inputClass} /><span className="block mt-2 text-stone-400">En az 8 karakter, büyük harf, küçük harf ve rakam. Güvenli bir kanaldan paylaşın.</span></label>
        <label className="block text-sm">Yetki<select value={role} onChange={e => setRole(e.target.value)} className={inputClass}><option value="CASHIER">Kasiyer</option><option value="ADMIN">Yönetici</option></select></label>
        <label className="block text-sm">Şube<select required value={branchId} onChange={e => setBranchId(e.target.value)} className={inputClass}><option value="">Şube seçin</option>{branches.filter(b => b.active).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <button disabled={pending || !branchId} className="px-5 py-3 bg-amber-500 text-stone-950 font-bold rounded-xl disabled:opacity-50">{pending ? "İşleniyor..." : "Personel oluştur"}</button>
      </fieldset></form>
      <section aria-label="Personel listesi" className="divide-y divide-stone-800">{staff.map(person => <article key={person.id} className="py-5 space-y-3">
        <h2 className="font-semibold break-all">{person.email}{person.id === selfId && " (siz)"}</h2>
        <p className="text-sm text-stone-400">{person.branch.name} / {person.role === "ADMIN" ? "Yönetici" : "Kasiyer"} / {person.active ? "Aktif" : "Devre dışı"}</p>
        {person.mustChangePassword && <p className="text-xs text-amber-400">İlk girişte şifre değişikliği gerekli</p>}
        {editing?.id === person.id ? <form onSubmit={e => { e.preventDefault(); void update(person, { role: editing.role, branchId: editing.branch.id }); }}><fieldset disabled={pending} className="space-y-3">
          <label className="block text-sm">Yetki<select value={editing.role} onChange={e => setEditing({ ...editing, role: e.target.value })} className={inputClass}><option value="CASHIER">Kasiyer</option><option value="ADMIN">Yönetici</option></select></label>
          <label className="block text-sm">Şube<select value={editing.branch.id} onChange={e => setEditing({ ...editing, branch: { ...editing.branch, id: e.target.value } })} className={inputClass}>{branches.map(b => <option key={b.id} value={b.id} disabled={!b.active && b.id !== person.branch.id}>{b.name}{!b.active ? " (devre dışı)" : ""}</option>)}</select></label>
          <div className="flex gap-4"><button className="py-2 text-amber-400">Kaydet</button><button type="button" onClick={() => setEditing(null)} className="py-2 text-stone-400">İptal</button></div>
        </fieldset></form> : person.id !== selfId && <div className="flex gap-4"><button disabled={pending} onClick={() => setEditing(person)} className="py-2 text-amber-400 disabled:opacity-50">Düzenle</button><button disabled={pending} onClick={() => { if (person.active && !window.confirm(`${person.email} hesabı devre dışı bırakılsın mı?`)) return; void update(person, { active: !person.active }); }} className="py-2 text-stone-300 disabled:opacity-50">{person.active ? "Devre dışı bırak" : "Aktifleştir"}</button></div>}
      </article>)}</section>
    </>}
  </main>;
}
