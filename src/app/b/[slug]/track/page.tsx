"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { vibrate } from "@/lib/vibrate";
import { PublicBranding } from "@/components/public-branding";
import { apiError } from "@/lib/frontend-api";

export default function BranchTrackPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  const [orderNumber, setOrderNumber] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (loading) return;
      setError("");

      const trimmed = orderNumber.trim();
      if (!/^\d{1,10}$/.test(trimmed)) {
        vibrate(20);
        setError("Sipariş numarası girin");
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(`/api/b/${encodeURIComponent(slug)}/track`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderNumber: trimmed }),
        });

        if (!res.ok) {
          vibrate(20);
          setError(apiError(await res.json(), "Sipariş bulunamadı"));
          inputRef.current?.focus();
          inputRef.current?.select();
          setLoading(false);
          return;
        }

        vibrate(10);
        const data = await res.json();
        setError("");
        router.push(`/t/${data.trackingToken}?branch=${encodeURIComponent(slug)}`);
      } catch {
        setError("Bağlantı hatası");
        setLoading(false);
      }
    },
    [orderNumber, router, slug, loading]
  );

  return (
    <div className="min-h-dvh flex items-center justify-center bg-stone-950 px-4 animate-fade-in">
      <div className="w-full max-w-xs text-center">
        <div className="mb-10">
          <PublicBranding key={slug} slug={slug} />
          <p className="text-stone-500 text-sm">
            Sipariş numaranızı girin
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="track-input" className="sr-only">
              Sipariş numarası
            </label>
            <input
              ref={inputRef}
              id="track-input"
              type="text"
              inputMode="numeric"
              maxLength={10}
              pattern="[0-9]*"
              placeholder="Sipariş No"
              value={orderNumber}
              onChange={(e) => {
                setOrderNumber(e.target.value.replace(/\D/g, ""));
                setError("");
              }}
              className="w-full px-5 py-5 text-3xl font-mono font-bold text-center bg-stone-900/80 border border-stone-800 rounded-2xl text-stone-100 placeholder-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
              autoFocus
              autoComplete="off"
              disabled={loading}
              aria-describedby={error ? "track-error" : undefined}
              aria-invalid={!!error}
            />
          </div>

          {error && (
            <p id="track-error" className="text-sm text-red-400/90 animate-shake" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !orderNumber.trim()}
            className="w-full py-5 text-lg font-bold bg-amber-500 hover:bg-amber-400 disabled:bg-stone-800 disabled:text-stone-600 text-stone-950 rounded-2xl transition-all active:scale-[0.97] tap-target"
          >
            {loading ? (
              <span className="inline-block w-6 h-6 border-2 border-stone-950/30 border-t-stone-950 rounded-full animate-spin" />
            ) : (
              "TAKİP ET"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
