import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import type { RealtimeEvent, RealtimeEventType } from "@/lib/realtime-events";

const REALTIME_EMIT = "realtime:event";

type RealtimeBus = {
  emitter: EventEmitter;
};

declare global {
  // eslint-disable-next-line no-var
  var __posRealtimeBus: RealtimeBus | undefined;
}

function getBus() {
  if (!globalThis.__posRealtimeBus) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    globalThis.__posRealtimeBus = { emitter };
  }

  return globalThis.__posRealtimeBus;
}

function buildEvent(type: RealtimeEventType, payload?: Record<string, unknown>): RealtimeEvent {
  return {
    id: randomUUID(),
    type,
    at: new Date().toISOString(),
    payload
  };
}

export function publishRealtime(type: RealtimeEventType, payload?: Record<string, unknown>) {
  const event = buildEvent(type, payload);
  getBus().emitter.emit(REALTIME_EMIT, event);
  return event;
}

export function subscribeRealtime(listener: (event: RealtimeEvent) => void) {
  const { emitter } = getBus();
  emitter.on(REALTIME_EMIT, listener);
  return () => {
    emitter.off(REALTIME_EMIT, listener);
  };
}

export function createConnectedEvent() {
  return buildEvent("system.connected");
}

