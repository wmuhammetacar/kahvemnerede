"use client";

interface ToastProps {
  message: string;
  exiting?: boolean;
  onDismiss?: () => void;
}

export function Toast({ message, exiting, onDismiss }: ToastProps) {
  return (
    <div
      className="fixed bottom-6 left-1/2 z-50 pointer-events-auto"
      role="status"
      aria-live="polite"
    >
      <div
        className={`px-5 py-3 bg-stone-800/95 backdrop-blur-sm border border-stone-700/50 rounded-xl text-sm text-stone-200 shadow-xl shadow-black/40 whitespace-nowrap ${
          exiting ? "animate-toast-out" : "animate-toast-in"
        }`}
        onClick={onDismiss}
      >
        {message}
      </div>
    </div>
  );
}
