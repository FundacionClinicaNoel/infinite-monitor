import { createVerifier, NoelError, readLimitedBody } from "./auth";
import { envelopeSchema, proposalSchema, type Envelope, type Proposal } from "./contract";

type Generator = (input: Envelope, signal: AbortSignal) => Promise<Proposal>;
const reply = (body: unknown, status = 200) => Response.json(body, {
  status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
});

export function createNoelHandler(generate: Generator) {
  const verify = createVerifier();
  let active = 0;
  return async (request: Request): Promise<Response> => {
    if (process.env.NOEL_INTEGRATION_MODE !== "true") return reply({ message: "No disponible." }, 404);
    try {
      const raw = await readLimitedBody(request);
      verify(request.headers, raw, process.env.NOEL_SHARED_SECRET || "");
      let decoded: unknown;
      try { decoded = JSON.parse(raw); } catch { throw new NoelError(400, "JSON inválido."); }
      const parsed = envelopeSchema.safeParse(decoded);
      if (!parsed.success) throw new NoelError(422, "Contrato de datos inválido.");
      if (parsed.data.request_id !== request.headers.get("x-noel-nonce")) throw new NoelError(401, "Solicitud no autorizada.");
      if (active >= 4) throw new NoelError(429, "Hay varias solicitudes en curso. Intente nuevamente.");
      active++;
      try {
        const proposal = proposalSchema.parse(await generate(parsed.data, AbortSignal.any([
          request.signal, AbortSignal.timeout(60000),
        ])));
        if (proposal.status !== "ready") throw new NoelError(422, "La solicitud requiere indicadores fuera del catálogo habilitado.");
        if (!proposal.title || !proposal.spec) throw new NoelError(502, "La IA no devolvió un dashboard válido.");
        const ids = proposal.spec.widgets.map(w => w.id);
        const allowed = new Set(parsed.data.catalog[0].metrics.map(m => m.key));
        if (new Set(ids).size !== ids.length || proposal.spec.widgets.some(w => !allowed.has(w.metric))) {
          throw new NoelError(502, "La IA no devolvió un dashboard válido.");
        }
        return reply({ request_id: parsed.data.request_id, title: proposal.title, spec: proposal.spec });
      } finally { active--; }
    } catch (error) {
      if (error instanceof NoelError) return reply({ message: error.message }, error.status);
      // Nunca devolver errores del proveedor: pueden incluir request bodies y claves.
      return reply({ message: "No fue posible generar la propuesta. Intente nuevamente." }, 502);
    }
  };
}
