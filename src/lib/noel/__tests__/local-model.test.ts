import { afterEach, expect, it, vi } from "vitest";
import { generateObject } from "ai";
import { z } from "zod";
import { modelConfiguration } from "../model-config";
import { localModel, verifyLocalModel } from "../local-model";

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it("uses Ollama without a real API key and rejects external providers in local mode", () => {
  vi.stubEnv("NOEL_LOCAL_ONLY", "true");
  vi.stubEnv("NOEL_MODEL_API_KEY", "");
  vi.stubEnv("NOEL_MODEL", "ollama:local-model:8b");
  expect(modelConfiguration().localModelId).toBe("local-model:8b");
  vi.stubEnv("NOEL_MODEL", "openai:gpt-4.1");
  expect(() => modelConfiguration()).toThrow("solo admite");
  vi.stubEnv("NOEL_MODEL", "ollama:some-cloud-model");
  expect(() => modelConfiguration()).toThrow("localmente");
});

it("checks the exact downloaded model before activation", async () => {
  const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ models: [{ name: "local-model:8b" }] }));
  await verifyLocalModel("local-model:8b");
  expect(spy).toHaveBeenCalledWith("http://ollama:11434/api/tags", expect.objectContaining({ redirect: "error" }));
  await expect(verifyLocalModel("other:8b")).rejects.toThrow("no está descargado");
});

it("sends structured output only to local chat completions with redirects blocked", async () => {
  const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({
    id: "local-test", object: "chat.completion", created: 1, model: "local-model:8b",
    choices: [{ index: 0, message: { role: "assistant", content: '{"ok":true}' }, finish_reason: "stop" }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  }));
  const result = await generateObject({ model: localModel("local-model:8b"), schema: z.object({ ok: z.boolean() }), prompt: "Test", maxRetries: 0 });
  expect(result.object).toEqual({ ok: true });
  expect(spy).toHaveBeenCalledOnce();
  const [url, options] = spy.mock.calls[0];
  expect(String(url)).toBe("http://ollama:11434/v1/chat/completions");
  expect(options?.redirect).toBe("error");
  expect(JSON.parse(String(options?.body)).response_format.type).toBe("json_schema");
});
