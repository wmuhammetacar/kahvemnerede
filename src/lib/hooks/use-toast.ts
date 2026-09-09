"use client";

import { useState, useCallback, useRef } from "react";

export function useToast(duration = 2500) {
  const [toast, setToast] = useState<{ message: string; exiting: boolean } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const show = useCallback(
    (message: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setToast({ message, exiting: false });

      timerRef.current = setTimeout(() => {
        setToast((prev) => (prev ? { ...prev, exiting: true } : null));
        setTimeout(() => setToast(null), 200);
      }, duration);
    },
    [duration]
  );

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast((prev) => (prev ? { ...prev, exiting: true } : null));
    setTimeout(() => setToast(null), 200);
  }, []);

  return { toast, show, dismiss };
}
