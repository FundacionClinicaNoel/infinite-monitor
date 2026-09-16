import { createHmac, randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { signingInput } from "../auth";
import { createVerificationHandler } from "../verify";
import { allowedInNoelMode } from "../mode";

const secret = "test-shared-secret-with-at-least-32-characters";
function request(path = "/api/noel/verify") {
  const nonce = randomUUID();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({ request_id: nonce });
  return new Request("https://monitor.test/api/noel/verify", { method: "POST", body, headers: {
    "x-noel-timestamp": timestamp, "x-noel-nonce": nonce,
    "x-noel-signature": createHmac("sha256", secret).update(signingInput(timestamp, nonce, body, path)).digest("hex"),
  } });
}
beforeEach(() => {
  vi.stubEnv("NOEL_INTEGRATION_MODE", "true");
  vi.stubEnv("NOEL_SHARED_SECRET", secret);
  vi.stubEnv("NOEL_MODEL", "openai:test-model");
  vi.stubEnv("NOEL_MODEL_API_KEY", "test-key-never-sent");
});
afterEach(() => vi.unstubAllEnvs());

it("verifies a signed connection without returning secrets or calling a provider", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  try {
    const req = request();
    const response = await createVerificationHandler()(req);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ request_id: req.headers.get("x-noel-nonce"), service: "noel-dashboard-generator", protocol: 1, configured: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  } finally { fetchSpy.mockRestore(); }
});
it("rejects missing auth, signatures for generation and replay", async () => {
  const handler = createVerificationHandler();
  expect((await handler(new Request("https://monitor.test/api/noel/verify", { method: "POST", body: "{}" }))).status).toBe(401);
  expect((await handler(request("/api/noel/generate"))).status).toBe(401);
  const req = request();
  const duplicate = req.clone();
  expect((await handler(req)).status).toBe(200);
  expect((await handler(duplicate)).status).toBe(409);
});
it("fails readiness for an unconfigured provider and respects integration mode", async () => {
  vi.stubEnv("NOEL_MODEL_API_KEY", "");
  expect((await createVerificationHandler()(request())).status).toBe(503);
  vi.stubEnv("NOEL_INTEGRATION_MODE", "false");
  expect((await createVerificationHandler()(request())).status).toBe(404);
  expect(allowedInNoelMode("/api/noel/verify", "POST")).toBe(true);
  expect(allowedInNoelMode("/api/noel/verify", "GET")).toBe(false);
});
