import { createOpenAI } from "@ai-sdk/openai";
import { NoelError } from "./auth";

// Destino fijo en la red Docker. Nunca toma URLs del usuario ni usa fallback cloud.
export const OLLAMA_ORIGIN = "http://ollama:11434";

export function localModel(modelId: string) {
  return createOpenAI({
    baseURL: `${OLLAMA_ORIGIN}/v1`,
    apiKey: "ollama", // Valor técnico requerido por el SDK; Ollama local no lo utiliza.
    fetch: (input, init) => fetch(input, { ...init, redirect: "error" }),
  }).chat(modelId);
}

export async function verifyLocalModel(modelId: string) {
  try {
    const response = await fetch(`${OLLAMA_ORIGIN}/api/tags`, {
      signal: AbortSignal.timeout(4000), redirect: "error",
    });
    if (!response.ok) throw new Error();
    const body = await response.json();
    const expected = modelId.includes(":") ? modelId : `${modelId}:latest`;
    if (!Array.isArray(body.models) || !body.models.some((m: { name?: string }) => m.name === expected)) throw new Error();
  } catch {
    throw new NoelError(503, "Ollama no está disponible o el modelo local no está descargado.");
  }
}
