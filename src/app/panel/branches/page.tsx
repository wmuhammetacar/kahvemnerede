"use client";

import { useState, useEffect, useCallback } from "react";
import { vibrate } from "@/lib/vibrate";
import { StaffAccess } from "@/components/staff-access";
import { frontendRequest } from "@/lib/frontend-api";

interface Branch {
  id: string;
  name: string;
  slug: string;
  active: boolean;
}

export default function BranchesPage() {
  return <StaffAccess admin><Branches /></StaffAccess>;
}
function Branches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");

  const fetchBranches = useCallback(async () => {
    try {
      const data = await frontendRequest("/api/admin/branches");
      setBranches(data.branches);
      setError("");
    } catch {
      setError("Şubeler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setError("");

    try {
      const data = await frontendRequest("/api/admin/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), slug: newSlug.trim() }),
      });

      vibrate(10);
      setNewName("");
      setNewSlug("");
      setShowCreate(false);
      setBranches(prev => [...prev, data.branch]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bağlantı hatası");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (updating) return;
    setUpdating(true); setError("");
    try {
      const data = await frontendRequest(`/api/admin/branches/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), slug: editSlug.trim() }),
      });

      vibrate(10);
      setEditingId(null);
      setBranches(prev => prev.map(b => b.id === id ? data.branch : b));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bağlantı hatası");
    } finally { setUpdating(false); }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    if (updating) return;
    setUpdating(true); setError("");
    try {
      const data = await frontendRequest(`/api/admin/branches/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !currentActive }),
      });

      vibrate(10);
      setBranches(prev => prev.map(b => b.id === id ? data.branch : b));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bağlantı hatası");
    } finally { setUpdating(false); }
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-stone-950 flex items-center justify-center">
        <div className="text-stone-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-stone-950 text-stone-100 p-4 md:p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Şubeler</h1>
        <a href="/panel" className="text-sm text-stone-400">Panele dön</a>
        <button
          disabled={creating || updating}
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition-all"
        >
          + Yeni Şube
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-950/50 border border-red-800/50 rounded-xl text-red-300 text-sm">
          {error}
          <button
            onClick={() => setError("")}
            className="ml-2 text-red-400 hover:text-red-300"
          >
            ×
          </button>
        </div>
      )}

      <fieldset disabled={creating || updating} className="disabled:opacity-70">
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="mb-6 p-4 bg-stone-900/50 border border-stone-800 rounded-xl space-y-3"
        >
          <div>
            <label htmlFor="branch-create-name" className="text-xs text-stone-400 mb-1 block">
              Şube Adı
            </label>
            <input
              id="branch-create-name"
              required
              maxLength={100}
              type="text"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setNewSlug(
                  e.target.value
                    .toLowerCase()
                    .replace(/ğ/g, "g")
                    .replace(/ü/g, "u")
                    .replace(/ş/g, "s")
                    .replace(/ı/g, "i")
                    .replace(/ö/g, "o")
                    .replace(/ç/g, "c")
                    .replace(/[^a-z0-9\s-]/g, "")
                    .replace(/\s+/g, "-")
                    .replace(/-+/g, "-")
                );
              }}
              className="w-full px-3 py-2 bg-stone-800 border border-stone-700 rounded-lg text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="branch-create-slug" className="text-xs text-stone-400 mb-1 block">Slug</label>
            <input
              id="branch-create-slug"
              required
              maxLength={100}
              type="text"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              className="w-full px-3 py-2 bg-stone-800 border border-stone-700 rounded-lg text-stone-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating || !newName.trim() || !newSlug.trim()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-stone-700 disabled:text-stone-500 text-white rounded-lg text-sm font-semibold transition-all"
            >
              {creating ? "Oluşturuluyor..." : "Oluştur"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                setNewName("");
                setNewSlug("");
              }}
              className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-sm transition-all"
            >
              İptal
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {branches.map((branch) => (
          <div
            key={branch.id}
            className={`p-4 rounded-xl border transition-all ${
              branch.active
                ? "bg-stone-900/50 border-stone-800"
                : "bg-stone-900/20 border-stone-800/50 opacity-60"
            }`}
          >
            {editingId === branch.id ? (
              <div className="space-y-3">
                <input
                  aria-label="Şube adı"
                  maxLength={100}
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-800 border border-stone-700 rounded-lg text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                <input
                  aria-label="Şube slug"
                  maxLength={100}
                  type="text"
                  value={editSlug}
                  onChange={(e) => setEditSlug(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-800 border border-stone-700 rounded-lg text-stone-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdate(branch.id)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-all"
                  >
                    Kaydet
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-xs transition-all"
                  >
                    İptal
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{branch.name}</div>
                  <div className="text-xs text-stone-400 font-mono">
                    /{branch.slug}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingId(branch.id);
                      setEditName(branch.name);
                      setEditSlug(branch.slug);
                    }}
                    className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-xs transition-all"
                  >
                    Düzenle
                  </button>
                  <button
                    onClick={() => handleToggleActive(branch.id, branch.active)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      branch.active
                        ? "bg-red-950/50 hover:bg-red-900/50 text-red-300 border border-red-800/50"
                        : "bg-emerald-950/50 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-800/50"
                    }`}
                  >
                    {branch.active ? "Devre Dışı Bırak" : "Aktifleştir"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {branches.length === 0 && (
          <div className="text-center text-stone-600 py-8">
            Henüz şube eklenmemiş.
          </div>
        )}
      </div>
      </fieldset>
    </div>
  );
}
