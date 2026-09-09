"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/lib/hooks/use-toast";
import { useSSE } from "@/lib/hooks/use-sse";
import { vibrate } from "@/lib/vibrate";
import { Toast } from "@/components/toast";
import { ConnectionDot } from "@/components/connection-dot";
import { WAIT_THRESHOLDS, READY_UNDO_WINDOW_MS } from "@/lib/constants";
import { frontendRequest } from "@/lib/frontend-api";
import { StaffAccess } from "@/components/staff-access";

interface Order {
  id: string;
  orderNumber: string;
  status: "WAITING" | "READY";
  createdAt: string;
  readyAt?: string;
}

export default function PanelPage() {
  return <StaffAccess><Panel /></StaffAccess>;
}

function Panel() {
  const router = useRouter();
  const { toast, show: showToast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderNumber, setOrderNumber] = useState("");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [elapsed, setElapsed] = useState<Record<string, string>>({});
  const [waitLevels, setWaitLevels] = useState<
    Record<string, "normal" | "warning" | "urgent">
  >({});
  const [loading, setLoading] = useState(true);
  const [undoOrderId, setUndoOrderId] = useState<string | null>(null);
  const [undoCountdown, setUndoCountdown] = useState(0);
  const [branchSlug, setBranchSlug] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const refreshRef = useRef<AbortController | null>(null);
  const revision = useRef(0);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSubmitRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const meRes = await fetch("/api/auth/me", {
            signal: controller.signal,
            credentials: "include",
          });

        if (meRes.ok) {
          const meData = await meRes.json();
          setBranchSlug(meData.user?.branchSlug || null);
          setUserRole(meData.user?.role || null);
          setBusinessName(meData.user?.business?.name || null);
          setMustChangePassword(meData.user?.mustChangePassword || false);
          if (meData.user?.mustChangePassword) router.replace("/change-password");
        }
      } catch {
        if (!controller.signal.aborted) setError("Siparişler yüklenemedi. Tekrar deneyin.");
      }
    }
    load();
    inputRef.current?.focus();
    return () => controller.abort();
  }, [router]);

  const refreshOrders = useCallback(async () => {
    refreshRef.current?.abort();
    const controller = new AbortController();
    refreshRef.current = controller;
    const version = revision.current;
    try {
      const data = await frontendRequest("/api/orders", { signal: controller.signal });
      if (!controller.signal.aborted && version === revision.current) {
        setOrders(data.orders || []);
        setLoadError("");
      }
    } catch {
      if (!controller.signal.aborted) setLoadError("Siparişler yenilenemedi. Tekrar deneyin.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refreshOrders();
    return () => refreshRef.current?.abort();
  }, [refreshOrders]);

  const { connected } = useSSE({
    url: "/api/events/orders",
    onConnected: refreshOrders,
    onMessage: useCallback((data: Record<string, unknown>) => {
      if (data.type === "connected") return;
      revision.current++;
      if (Array.isArray(data.orders)) { setOrders(data.orders as Order[]); setLoadError(""); setLoading(false); return; }
      const type = data.type as string;
      const order = data.order as Order | undefined;
      if (type === "ORDER_CREATED" && order) {
        setOrders((prev) => {
          if (prev.some((o) => o.id === order.id)) return prev;
          vibrate(15);
          return [order, ...prev];
        });
      } else if (type === "ORDER_UPDATED" && order) {
        setOrders((prev) => [order, ...prev.filter((o) => o.id !== order.id)]);
      } else if (type === "ORDER_COMPLETED" && order) {
        vibrate([10, 50, 10]);
        setOrders((prev) => prev.filter((o) => o.id !== order.id));
      }
    }, []),
    pollUrl: "/api/orders",
    pollInterval: 5000,
  });

  const hasWaiting = orders.some((o) => o.status === "WAITING");
  useEffect(() => {
    if (!hasWaiting) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const times: Record<string, string> = {};
      const levels: Record<string, "normal" | "warning" | "urgent"> = {};
      for (const order of orders) {
        if (order.status === "WAITING") {
          const diff = Math.floor(
            (now - new Date(order.createdAt).getTime()) / 1000
          );
          const m = Math.floor(diff / 60);
          const s = diff % 60;
          times[order.id] = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
          const ms = now - new Date(order.createdAt).getTime();
          if (ms >= WAIT_THRESHOLDS.WARNING_MAX_MS) levels[order.id] = "urgent";
          else if (ms >= WAIT_THRESHOLDS.NORMAL_MAX_MS) levels[order.id] = "warning";
          else levels[order.id] = "normal";
        }
      }
      setElapsed(times);
      setWaitLevels(levels);
    }, 1000);
    return () => clearInterval(interval);
  }, [orders, hasWaiting]);

  useEffect(() => {
    if (!undoOrderId) return;
    setUndoCountdown(Math.ceil(READY_UNDO_WINDOW_MS / 1000));
    undoCountdownRef.current = setInterval(() => {
      setUndoCountdown((prev) => {
        if (prev <= 1) {
          if (undoCountdownRef.current) clearInterval(undoCountdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    undoTimerRef.current = setTimeout(() => {
      setUndoOrderId(null);
      setUndoCountdown(0);
      if (undoCountdownRef.current) clearInterval(undoCountdownRef.current);
    }, READY_UNDO_WINDOW_MS);
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      if (undoCountdownRef.current) clearInterval(undoCountdownRef.current);
    };
  }, [undoOrderId]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      const now = Date.now();
      if (now - lastSubmitRef.current < 500) return;
      lastSubmitRef.current = now;
      setError("");
      const trimmed = orderNumber.trim();
      if (!/^\d{1,10}$/.test(trimmed)) {
        vibrate(20);
        setError("1 ile 10 hane arasında bir sipariş numarası girin");
        inputRef.current?.focus();
        return;
      }
      setSubmitting(true);
      try {
        const data = await frontendRequest("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderNumber: trimmed }),
          credentials: "include",
        });
        revision.current++;
        vibrate([10, 30, 10]);
        setOrderNumber("");
        showToast(`Sipariş #${trimmed} eklendi`);
        if (data.order) {
          setOrders((prev) => {
            if (prev.some((o) => o.id === data.order.id)) return prev;
            return [
              {
                id: data.order.id,
                orderNumber: data.order.orderNumber,
                status: data.order.status,
                createdAt: data.order.createdAt,
              },
              ...prev,
            ];
          });
        }
        inputRef.current?.focus();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Bağlantı hatası");
        inputRef.current?.focus();
      } finally {
        setSubmitting(false);
      }
    },
    [orderNumber, submitting, showToast]
  );

  async function mutateOrder(id: string, action: "ready" | "undo-ready" | "complete") {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError("");
    revision.current++;
    try {
      const data = await frontendRequest(`/api/orders/${id}/${action}`, { method: "PATCH" });
      revision.current++;
      if (data.order) setOrders(prev => data.order.status === "COMPLETED"
        ? prev.filter(o => o.id !== id)
        : [data.order, ...prev.filter(o => o.id !== id)]);
      if (action === "ready") setUndoOrderId(id);
      else if (undoOrderId === id) setUndoOrderId(null);
      vibrate(10);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sipariş güncellenemedi.");
    } finally {
      pendingRef.current = false;
      setPending(false);
      void refreshOrders();
    }
  }
  const handleReady = (id: string) => mutateOrder(id, "ready");
  const handleUndoReady = (id: string) => mutateOrder(id, "undo-ready");
  const handleComplete = (id: string) => mutateOrder(id, "complete");

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
  }

  function waitLevelStyles(level: "normal" | "warning" | "urgent") {
    if (level === "urgent") return "border-amber-700/50 bg-amber-950/20";
    if (level === "warning") return "border-amber-800/30 bg-stone-900/60";
    return "border-stone-800/50 bg-stone-900/60";
  }

  function waitTimeColor(level: "normal" | "warning" | "urgent") {
    if (level === "urgent") return "text-amber-400";
    if (level === "warning") return "text-amber-500/70";
    return "text-stone-500";
  }

  const waitingOrders = orders
    .filter((o) => o.status === "WAITING")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const readyOrders = orders
    .filter((o) => o.status === "READY")
    .sort((a, b) => new Date(b.readyAt || b.createdAt).getTime() - new Date(a.readyAt || a.createdAt).getTime());

  return (
    <div className="min-h-dvh bg-stone-950 text-stone-100">
      <header className="sticky top-0 z-20 border-b border-stone-800/60 bg-stone-950/90 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto flex flex-wrap gap-2 items-center justify-between px-4 md:px-6 min-h-14 py-2">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold tracking-tight text-stone-200">{businessName || "KAHVEM NEREDE"}</h1>
            <ConnectionDot connected={connected} />
            {branchSlug && (
              <a
                href={`/b/${branchSlug}/display`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-1 text-xs text-stone-500 hover:text-stone-300 hover:bg-stone-800/60 rounded transition-colors font-mono"
              >
                /{branchSlug}
              </a>
            )}
          </div>
          <nav className="flex items-center gap-0.5" role="navigation" aria-label="Ana menü">
            <a href="/panel/history" className="px-3 py-1.5 text-sm text-stone-400 hover:text-stone-100 hover:bg-stone-800/60 rounded-lg transition-colors tap-target">Geçmiş</a>
            {userRole === "ADMIN" && (
              <>
                <a href="/panel/reports" className="px-3 py-1.5 text-sm text-stone-400 hover:text-stone-100 hover:bg-stone-800/60 rounded-lg transition-colors tap-target">Raporlar</a>
                <a href="/panel/branches" className="px-3 py-1.5 text-sm text-stone-400 hover:text-stone-100 hover:bg-stone-800/60 rounded-lg transition-colors tap-target">Şubeler</a>
                <a href="/panel/staff" className="px-3 py-1.5 text-sm text-stone-400 hover:text-stone-100 rounded-lg tap-target">Personel</a>
              </>
            )}
            <a href="/panel/settings" className="px-3 py-1.5 text-sm text-stone-400 hover:text-stone-100 hover:bg-stone-800/60 rounded-lg transition-colors tap-target">Ayarlar</a>
            <button onClick={handleLogout} className="px-3 py-1.5 text-sm text-stone-500 hover:text-stone-300 hover:bg-stone-800/60 rounded-lg transition-colors tap-target">Çıkış</button>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-6 py-6">
        {mustChangePassword && <p role="alert"><a href="/change-password">Devam etmek için şifrenizi değiştirin.</a></p>}
        <form onSubmit={handleSubmit} className="mb-8" aria-label="Sipariş ekleme formu">
          <label htmlFor="order-input" className="block text-xs font-semibold uppercase tracking-widest text-stone-500 mb-2">Sipariş Numarası</label>
          <div className="flex gap-3">
            <input ref={inputRef} id="order-input" type="text" inputMode="numeric" maxLength={10} pattern="[0-9]*" placeholder="184" value={orderNumber} onChange={(e) => { setOrderNumber(e.target.value.replace(/\D/g, "")); setError(""); }} className="flex-1 min-w-0 px-5 py-4 text-3xl font-mono font-bold bg-stone-900/80 border border-stone-800 rounded-xl text-stone-100 placeholder-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all" autoFocus autoComplete="off" disabled={submitting} aria-describedby={error ? "order-error" : undefined} aria-invalid={!!error} />
            <button type="submit" disabled={submitting || !orderNumber.trim()} className="px-8 py-4 text-lg font-bold bg-amber-500 hover:bg-amber-400 disabled:bg-stone-800 disabled:text-stone-600 text-stone-950 rounded-xl transition-all active:scale-[0.97] min-w-[120px] tap-target">
              {submitting ? <span className="inline-block w-5 h-5 border-2 border-stone-950/30 border-t-stone-950 rounded-full animate-spin" /> : "EKLE"}
            </button>
          </div>
          {error && <p id="order-error" className="mt-2 text-sm text-red-400/90 animate-shake" role="alert">{error}</p>}
        </form>

        {pending && <p role="status" className="text-sm text-stone-400 mb-3">Sipariş güncelleniyor...</p>}
        {loadError && <div role="alert" className="text-red-400 mb-4">{loadError} <button onClick={refreshOrders} className="underline">Yenile</button></div>}
        <fieldset disabled={pending} aria-label="Aktif siparişler" className="disabled:opacity-70">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (<div key={i} className="h-20 bg-stone-900/40 rounded-xl animate-pulse" />))}
            </div>
          ) : orders.length === 0 ? (
            <div className="py-20 text-center animate-fade-in">
              <div className="text-5xl mb-4 opacity-30">☕</div>
              <p className="text-stone-600 text-sm">Şu anda aktif sipariş yok</p>
              <p className="text-stone-700 text-xs mt-1">Yeni sipariş eklemek için yukarıyı kullanın</p>
            </div>
          ) : (
            <div className="space-y-6">
              {readyOrders.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold uppercase tracking-widest text-emerald-500/80">HAZIR</h2>
                    <span className="text-xs text-stone-600 tabular-nums bg-emerald-900/30 px-2 py-0.5 rounded-full">{readyOrders.length}</span>
                  </div>
                  <div className="space-y-2">
                    {readyOrders.map((order, index) => {
                      const isUndoTarget = undoOrderId === order.id;
                      return (
                        <div key={order.id} className="flex flex-wrap gap-3 items-center justify-between p-4 md:p-5 rounded-xl border bg-emerald-950/40 border-emerald-800/40 transition-all animate-slide-up" style={{ animationDelay: `${index * 40}ms` }}>
                          <div className="flex flex-wrap items-center gap-4 min-w-0">
                            <span className="text-xl md:text-2xl font-mono font-bold text-emerald-100 shrink-0">#{order.orderNumber}</span>
                            <span className="text-xs font-semibold uppercase tracking-wide text-emerald-400 shrink-0">Hazır</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {isUndoTarget && undoCountdown > 0 && (
                              <button onClick={() => handleUndoReady(order.id)} className="px-4 py-3 min-h-[48px] text-sm font-bold bg-stone-700 hover:bg-stone-600 active:bg-stone-800 text-stone-200 rounded-lg transition-colors active:scale-[0.97] tap-target" aria-label={`Sipariş ${order.orderNumber} geri al`}>
                                GERİ AL <span className="ml-1.5 text-xs text-stone-400 tabular-nums">{undoCountdown}s</span>
                              </button>
                            )}
                            <button onClick={() => handleComplete(order.id)} className="px-5 py-3 min-h-[48px] text-sm font-bold bg-stone-700 hover:bg-stone-600 active:bg-stone-800 text-stone-200 rounded-lg transition-colors active:scale-[0.97] tap-target" aria-label={`Sipariş ${order.orderNumber} teslim edildi`}>TESLİM EDİLDİ</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {waitingOrders.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-500">HAZIRLANIYOR</h2>
                    <span className="text-xs text-stone-600 tabular-nums bg-stone-900/60 px-2 py-0.5 rounded-full">{waitingOrders.length}</span>
                  </div>
                  <div className="space-y-2">
                    {waitingOrders.map((order, index) => {
                      const level = waitLevels[order.id] || "normal";
                      return (
                        <div key={order.id} className={`flex flex-wrap gap-3 items-center justify-between p-4 md:p-5 rounded-xl border transition-all animate-slide-up ${waitLevelStyles(level)}`} style={{ animationDelay: `${index * 40}ms` }}>
                          <div className="flex flex-wrap items-center gap-4 min-w-0">
                            <span className="text-xl md:text-2xl font-mono font-bold text-stone-100 shrink-0">#{order.orderNumber}</span>
                            <span className={`text-sm font-mono tabular-nums shrink-0 ${waitTimeColor(level)}`}>{elapsed[order.id] || "00:00"}</span>
                            <span className="text-xs font-semibold uppercase tracking-wide text-amber-400/80 shrink-0">Hazırlanıyor</span>
                          </div>
                          <div className="shrink-0 ml-4">
                            <button onClick={() => handleReady(order.id)} className="px-6 py-3 min-h-[48px] text-sm font-bold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg transition-colors active:scale-[0.97] tap-target" aria-label={`Sipariş ${order.orderNumber} hazır`}>HAZIR</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </fieldset>
      </main>

      {toast && <Toast message={toast.message} exiting={toast.exiting} />}
    </div>
  );
}
