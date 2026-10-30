import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { authorizeTwin, validateTwin, storeTwin, loadTwin } from "../hospital-twin-bridge";
import { GET as eventsRoute } from "../../app/api/twin/bridge/events/route";
import { GET as hospitalRoute } from "../../app/api/twin/bridge/hospital/route";
import { POST as syncRoute } from "../../app/api/twin/bridge/sync/route";
const fixture = () => ({ snapshot: { hospitalId: "test-hospital", generatedAt: new Date().toISOString(), source: "remote", areas: [], flows: [], summary: { areas: 0, criticalAreas: 0, attentionAreas: 0, activeFlows: 0 } }, events: { generatedAt: new Date().toISOString(), source: "remote", events: [], nextCursor: null } });
describe("Hospital Twin authenticated aggregate bridge", () => {
  let folder: string;
  beforeEach(async () => { folder = await mkdtemp(path.join(tmpdir(), "noel-twin-")); process.env.HOSPITAL_TWIN_CACHE_DIR = folder; process.env.HOSPITAL_TWIN_SOURCE_TOKEN = "x".repeat(48); process.env.HOSPITAL_TWIN_HOSPITAL_ID = "test-hospital"; });
  afterEach(async () => { await rm(folder, { recursive: true, force: true }); delete process.env.HOSPITAL_TWIN_CACHE_DIR; delete process.env.HOSPITAL_TWIN_SOURCE_TOKEN; delete process.env.HOSPITAL_TWIN_HOSPITAL_ID; });
  it("rejects missing and wrong bearer before serving real data", () => {
    for (const token of ["", "wrong"]) expect(() => authorizeTwin(new Request("http://localhost", { headers: { Authorization: `Bearer ${token}` } }))).toThrow("Acceso no autorizado");
    expect(() => authorizeTwin(new Request("http://localhost", { headers: { Authorization: `Bearer ${"x".repeat(48)}` } }))).not.toThrow();
  });
  it("accepts explicit real zeros, preserves source time and survives storage", async () => {
    const f = fixture(); const ack = await storeTwin(f); expect(ack).toEqual({ accepted: true, hospitalId: "test-hospital", generatedAt: f.snapshot.generatedAt }); expect((await loadTwin()).snapshot).toEqual(f.snapshot);
  });
  it("rejects demo, wrong hospital, future and stale source without rewriting dates", () => {
    for (const patch of [{ source: "demo" }, { hospitalId: "other" }, { generatedAt: "invalid" }, { generatedAt: new Date(Date.now()-301000).toISOString() }, { generatedAt: new Date(Date.now()+61000).toISOString() }]) { const f = fixture(); Object.assign(f.snapshot, patch); expect(() => validateTwin(f)).toThrow(); }
  });
  it("rejects inconsistent summaries and clinical metadata", () => {
    const f = fixture(); f.snapshot.summary.areas = 2; expect(() => validateTwin(f)).toThrow();
    expect(() => validateTwin({ ...fixture(), patient: "PRIVATE" })).toThrow();
    expect(() => validateTwin({ ...fixture(), events: { ...fixture().events, events: [{ metadata: { orderId: "PRIVATE" } }] } })).toThrow();
  });
  it("missing cache never becomes a zero snapshot and older arrivals cannot overwrite newer", async () => {
    await expect(loadTwin()).rejects.toThrow(); const f = fixture(); await storeTwin(f); f.snapshot.generatedAt = new Date(Date.parse(f.snapshot.generatedAt)-1000).toISOString(); await expect(storeTwin(f)).rejects.toThrow("anterior");
  });
  it("routes protect cached data and reject oversized or invalid input", async () => {
    expect((await hospitalRoute(new Request("http://localhost"))).status).toBe(401);
    const headers = { Authorization: `Bearer ${"x".repeat(48)}`, "Content-Type": "application/json" };
    expect((await syncRoute(new Request("http://localhost", { method: "POST", headers, body: "{" }))).status).toBe(422);
    expect((await syncRoute(new Request("http://localhost", { method: "POST", headers, body: " ".repeat(524289) }))).status).toBe(413);
    expect((await syncRoute(new Request("http://localhost", { method: "POST", headers, body: JSON.stringify(fixture()) }))).status).toBe(200);
    const response = await hospitalRoute(new Request("http://localhost", { headers })); expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
  it("compares event times by instant across time zones and validates cursor and limit", async () => {
    const f = fixture(); const earlier = Date.now()-60000, later = earlier+1000;
    const event = (id: string, at: number) => ({ id, type: "supply.moved", severity: "normal", occurredAt: new Date(at).toISOString() });
    const input = { ...f, events: { ...f.events, events: [event("event-2",later), event("event-1",earlier)] } };
    await storeTwin(input);
    const headers = { Authorization: `Bearer ${"x".repeat(48)}` };
    const offset = new Date(earlier+500-5*3600000).toISOString().replace("Z","-05:00");
    const response = await eventsRoute(new Request(`http://localhost/api/twin/bridge/events?since=${encodeURIComponent(offset)}&limit=1`, { headers }));
    expect((await response.json()).events.map((e: {id:string}) => e.id)).toEqual(["event-2"]);
    expect((await eventsRoute(new Request("http://localhost?cursor=invalid",{headers}))).status).toBe(422);
    expect((await eventsRoute(new Request("http://localhost?limit=101",{headers}))).status).toBe(422);
  });
  it("rejects malformed entries and mismatching alert counters", () => {
    const f = fixture();
    expect(() => validateTwin({ ...f, snapshot: { ...f.snapshot, areas: [{}], summary: { ...f.snapshot.summary, areas: 1 } } })).toThrow();
    expect(() => validateTwin({ ...f, snapshot: { ...f.snapshot, areas: [{ id:"area",name:"Area",status:"critical",metrics:{} }], summary: { ...f.snapshot.summary, areas: 1 } } })).toThrow();
    expect(() => validateTwin({ ...f, events: { ...f.events, events:[{id:"e",type:"supply.moved",severity:"normal",occurredAt:"invalid"}] } })).toThrow();
  });
});
