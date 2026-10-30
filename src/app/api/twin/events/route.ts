import { authorizeTwin, loadTwin, twinFailure, twinHeaders, TwinError } from "@/lib/hospital-twin";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    authorizeTwin(request);
    const q = new URL(request.url).searchParams;
    const limit = Number(q.get("limit") || 100);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new TwinError(422, "Límite inválido.");
    const data = (await loadTwin()).events;
    let since = q.get("since");
    const cursor = q.get("cursor");
    let lastId = "";
    if (cursor) { try { if (cursor.length > 512) throw Error(); const c = JSON.parse(Buffer.from(cursor, "base64url").toString()); since = c.at; lastId = c.id; if (typeof lastId !== "string" || lastId.length > 150 || typeof since !== "string") throw Error(); } catch { throw new TwinError(422, "Cursor inválido."); } }
    if (since && (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(since) || !Number.isFinite(Date.parse(since)))) throw new TwinError(422, "Fecha inválida.");
    const after = since ? Date.parse(since) : null;
    const events = (data.events as Record<string, unknown>[]).filter(e => after === null || Date.parse(String(e.occurredAt)) > after || (Date.parse(String(e.occurredAt)) === after && String(e.id) > lastId)).sort((a,b) => Date.parse(String(a.occurredAt))-Date.parse(String(b.occurredAt)) || String(a.id).localeCompare(String(b.id))).slice(0,limit);
    const last = events.at(-1);
    return Response.json({ ...data, events, nextCursor: last ? Buffer.from(JSON.stringify({ at: last.occurredAt, id: last.id })).toString("base64url") : cursor }, { headers: twinHeaders });
  } catch (error) { return twinFailure(error); }
}
