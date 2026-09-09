"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { vibrate } from "@/lib/vibrate";
import { useSSE } from "@/lib/hooks/use-sse";
import { PublicBranding } from "@/components/public-branding";

interface TrackData {
  orderNumber: string;
  status: "WAITING" | "READY" | "COMPLETED";
  branchSlug?: string;
}

function playReadySound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
    osc.onended = () => { void ctx.close(); };
  } catch {
    // AudioContext not available
  }
}

function triggerVibration() {
  vibrate([50, 30, 50]);
}

function sendNotification(orderNumber: string) {
  if ("Notification" in window && Notification.permission === "granted") {
    try { new Notification("Siparişiniz hazır", {
      body: `Sipariş #${orderNumber} teslim noktasından alınabilir.`,
      icon: "/favicon.ico",
    }); } catch { /* Some mobile browsers require service-worker notifications. */ }
  }
}

export default function TrackingPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [data, setData] = useState<TrackData | null>(null);
  const [error, setError] = useState("");
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [branchHint, setBranchHint] = useState<string | undefined>();
  const requestRef = useRef<AbortController | null>(null);
  const prevStatusRef = useRef<string | null>(null);
  const hasInteractedRef = useRef(false);
  const audioActivatedRef = useRef(false);
  const branchSlug = data?.branchSlug || branchHint;
  const newOrderUrl = branchSlug ? `/b/${encodeURIComponent(branchSlug)}/track` : null;

  useEffect(() => {
    const hint = new URLSearchParams(window.location.search).get("branch");
    setBranchHint(hint || undefined);
    const syncPermission = () => setNotifyEnabled("Notification" in window && Notification.permission === "granted");
    syncPermission();
    window.addEventListener("focus", syncPermission);
    return () => window.removeEventListener("focus", syncPermission);
  }, []);

  const activateAudio = useCallback(() => {
    if (audioActivatedRef.current) return;
    audioActivatedRef.current = true;
    try {
      const ctx = new AudioContext();
      if (ctx.state === "suspended") ctx.resume();
      ctx.close();
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    function handleInteraction() {
      hasInteractedRef.current = true;
      activateAudio();
    }
    document.addEventListener("touchstart", handleInteraction, { once: true });
    document.addEventListener("click", handleInteraction, { once: true });
    return () => {
      document.removeEventListener("touchstart", handleInteraction);
      document.removeEventListener("click", handleInteraction);
    };
  }, [activateAudio]);

  const fetchStatus = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const res = await fetch(`/api/track/${token}`, { signal: controller.signal });
      if (!res.ok) {
        setError(res.status === 404 ? "Sipariş bulunamadı" : "Sipariş güncellenemedi. Tekrar deneyin.");
        return;
      }
      const result = await res.json();
      if (controller.signal.aborted) return;
      setData(result);
      setError("");
    } catch {
      if (!controller.signal.aborted) setError("Bağlantı hatası");
    }
  }, [token]);

  useEffect(() => {
    setData(null);
    setError("");
    prevStatusRef.current = null;
    void fetchStatus();
    return () => requestRef.current?.abort();
  }, [fetchStatus]);

  useSSE({
    url: `/api/events/track/${token}`,
    pollUrl: `/api/track/${token}`,
    onConnected: fetchStatus,
    onMessage: (snapshot) => {
      if (typeof snapshot.orderNumber !== "string" || !["WAITING", "READY", "COMPLETED"].includes(String(snapshot.status))) return;
      requestRef.current?.abort();
      setData(prev => ({ ...prev, ...snapshot }) as TrackData);
      setError("");
    },
  });

  useEffect(() => {
    if (!data) return;

    const prevStatus = prevStatusRef.current;
    const currentStatus = data.status;

    if (prevStatus !== null && prevStatus !== currentStatus) {
      if (currentStatus === "READY") {
        if (hasInteractedRef.current) {
          playReadySound();
        }
        triggerVibration();
        if (notifyEnabled) {
          sendNotification(data.orderNumber);
        }
      }
    }

    prevStatusRef.current = currentStatus;
  }, [data, notifyEnabled]);

  if (error) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-stone-950 px-4">
        <div className="text-center space-y-6">
          <div className="text-5xl">😔</div>
          <p className="text-stone-300 text-lg">{error}</p>
          <button
            onClick={fetchStatus}
            className="px-8 py-4 text-base font-bold bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-2xl transition-colors active:scale-[0.97]"
          >
            Yeniden Dene
          </button>
          {newOrderUrl && <a href={newOrderUrl} className="block text-stone-400">Şubede başka sipariş takip et</a>}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-stone-950">
        <div className="w-8 h-8 border-2 border-stone-700 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (data.status === "COMPLETED") {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-stone-950 px-4">
        <div className="text-center space-y-6">
          <div className="text-5xl">✅</div>
          <p className="text-stone-300 text-lg">Siparişiniz teslim edildi.</p>
          {newOrderUrl ? (
          <button
            onClick={() => router.push(newOrderUrl)}
            className="px-8 py-4 text-base font-bold bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-2xl transition-colors active:scale-[0.97]"
          >
            Yeni Sipariş Takip Et
          </button>
          ) : <p className="text-stone-400">Yeni sipariş için şubenizin QR kodunu okutun.</p>}
        </div>
      </div>
    );
  }

  if (data.status === "WAITING") {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-stone-950 px-4">
        <div className="text-center">
          <PublicBranding key={branchSlug} slug={branchSlug} />
          <div className="text-7xl mb-8">☕</div>
          <p className="text-sm font-semibold uppercase tracking-widest text-stone-500 mb-3">
            Siparişiniz
          </p>
          <p className="text-6xl md:text-7xl font-mono font-bold text-stone-100 mb-3">
            #{data.orderNumber}
          </p>
          <p className="text-2xl font-bold text-amber-400/90 mb-10">
            HAZIRLANIYOR
          </p>
          <div className="inline-flex items-center gap-2 text-sm text-stone-600 mb-8">
            <span className="w-2 h-2 bg-amber-500/60 rounded-full animate-pulse" />
            Hazır olduğunda bu ekran güncellenecek
          </div>

          <div className="mt-4">
            {notifyEnabled ? (
              <p className="text-xs text-emerald-500/70">
                ✓ Bildirim açık
              </p>
            ) : (
              <button
                onClick={async () => {
                  activateAudio();
                  if (!("Notification" in window)) { setNotificationMessage("Bu tarayıcı bildirimleri desteklemiyor. Takip ekranını açık tutun."); return; }
                  try {
                    const permission = await Notification.requestPermission();
                    setNotifyEnabled(permission === "granted");
                    setNotificationMessage(permission === "granted" ? "" : "Bildirim izni verilmedi. Takip ekranını açık tutun.");
                  } catch { setNotificationMessage("Bildirim açılamadı. Takip ekranını açık tutun."); }
                }}
                className="text-xs text-stone-600 hover:text-stone-400 transition-colors underline underline-offset-2"
              >
                Hazır olduğunda bana bildir
              </button>
            )}
            {notificationMessage && <p role="status" className="text-xs text-stone-400 mt-3 max-w-xs">{notificationMessage}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-emerald-950/50 px-4">
      <div className="text-center">
        <PublicBranding key={branchSlug} slug={branchSlug} ready />
        <div className="w-24 h-24 mx-auto mb-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <svg
            className="w-12 h-12 text-emerald-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400/60 mb-3">
          Siparişiniz
        </p>
        <p className="text-7xl md:text-8xl font-mono font-bold text-emerald-100 mb-3">
          #{data.orderNumber}
        </p>
        <p className="text-3xl font-bold text-emerald-400 mb-8">
          SİPARİŞİNİZ HAZIR
        </p>
        <p className="text-emerald-300/70 text-base">
          Siparişinizi teslim noktasından alabilirsiniz.
        </p>
      </div>
    </div>
  );
}
