import { authorizeTwin, loadTwin, twinFailure, twinHeaders } from "@/lib/hospital-twin";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try { authorizeTwin(request); await loadTwin(); } catch (error) { return twinFailure(error); }
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  const seen = new Set<string>();
  let version = "";
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, value: unknown, id?: string) => {
        if (!closed) controller.enqueue(encoder.encode(`${id ? `id: ${id.replace(/[\r\n]/g, "")}\n` : ""}event: ${event}\ndata: ${JSON.stringify(value)}\n\n`));
      };
      const tick = async () => {
        try {
          const data = await loadTwin();
          const next = String(data.snapshot.generatedAt);
          if (next !== version) {
            version = next;
            send("snapshot", data.snapshot);
            const events = (data.events.events as Record<string,unknown>[]).filter(e => !seen.has(String(e.id)));
            for (const event of events) seen.add(String(event.id));
            if (seen.size > 1000) { seen.clear(); for (const event of events) seen.add(String(event.id)); }
            if (events.length) send("events", { ...data.events, events });
          } else send("ready", { source: "remote" });
        } catch { send("warning", { message: "La fuente operacional requiere actualización." }); }
      };
      send("ready", { source: "remote" });
      void tick();
      timer = setInterval(() => { void tick(); }, 15000);
      request.signal.addEventListener("abort", () => { closed = true; clearInterval(timer); try { controller.close(); } catch {} }, { once: true });
    },
    cancel() { closed = true; clearInterval(timer); },
  });
  return new Response(stream, { headers: { ...twinHeaders, "Content-Type": "text/event-stream", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
