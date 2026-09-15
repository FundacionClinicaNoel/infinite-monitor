import { PROVIDERS } from "@/lib/model-registry";
import { NoelError } from "./auth";

export function modelConfiguration() {
  const model = process.env.NOEL_MODEL || "";
  const apiKey = process.env.NOEL_MODEL_API_KEY || "";
  const separator = model.indexOf(":");
  if (model.startsWith("ollama:")) {
    const modelId = model.slice(7);
    if (!modelId || /cloud/i.test(modelId) || !/^[a-zA-Z0-9._:/-]+$/.test(modelId)) {
      throw new NoelError(503, "Configura un modelo descargado localmente en Ollama.");
    }
    return { model, apiKey: "", localModelId: modelId };
  }
  if (process.env.NOEL_LOCAL_ONLY === "true") {
    throw new NoelError(503, "El modo local solo admite modelos Ollama.");
  }
  if (separator < 1 || !model.slice(separator + 1) || !apiKey
    || !PROVIDERS.some(p => p.id === model.slice(0, separator))) {
    throw new NoelError(503, "Proveedor de IA no configurado.");
  }
  return { model, apiKey };
}
