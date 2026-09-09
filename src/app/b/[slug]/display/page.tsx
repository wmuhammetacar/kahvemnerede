"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useSSE } from "@/lib/hooks/use-sse";
import { ConnectionDot } from "@/components/connection-dot";
import { PublicBranding } from "@/components/public-branding";

interface ReadyOrder {
  orderNumber: string;
}

export default function BranchDisplayPage() {
  const params = useParams();
  const slug = params.slug as string;
  return <BranchDisplay key={slug} slug={slug} />;
}

function BranchDisplay({ slug }: { slug: string }) {
  const [orders, setOrders] = useState<ReadyOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { connected } = useSSE({
    url: `/api/b/${encodeURIComponent(slug)}/display`,
    pollUrl: `/api/b/${encodeURIComponent(slug)}/orders?status=READY`,
    onMessage: data => {
      if (Array.isArray(data.orders)) {
        setOrders(data.orders.filter((o): o is { orderNumber: string } =>
          !!o && typeof o === "object" && typeof o.orderNumber === "string" && (!o.status || o.status === "READY")
        ).map(o => ({ orderNumber: o.orderNumber })));
        setLoaded(true);
      } else if (data.type === "READY_ADDED" && typeof data.orderNumber === "string") {
        const orderNumber = data.orderNumber;
        setOrders(prev => prev.some(o => o.orderNumber === orderNumber) ? prev : [...prev, { orderNumber }]);
      } else if (data.type === "READY_REMOVED") {
        setOrders(prev => prev.filter(o => o.orderNumber !== data.orderNumber));
      }
    },
  });

  return (
    <div className="min-h-dvh bg-stone-950 text-stone-100 flex flex-col items-center justify-center py-8 select-none">
      <div className="text-center mb-10 md:mb-16">
        <PublicBranding slug={slug} />
        <div className="flex justify-center gap-2 text-xs text-stone-400 mb-3"><ConnectionDot connected={connected} />{!connected && "Bağlantı bekleniyor; ekran güncel olmayabilir."}</div>
        <p className="text-sm md:text-base font-semibold uppercase tracking-widest text-emerald-500/70">
          HAZIR SİPARİŞLER
        </p>
      </div>

      {!loaded ? <p role="status" className="text-stone-400">Şube siparişleri yükleniyor. Bağlantı kurulamazsa şube bağlantısını kontrol edin.</p> : orders.length === 0 ? (
        <p className="text-stone-600 text-base md:text-lg text-center px-4">
          Şu anda teslim edilmeyi bekleyen sipariş yok.
        </p>
      ) : (
        <div
          className="grid gap-4 md:gap-6 px-4 md:px-8 w-full"
          style={{
            gridTemplateColumns: `repeat(auto-fit, minmax(180px, 1fr))`,
            maxWidth: "1400px",
          }}
        >
          {orders.map((order) => (
            <div
              key={order.orderNumber}
              className="flex items-center justify-center py-8 md:py-12 rounded-2xl border border-emerald-800/40 bg-emerald-950/30 animate-slide-up"
            >
              <span className="text-5xl md:text-7xl lg:text-8xl font-mono font-bold text-emerald-100">
                {order.orderNumber}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
