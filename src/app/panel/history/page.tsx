"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { StaffAccess } from "@/components/staff-access";
import { frontendRequest } from "@/lib/frontend-api";

interface CompletedOrder {
  id: string;
  orderNumber: string;
  createdAt: string;
  readyAt?: string;
  completedAt?: string;
}

interface BranchOption {
  id: string;
  name: string;
}

export default function HistoryPage() {
  return <StaffAccess><History /></StaffAccess>;
}
function History() {
  const [orders, setOrders] = useState<CompletedOrder[]>([]);
  const [date, setDate] = useState("");
  const dateInitRef = useRef(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [branchId, setBranchId] = useState("all");
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [error, setError] = useState("");

  const fetchHistory = useCallback(async (signal: AbortSignal) => {
    const params = new URLSearchParams();
    if (date) params.set("date", date);
    if (orderNumber) params.set("orderNumber", orderNumber);
    if (branchId !== "all") params.set("branchId", branchId);

    try {
      setLoading(true);
      setError("");
      setOrders([]);
      const data = await frontendRequest(`/api/history?${params}`, { signal });
      if (!signal.aborted) {
        setOrders(data.orders || []);
      }
    } catch {
      if (!signal.aborted) setError("Geçmiş yüklenemedi. Filtreleri değiştirin veya sayfayı yenileyin.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [date, orderNumber, branchId]);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.role) setUserRole(data.user.role);
      })
      .catch(() => {});

    fetch("/api/admin/branches", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.branches) {
          setBranches(data.branches);
          if (!dateInitRef.current) {
            const tz = data.branches[0]?.timezone || "Europe/Istanbul";
            const now = new Date();
            const localDate = new Intl.DateTimeFormat("sv-SE", { timeZone: tz }).format(now);
            setDate(localDate);
            dateInitRef.current = true;
          }
        }
      })
      .catch(() => {});

  }, []);

  useEffect(() => {
    if (!dateInitRef.current || !date) return;
    const controller = new AbortController();
    fetchHistory(controller.signal);
    return () => controller.abort();
  }, [fetchHistory, date]);

  function formatDuration(createdAt: string, completedAt?: string) {
    if (!completedAt) return "-";
    const diff = Math.floor(
      (new Date(completedAt).getTime() - new Date(createdAt).getTime()) / 1000
    );
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    if (m > 0) return `${m}dk ${s}s`;
    return `${s}s`;
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="min-h-dvh bg-stone-950 text-stone-100">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-stone-800/60 bg-stone-950/90 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-4 md:px-6 h-14">
          <h1 className="text-lg font-bold tracking-tight text-stone-200">
            Geçmiş Siparişler
          </h1>
          <a
            href="/panel"
            className="px-3 py-1.5 text-sm text-stone-400 hover:text-stone-100 hover:bg-stone-800/60 rounded-lg transition-colors tap-target"
          >
            Geri
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-6 py-6">
        {error && <p role="alert" className="text-red-400 mb-4">{error}</p>}
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex-1 min-w-[140px]">
            <label htmlFor="history-date" className="sr-only">
              Tarih
            </label>
            <input
              id="history-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-stone-900/80 border border-stone-800 rounded-xl text-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 transition-colors"
            />
          </div>
          <div className="w-32">
            <label htmlFor="history-search" className="sr-only">
              Sipariş ara
            </label>
            <input
              id="history-search"
              type="text"
              inputMode="numeric"
              placeholder="Sipariş No"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value.replace(/\D/g, ""))}
              className="w-full px-3 py-2.5 bg-stone-900/80 border border-stone-800 rounded-xl text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 transition-colors"
            />
          </div>
          {userRole === "ADMIN" && branches.length > 0 && (
            <div className="w-40">
              <label htmlFor="history-branch" className="sr-only">
                Şube
              </label>
              <select
                id="history-branch"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full px-3 py-2.5 bg-stone-900/80 border border-stone-800 rounded-xl text-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 transition-colors"
              >
                <option value="all">Tüm Şubeler</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Summary */}
        {orders.length > 0 && (
          <div className="flex items-center gap-4 mb-4 text-xs text-stone-600">
            <span>{orders.length} sipariş</span>
            <span>•</span>
            <span>
              Toplam süre:{" "}
              {(() => {
                const total = orders.reduce((acc, o) => {
                  if (!o.completedAt) return acc;
                  return (
                    acc +
                    (new Date(o.completedAt).getTime() -
                      new Date(o.createdAt).getTime())
                  );
                }, 0);
                const m = Math.floor(total / 60000);
                return `${Math.floor(m / 60)}sa ${m % 60}dk`;
              })()}
            </span>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 bg-stone-900/40 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="py-20 text-center animate-fade-in">
            <div className="text-5xl mb-4 opacity-30">📋</div>
            <p className="text-stone-600 text-sm">Bu tarihte sipariş bulunamadı</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-800 text-stone-500 text-xs uppercase tracking-wider">
                  <th className="text-left py-3 px-4 md:px-3 font-semibold">
                    Sipariş
                  </th>
                  <th className="text-left py-3 px-4 md:px-3 font-semibold">
                    Saat
                  </th>
                  <th className="text-left py-3 px-4 md:px-3 font-semibold hidden sm:table-cell">
                    Hazır
                  </th>
                  <th className="text-left py-3 px-4 md:px-3 font-semibold">
                    Teslim
                  </th>
                  <th className="text-right py-3 px-4 md:px-3 font-semibold">
                    Süre
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, index) => (
                  <tr
                    key={order.id}
                    className="border-b border-stone-800/30 hover:bg-stone-900/30 transition-colors animate-slide-up"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <td className="py-3 px-4 md:px-3 font-mono font-bold text-stone-200">
                      #{order.orderNumber}
                    </td>
                    <td className="py-3 px-4 md:px-3 text-stone-400">
                      {formatTime(order.createdAt)}
                    </td>
                    <td className="py-3 px-4 md:px-3 text-stone-400 hidden sm:table-cell">
                      {order.readyAt ? formatTime(order.readyAt) : "-"}
                    </td>
                    <td className="py-3 px-4 md:px-3 text-stone-400">
                      {order.completedAt ? formatTime(order.completedAt) : "-"}
                    </td>
                    <td className="py-3 px-4 md:px-3 text-stone-400 tabular-nums text-right">
                      {formatDuration(order.createdAt, order.completedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
