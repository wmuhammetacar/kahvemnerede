"use client";

export function ConnectionDot({ connected }: { connected: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full transition-colors duration-500 ${
        connected ? "bg-emerald-400" : "bg-stone-600 animate-pulse-dot"
      }`}
      title={connected ? "Bağlı" : "Bağlantı kuruluyor..."}
      aria-label={connected ? "Bağlı" : "Bağlantı kuruluyor..."}
    />
  );
}
