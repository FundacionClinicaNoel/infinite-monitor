import {
  getHospitalTwinEvents,
  getHospitalTwinSnapshot,
} from "@/lib/hospital-twin";
import {
  encodeTwinSseComment,
  encodeTwinSseMessage,
} from "@/lib/hospital-twin/sse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EVENT_POLL_MS = 2000;
const HEARTBEAT_MS = 15000;
const SNAPSHOT_REFRESH_MS = 15000;
const RETRY_MS = 3000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function newestOccurredAt(
  events: Array<{ occurredAt: string }>,
  fallback: string | null,
) {
  let newest = fallback;
  let newestTime = fallback ? Date.parse(fallback) : Number.NEGATIVE_INFINITY;

  for (const event of events) {
    const time = Date.parse(event.occurredAt);
    if (Number.isFinite(time) && time > newestTime) {
      newestTime = time;
      newest = event.occurredAt;
    }
  }

  return newest;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  let cursor =
    url.searchParams.get("cursor") ?? request.headers.get("last-event-id");
  let since = url.searchParams.get("since");
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enqueue = (payload: string) => {
        if (closed || request.signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          closed = true;
        }
      };

      const send = (
        event: string,
        data: unknown,
        id?: string | null,
        retry?: number,
      ) => enqueue(encodeTwinSseMessage({ event, data, id, retry }));

      const finish = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // The browser may already have closed the stream.
        }
      };

      request.signal.addEventListener("abort", finish, { once: true });

      void (async () => {
        let lastHeartbeatAt = Date.now();
        let lastSnapshotAt = 0;

        send(
          "ready",
          {
            connectedAt: new Date().toISOString(),
            transport: "sse",
          },
          cursor,
          RETRY_MS,
        );

        while (!closed && !request.signal.aborted) {
          try {
            const now = Date.now();
            if (now - lastSnapshotAt >= SNAPSHOT_REFRESH_MS) {
              const snapshot = await getHospitalTwinSnapshot();
              send("snapshot", snapshot);
              lastSnapshotAt = Date.now();
            }

            const batch = await getHospitalTwinEvents({
              cursor,
              since,
              limit: 50,
            });

            if (batch.events.length > 0) {
              cursor = batch.nextCursor ?? cursor;
              since = newestOccurredAt(batch.events, since);
              send("events", batch, cursor);

              const snapshot = await getHospitalTwinSnapshot();
              send("snapshot", snapshot);
              lastSnapshotAt = Date.now();
            }

            if (Date.now() - lastHeartbeatAt >= HEARTBEAT_MS) {
              enqueue(encodeTwinSseComment(`heartbeat ${new Date().toISOString()}`));
              lastHeartbeatAt = Date.now();
            }
          } catch (error) {
            console.error("[hospital-twin] stream iteration error", error);
            send("warning", {
              code: "HOSPITAL_TWIN_STREAM_SOURCE_UNAVAILABLE",
              message:
                "La fuente operacional no respondió. Se conserva el último estado válido.",
              occurredAt: new Date().toISOString(),
            });
          }

          await sleep(EVENT_POLL_MS);
        }

        finish();
      })();
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
