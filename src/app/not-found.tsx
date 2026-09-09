"use client";

import { useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-dvh flex items-center justify-center bg-stone-950 px-4">
      <div className="text-center space-y-6">
        <p className="text-6xl font-bold text-stone-800">404</p>
        <div>
          <p className="text-stone-300 text-lg font-medium">Sayfa bulunamadı</p>
          <p className="text-stone-600 text-sm mt-1">
            Aradığınız sayfa mevcut değil veya taşınmış olabilir.
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => router.back()}
            className="px-6 py-3 text-sm font-bold bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl transition-colors active:scale-[0.97]"
          >
            Geri Dön
          </button>
          <button
            onClick={() => router.push("/track")}
            className="px-6 py-3 text-sm font-bold bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl transition-colors active:scale-[0.97]"
          >
            Sipariş Takip
          </button>
        </div>
      </div>
    </div>
  );
}
