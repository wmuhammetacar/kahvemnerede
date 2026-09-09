"use client";

import { useEffect, useRef, useState } from "react";

interface UseSSEOptions {
  url: string;
  onMessage: (data: Record<string, unknown>) => void;
  onConnected?: () => void;
  enabled?: boolean;
  pollUrl?: string;
  pollInterval?: number;
}

export function useSSE({
  url,
  onMessage,
  onConnected,
  enabled = true,
  pollUrl,
  pollInterval = 5000,
}: UseSSEOptions) {
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  const onConnectedRef = useRef(onConnected);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    onConnectedRef.current = onConnected;
  }, [onConnected]);

  useEffect(() => {
    if (!enabled) return;

    let es: EventSource | null = null;
    let pollId: ReturnType<typeof setInterval> | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = 1000;
    let unmounted = false;

    function stopPolling() {
      if (pollId !== null) {
        clearInterval(pollId);
        pollId = null;
      }
    }

    function connect() {
      if (unmounted) return;
      es = new EventSource(url);

      es.onopen = () => {
        if (unmounted) return;
        setConnected(true);
        retryDelay = 1000;
        stopPolling();
        onConnectedRef.current?.();
      };

      es.onmessage = (event) => {
        if (unmounted) return;
        try {
          const parsed = JSON.parse(event.data);
          onMessageRef.current(parsed);
        } catch {
          // invalid JSON
        }
      };

      es.onerror = () => {
        if (unmounted) return;
        es?.close();
        es = null;
        setConnected(false);

        if (pollUrl && pollId === null) {
          pollId = setInterval(async () => {
            if (unmounted) return;
            try {
              const res = await fetch(pollUrl, {
                credentials: "include",
              });
              if (res.ok) {
                const data = await res.json();
                onMessageRef.current(data);
              }
            } catch {
              // polling error — silent, will retry on next interval
            }
          }, pollInterval);
        }

        retryTimeout = setTimeout(() => {
          retryDelay = Math.min(retryDelay * 2, 30000);
          connect();
        }, retryDelay);
      };
    }

    connect();

    return () => {
      unmounted = true;
      es?.close();
      stopPolling();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [enabled, url, pollUrl, pollInterval]);

  return { connected };
}
