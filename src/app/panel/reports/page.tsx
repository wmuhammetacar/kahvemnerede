"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatDuration } from "@/lib/reports";
import { StaffAccess } from "@/components/staff-access";
import { frontendRequest } from "@/lib/frontend-api";

interface Summary {
  total: number;
  completed: number;
  active: number;
  ready: number;
  avgPreparationMs: number | null;
  avgPickupMs: number | null;
  avgTotalMs: number | null;
  longWaitCount: number;
}

interface HourlyPoint {
  hour: number;
  count: number;
}

interface DailyPoint {
  date: string;
  count: number;
}

interface BranchRow {
  branchId: string;
  branchName: string;
  branchSlug: string;
  total: number;
  completed: number;
  active: number;
  ready: number;
  avgPreparationMs: number | null;
}

interface BranchOption {
  id: string;
  name: string;
}

interface ReportData {
  summary: Summary;
  hourly: HourlyPoint[];
  daily: DailyPoint[];
  branches: BranchRow[] | null;
  timezone: string;
  range: string;
  start: string;
  end: string;
}

const RANGE_OPTIONS = [
  { value: "today", label: "Bugün" },
  { value: "7d", label: "Son 7 gün" },
  { value: "30d", label: "Son 30 gün" },
];

export default function ReportsPage() {
  return <StaffAccess admin><Reports /></StaffAccess>;
}
function Reports() {
  const router = useRouter();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState("today");
  const [branchId, setBranchId] = useState("all");
  const [branches, setBranches] = useState<BranchOption[]>([]);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => {
        if (res.status === 401) {
          router.push("/login");
          return null;
        }
        return res.json();
      })
      .then((meData) => {
        if (meData?.user?.role !== "ADMIN") {
          router.push("/panel");
          return;
        }
      })
      .catch(() => {});
  }, [router]);

  const fetchBranches = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/branches", { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setBranches(d.branches || []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const fetchReport = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError("");
    setData(null);
    try {
      const params = new URLSearchParams({ range, branchId });
      const d = await frontendRequest(`/api/reports/summary?${params}`, { signal });
      if (!signal.aborted) setData(d);
    } catch {
      if (!signal.aborted) setError("Rapor yüklenemedi");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [range, branchId]);

  useEffect(() => {
    const controller = new AbortController();
    fetchReport(controller.signal);
    return () => controller.abort();
  }, [fetchReport]);

  const handleExportCsv = useCallback(() => {
    const params = new URLSearchParams({ range, branchId });
    window.open(`/api/reports/export?${params}`, "_blank");
  }, [range, branchId]);

  const maxHourly = data ? Math.max(...data.hourly.map((h) => h.count), 1) : 1;
  const maxDaily = data
    ? Math.max(...data.daily.map((d) => d.count), 1)
    : 1;

  return (
    <div className="min-h-dvh bg-stone-950 text-stone-100">
      <header className="sticky top-0 z-20 border-b border-stone-800/60 bg-stone-950/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 md:px-6 h-14">
          <h1 className="text-lg font-bold tracking-tight text-stone-200">
            Raporlar
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              disabled={loading || !data}
              className="px-3 py-1.5 text-sm font-medium bg-stone-800 hover:bg-stone-700 disabled:bg-stone-800 disabled:text-stone-600 text-stone-300 rounded-lg transition-colors tap-target"
            >
              CSV İndir
            </button>
            <a
              href="/panel"
              className="px-3 py-1.5 text-sm text-stone-400 hover:text-stone-100 hover:bg-stone-800/60 rounded-lg transition-colors tap-target"
            >
              Geri
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 bg-stone-900/60 rounded-lg p-1">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRange(opt.value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  range === opt.value
                    ? "bg-stone-700 text-stone-100"
                    : "text-stone-400 hover:text-stone-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="px-3 py-1.5 text-sm bg-stone-900/80 border border-stone-800 rounded-lg text-stone-200 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
          >
            <option value="all">Tüm Şubeler</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="p-3 bg-red-950/50 border border-red-800/50 rounded-xl text-red-300 text-sm">
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-24 bg-stone-900/40 rounded-xl animate-pulse"
              />
            ))}
          </div>
        )}

        {data && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <SummaryCard
                label="Bugünkü Sipariş"
                value={String(data.summary.total)}
              />
              <SummaryCard
                label="Ortalama Hazırlama"
                value={
                  data.summary.avgPreparationMs != null
                    ? formatDuration(data.summary.avgPreparationMs)
                    : "-"
                }
              />
              <SummaryCard
                label="Ortalama Teslim"
                value={
                  data.summary.avgPickupMs != null
                    ? formatDuration(data.summary.avgPickupMs)
                    : "-"
                }
              />
              <SummaryCard
                label="Aktif"
                value={String(data.summary.active)}
                accent={data.summary.active > 0}
              />
              <SummaryCard
                label="Hazır"
                value={String(data.summary.ready)}
                accent={data.summary.ready > 0}
              />
              <SummaryCard
                label="Tamamlanan"
                value={String(data.summary.completed)}
              />
            </div>

            {/* Extra metrics row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-4 bg-stone-900/40 rounded-xl border border-stone-800/50">
                <p className="text-xs text-stone-500 uppercase tracking-wider mb-1">
                  Ortalama Toplam Süre
                </p>
                <p className="text-xl font-mono font-bold text-stone-100">
                  {data.summary.avgTotalMs != null
                    ? formatDuration(data.summary.avgTotalMs)
                    : "-"}
                </p>
              </div>
              <div className="p-4 bg-stone-900/40 rounded-xl border border-stone-800/50">
                <p className="text-xs text-stone-500 uppercase tracking-wider mb-1">
                  10 dk+ Hazırlanan
                </p>
                <p className="text-xl font-mono font-bold text-stone-100">
                  {data.summary.longWaitCount}
                </p>
              </div>
              <div className="p-4 bg-stone-900/40 rounded-xl border border-stone-800/50">
                <p className="text-xs text-stone-500 uppercase tracking-wider mb-1">
                  Hazır Bekleyen
                </p>
                <p className="text-xl font-mono font-bold text-stone-100">
                  {data.summary.ready}
                </p>
              </div>
            </div>

            {/* Hourly Chart */}
            <section className="p-5 bg-stone-900/40 rounded-xl border border-stone-800/50">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-500 mb-4">
                Saatlik Yoğunluk
              </h2>
              <div className="flex items-end gap-1 h-40">
                {data.hourly.map((h) => (
                  <div
                    key={h.hour}
                    className="flex-1 flex flex-col items-center justify-end h-full"
                  >
                    <div
                      className="w-full bg-amber-500/60 rounded-t-sm transition-all min-h-[1px]"
                      style={{
                        height: `${(h.count / maxHourly) * 100}%`,
                      }}
                      title={`${String(h.hour).padStart(2, "0")}:00 - ${h.count} sipariş`}
                    />
                    {h.hour % 3 === 0 && (
                      <span className="text-[10px] text-stone-600 mt-1">
                        {String(h.hour).padStart(2, "0")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Daily Trend */}
            {data.daily.length > 0 && (
              <section className="p-5 bg-stone-900/40 rounded-xl border border-stone-800/50">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-500 mb-4">
                  Günlük Trend
                </h2>
                <div className="flex items-end gap-1 h-32">
                  {data.daily.map((d) => {
                    const label = d.date.slice(5);
                    return (
                      <div
                        key={d.date}
                        className="flex-1 flex flex-col items-center justify-end h-full"
                      >
                        <div
                          className="w-full bg-emerald-500/60 rounded-t-sm transition-all min-h-[1px]"
                          style={{
                            height: `${(d.count / maxDaily) * 100}%`,
                          }}
                          title={`${d.date} - ${d.count} sipariş`}
                        />
                        <span className="text-[10px] text-stone-600 mt-1 truncate max-w-full">
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Branch Comparison */}
            {data.branches && data.branches.length > 0 && (
              <section className="p-5 bg-stone-900/40 rounded-xl border border-stone-800/50">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-500 mb-4">
                  Şube Karşılaştırma
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-800/50">
                        <th className="text-left py-2 px-3 text-stone-500 font-medium">
                          Şube
                        </th>
                        <th className="text-right py-2 px-3 text-stone-500 font-medium">
                          Toplam
                        </th>
                        <th className="text-right py-2 px-3 text-stone-500 font-medium">
                          Tamamlanan
                        </th>
                        <th className="text-right py-2 px-3 text-stone-500 font-medium">
                          Aktif
                        </th>
                        <th className="text-right py-2 px-3 text-stone-500 font-medium">
                          Hazır
                        </th>
                        <th className="text-right py-2 px-3 text-stone-500 font-medium">
                          Ort. Hazırlama
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.branches.map((b) => (
                        <tr
                          key={b.branchId}
                          className="border-b border-stone-800/30 last:border-0"
                        >
                          <td className="py-3 px-3 font-medium text-stone-200">
                            {b.branchName}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-stone-300">
                            {b.total}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-stone-300">
                            {b.completed}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-stone-300">
                            {b.active}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-stone-300">
                            {b.ready}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-stone-300">
                            {b.avgPreparationMs != null
                              ? formatDuration(b.avgPreparationMs)
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {data.summary.total === 0 && (
              <div className="text-center py-12 text-stone-600">
                <p className="text-lg mb-1">Bu dönem için veri bulunamadı.</p>
                <p className="text-sm">Farklı bir tarih aralığı veya şube deneyin.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`p-4 rounded-xl border transition-all ${
        accent
          ? "bg-amber-950/20 border-amber-800/30"
          : "bg-stone-900/40 border-stone-800/50"
      }`}
    >
      <p className="text-xs text-stone-500 uppercase tracking-wider mb-1 truncate">
        {label}
      </p>
      <p className="text-2xl font-mono font-bold text-stone-100">{value}</p>
    </div>
  );
}
