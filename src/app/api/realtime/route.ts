import { requireApiRole } from "@/lib/auth";
import { createConnectedEvent, subscribeRealtime } from "@/lib/realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = requireApiRole(request, ["CASHIER", "KITCHEN", "MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let keepAlive: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const close = (controller?: ReadableStreamDefaultController<Uint8Array>) => {
    if (closed) return;
    closed = true;
    if (keepAlive) {
      clearInterval(keepAlive);
      keepAlive = null;
    }
    unsubscribe();
    if (controller) {
      try {
        controller.close();
      } catch {
        // ignore when stream is already closed
      }
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      send(createConnectedEvent());
      unsubscribe = subscribeRealtime((event) => {
        send(event);
      });

      keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(`event: ping\ndata: ${Date.now()}\n\n`));
      }, 15000);

      request.signal.addEventListener("abort", () => close(controller));
    },
    cancel() {
      close();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}

