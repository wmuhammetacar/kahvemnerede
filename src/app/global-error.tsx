"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="tr">
      <body className="antialiased bg-stone-950 text-stone-100">
        <div className="min-h-dvh flex items-center justify-center px-4">
          <div className="text-center space-y-6 max-w-sm">
            <div className="text-5xl opacity-40">⚠️</div>
            <div>
              <p className="text-stone-300 text-lg font-medium">
                Bir hata oluştu
              </p>
              <p className="text-stone-600 text-sm mt-1">
                Beklenmeyen bir sorun oluştu. Lütfen tekrar deneyin.
              </p>
            </div>
            <button
              onClick={reset}
              className="px-8 py-3 text-sm font-bold bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl transition-colors active:scale-[0.97]"
            >
              Tekrar Dene
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
