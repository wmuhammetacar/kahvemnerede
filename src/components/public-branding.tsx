"use client";
import { useEffect, useState } from "react";

const colors: Record<string, string> = {
  ESPRESSO: "text-orange-200", FOREST: "text-emerald-300", BURGUNDY: "text-rose-300",
  NAVY: "text-blue-300", AMBER: "text-amber-300", STONE: "text-stone-200",
};

export function PublicBranding({ slug, ready = false }: { slug?: string; ready?: boolean }) {
  const [branding, setBranding] = useState<{ branch: { name: string }; business: { name: string; logoUrl: string | null; primaryColor: string | null; trackingTitle: string | null; readyMessage: string | null } } | null>(null);
  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();
    fetch(`/api/public/branding/${encodeURIComponent(slug)}`, { signal: controller.signal }).then(async res => {
      if (res.ok) setBranding(await res.json());
    }).catch(() => {});
    return () => controller.abort();
  }, [slug]);
  const business = branding?.business;
  return <div className="text-center mb-6 space-y-2">
    {business?.logoUrl && (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={business.logoUrl} alt={business.name} width={80} height={80} className="mx-auto max-h-20 object-contain" />
    )}
    <p className={`text-xl font-bold ${colors[business?.primaryColor || "STONE"] || colors.STONE}`}>{business?.name || "KAHVEM NEREDE"}</p>
    {branding && <p className="text-sm text-stone-400">{branding.branch.name}</p>}
    {(ready ? business?.readyMessage : business?.trackingTitle) && <p className="text-sm text-stone-300 max-w-sm mx-auto break-words">{ready ? business?.readyMessage : business?.trackingTitle}</p>}
  </div>;
}
