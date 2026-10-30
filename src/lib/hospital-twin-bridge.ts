import { timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

type Json = Record<string, unknown>;
export class TwinError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const object = (x: unknown): x is Json => !!x && typeof x === "object" && !Array.isArray(x);
export function authorizeTwin(request: Request) {
  const expected = process.env.HOSPITAL_TWIN_SOURCE_TOKEN || "";
  const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  if (expected.length < 32) throw new TwinError(503, "Hospital Twin no está configurado.");
  const a = Buffer.from(expected), b = Buffer.from(supplied);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new TwinError(401, "Acceso no autorizado.");
}
const stamp = (x: unknown): number => typeof x === "string" && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(x) ? Date.parse(x) : NaN;
export function validateTwin(input: unknown, now = Date.now()) {
  if (!object(input) || !object(input.snapshot) || !object(input.events)) throw new TwinError(422, "Contrato inválido.");
  const s = input.snapshot, e = input.events;
  const expected = process.env.HOSPITAL_TWIN_HOSPITAL_ID;
  if (!expected) throw new TwinError(503, "Hospital Twin no está configurado.");
  const t = stamp(s.generatedAt);
  if (s.hospitalId !== expected || s.source !== "remote" || !Number.isFinite(t) || now - t > 300000 || t - now > 60000) throw new TwinError(422, "Fuente, hospital o fecha inválidos.");
  if (!Array.isArray(s.areas) || s.areas.length > 100 || !Array.isArray(s.flows) || s.flows.length > 1000 || !object(s.summary)) throw new TwinError(422, "Resumen inválido.");
  const n = s.summary;
  if (!["areas", "criticalAreas", "attentionAreas", "activeFlows"].every(k => Number.isSafeInteger(n[k]) && Number(n[k]) >= 0) || n.areas !== s.areas.length || n.activeFlows !== s.flows.length || Number(n.criticalAreas) + Number(n.attentionAreas) > Number(n.areas)) throw new TwinError(422, "Contadores inconsistentes.");
  if (e.source !== "remote" || !Number.isFinite(stamp(e.generatedAt)) || Math.abs(now - stamp(e.generatedAt)) > 300000 || !Array.isArray(e.events) || e.events.length > 100) throw new TwinError(422, "Eventos inválidos.");
  const status = (v: unknown) => ["normal", "attention", "critical", "inactive"].includes(String(v));
  const id = (v: unknown) => typeof v === "string" && /^[A-Za-z0-9._:-]{1,150}$/.test(v);
  const count = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0;
  if (!s.areas.every(a => object(a) && id(a.id) && typeof a.name === "string" && a.name.length <= 200 && status(a.status) && object(a.metrics))) throw new TwinError(422, "Áreas inválidas.");
  const ids = new Set(s.areas.map(a => (a as Json).id));
  if (ids.size !== s.areas.length || s.areas.filter(a => (a as Json).status === "critical").length !== n.criticalAreas || s.areas.filter(a => (a as Json).status === "attention").length !== n.attentionAreas) throw new TwinError(422, "Estados de áreas inconsistentes.");
  if (!s.flows.every(f => object(f) && id(f.id) && ids.has(f.from) && ids.has(f.to) && count(f.volume) && Number(f.volume) > 0 && status(f.status))) throw new TwinError(422, "Flujos inválidos.");
  if (!e.events.every(v => object(v) && id(v.id) && id(v.type) && status(v.severity) && Number.isFinite(stamp(v.occurredAt)) && stamp(v.occurredAt) <= now + 60000)) throw new TwinError(422, "Evento inválido.");
  if (s.process !== undefined) {
    const p = s.process;
    if (!object(p) || p.source !== "PlataformaNoel" || !Number.isFinite(stamp(p.generatedAt)) || Math.abs(now-stamp(p.generatedAt)) > 300000 || !Array.isArray(p.floors) || p.floors.length > 20 || !Array.isArray(p.transitions) || p.transitions.length > 100 || !object(p.summary) || !Object.values(p.summary).every(count)) throw new TwinError(422, "Proceso inválido.");
    if (!p.floors.every(f => object(f) && id(f.id) && count(f.total) && status(f.status) && Array.isArray(f.stages) && f.stages.length <= 100 && f.stages.every(v => object(v) && id(v.id) && count(v.count) && status(v.status)))) throw new TwinError(422, "Etapas inválidas.");
  }
  // Never accept clinical identities or arbitrary event metadata into this service.
  const serialized = JSON.stringify(input);
  if (/"(?:patient|paciente|documento|patientId|patientName|nombre_paciente|metadata|entityId)"\s*:/i.test(serialized)) throw new TwinError(422, "El contrato admite únicamente datos operativos.");
  const snapshot = Object.fromEntries(["hospitalId", "generatedAt", "source", "areas", "flows", "summary", "process"].filter(k => k in s).map(k => [k, s[k]]));
  return { snapshot, events: { generatedAt: e.generatedAt, source: "remote", events: e.events, nextCursor: e.nextCursor ?? null } };
}
function location() { return path.join(process.env.HOSPITAL_TWIN_CACHE_DIR || path.join(process.cwd(), "data", "hospital-twin"), "snapshot.json"); }
let pending: Promise<unknown> = Promise.resolve();
export async function storeTwin(input: unknown) {
  const task = pending.catch(() => {}).then(async () => {
    const data = validateTwin(input);
    const file = location();
    let old: Awaited<ReturnType<typeof loadTwin>> | null = null;
    try { old = await loadTwin(false); } catch {}
    if (old && stamp(old.snapshot.generatedAt) > stamp(data.snapshot.generatedAt)) throw new TwinError(409, "Se rechazó una actualización anterior.");
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    const temp = `${file}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify(data), { mode: 0o600 });
    await rename(temp, file);
    return { accepted: true, hospitalId: data.snapshot.hospitalId, generatedAt: data.snapshot.generatedAt };
  });
  pending = task;
  return task;
}
export async function loadTwin(fresh = true) {
  let data;
  try { data = JSON.parse(await readFile(location(), "utf8")); } catch { throw new TwinError(503, "Aún no se ha recibido una lectura operacional válida."); }
  if (!fresh) return data as ReturnType<typeof validateTwin>;
  try { return validateTwin(data); } catch { throw new TwinError(503, "La fuente operacional requiere actualización."); }
}
export function twinFailure(error: unknown) {
  return Response.json({ error: error instanceof TwinError ? error.message : "No fue posible consultar la fuente operacional." }, { status: error instanceof TwinError ? error.status : 503, headers: { "Cache-Control": "no-store" } });
}
export const twinHeaders = { "Cache-Control": "no-store, max-age=0", "X-Hospital-Twin-Source": "remote" };
