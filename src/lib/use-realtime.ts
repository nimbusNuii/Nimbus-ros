"use client";

import { useEffect, useRef } from "react";
import type { RealtimeEvent } from "@/lib/realtime-events";

export function useRealtime(onEvent: (event: RealtimeEvent) => void) {
  const handlerRef = useRef(onEvent);

  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let source: EventSource | null = null;
    let reconnectTimer: number | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      source = new EventSource("/api/realtime");

      source.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data) as RealtimeEvent;
          handlerRef.current(event);
        } catch {
          // ignore malformed event payload
        }
      };

      source.onerror = () => {
        source?.close();
        source = null;
        if (closed) return;
        reconnectTimer = window.setTimeout(connect, 1500);
      };
    };

    connect();

    return () => {
      closed = true;
      source?.close();
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }
    };
  }, []);
}

