export type RealtimeEventType =
  | "system.connected"
  | "order.created"
  | "order.updated"
  | "kitchen.updated"
  | "stock.updated"
  | "product.updated";

export type RealtimeEvent = {
  id: string;
  type: RealtimeEventType;
  at: string;
  payload?: Record<string, unknown>;
};

