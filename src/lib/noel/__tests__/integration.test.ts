import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createVerifier, signingInput } from "../auth";
import { createNoelHandler } from "../handler";
import { allowedInNoelMode } from "../mode";

const secret = "test-only-shared-secret-32-characters-long";
const id = "8d512c14-5f9e-4a8d-9b32-f798311d11f3";
const spec = { schema_version: 1 as const, widgets: [{ id: "ocupacion", title: "Ocupación", dataset: "cirugia.ocupacion" as const, metric: "ocupado_min" as const, visualization: "bar" as const }] };
const payload = () => ({ request_id: id, user_id: 1, prompt: "Ocupación por sala", current: null,
  catalog: [{ id: "cirugia.ocupacion", title: "Ocupación", description: "Programada", metrics: [{ key: "ocupado_min", label: "Tiempo ocupado", unit: "minutos" }] }],
  dataset: { dataset: "cirugia.ocupacion", schema_version: 1, fecha: "2026-09-07", updated_at: "2026-09-07T10:00:00-05:00", rows: [{ codigo: "Q1", capacidad_maxima_min: 600, ocupado_min: 100, disponible_min: 500, porcentaje_ocupacion: 16.7 }] },
});
function signed(body: string, timestamp = String(Math.floor(Date.now() / 1000)), nonce = id) {
  return { "x-noel-timestamp": timestamp, "x-noel-nonce": nonce,
    "x-noel-signature": createHmac("sha256", secret).update(signingInput(timestamp, nonce, body)).digest("hex") };
}
function request(data = payload()) {
  const body = JSON.stringify(data);
  return new Request("https://monitor.test/api/noel/generate", { method: "POST", body, headers: signed(body) });
}
beforeEach(() => { vi.stubEnv("NOEL_INTEGRATION_MODE", "true"); vi.stubEnv("NOEL_SHARED_SECRET", secret); });
afterEach(() => vi.unstubAllEnvs());

describe("Noel integration boundary", () => {
  it("accepts a valid request, binds the response and does not persist a dashboard", async () => {
    const generator = vi.fn(async () => ({ status: "ready" as const, title: "Quirófanos", spec }));
    const response = await createNoelHandler(generator)(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ request_id: id, title: "Quirófanos", spec });
    expect(generator).toHaveBeenCalledOnce();
  });
  it("rejects missing signatures before calling the model", async () => {
    const generate = vi.fn();
    const response = await createNoelHandler(generate)(new Request("https://monitor.test/api/noel/generate", { method: "POST", body: JSON.stringify(payload()) }));
    expect(response.status).toBe(401); expect(generate).not.toHaveBeenCalled();
  });
  it("rejects tampering, expiry and replay", () => {
    const body = JSON.stringify(payload());
    const timestamp = "1788775200";
    const headers = new Headers(signed(body, timestamp));
    const verify = createVerifier();
    expect(() => verify(headers, body + " ", secret, Number(timestamp))).toThrow();
    expect(() => verify(headers, body, secret, Number(timestamp) + 61)).toThrow();
    verify(headers, body, secret, Number(timestamp));
    expect(() => verify(headers, body, secret, Number(timestamp))).toThrow("ya utilizada");
  });
  it("rejects executable widget output", async () => {
    const generate = vi.fn(async () => ({ status: "ready" as const, title: "Unsafe", spec: { ...spec, code: "alert(1)" } }));
    expect((await createNoelHandler(generate)(request())).status).toBe(502);
  });
  it("rejects metrics not present in the supplied catalog", async () => {
    const generate = vi.fn(async () => ({ status: "ready" as const, title: "Metric", spec: { ...spec, widgets: [{ ...spec.widgets[0], metric: "disponible_min" as const }] } }));
    expect((await createNoelHandler(generate)(request())).status).toBe(502);
  });
  it("does not expose provider errors or pretend unsupported requests succeeded", async () => {
    const generate = vi.fn(async () => { throw new Error("private-key-and-prompt"); });
    const result = await createNoelHandler(generate)(request());
    expect(result.status).toBe(502); expect(await result.text()).not.toContain("private-key");
    const unsupported = vi.fn(async () => ({ status: "unsupported" as const, title: null, spec: null }));
    expect((await createNoelHandler(unsupported)(request())).status).toBe(422);
  });
  it("is disabled by default and rejects oversized requests", async () => {
    vi.stubEnv("NOEL_INTEGRATION_MODE", "false");
    expect((await createNoelHandler(vi.fn())(request())).status).toBe(404);
    vi.stubEnv("NOEL_INTEGRATION_MODE", "true");
    const huge = new Request("https://monitor.test/api/noel/generate", { method: "POST", body: "x".repeat(65537) });
    expect((await createNoelHandler(vi.fn())(huge)).status).toBe(413);
  });
  it("blocks legacy execution, generic proxies, sharing and dashboards in integration mode", () => {
    for (const path of ["/", "/api/chat", "/api/proxy", "/api/dashboards", "/api/widgets/a", "/share/a", "/api/noel/generate/"]) {
      expect(allowedInNoelMode(path, "GET")).toBe(false);
      expect(allowedInNoelMode(path, "POST")).toBe(false);
    }
    expect(allowedInNoelMode("/api/noel/generate", "POST")).toBe(true);
    expect(allowedInNoelMode("/api/noel/health", "GET")).toBe(true);
  });
});
