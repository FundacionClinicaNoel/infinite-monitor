import { PROVIDERS } from "@/lib/model-registry";
import { NoelError } from "./auth";

export function modelConfiguration() {
  const model = process.env.NOEL_MODEL || "";
  const apiKey = process.env.NOEL_MODEL_API_KEY || "";
  const separator = model.indexOf(":");
  if (separator < 1 || !model.slice(separator + 1) || !apiKey
    || !PROVIDERS.some(p => p.id === model.slice(0, separator))) {
    throw new NoelError(503, "Proveedor de IA no configurado.");
  }
  return { model, apiKey };
}
