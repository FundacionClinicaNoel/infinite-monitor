import { z } from "zod";
import { createVerifier, NoelError, readLimitedBody } from "./auth";
import { modelConfiguration } from "./model-config";

const schema = z.object({ request_id: z.uuid() }).strict();

export function createVerificationHandler() {
  const verify = createVerifier("/api/noel/verify");
  return async (request: Request) => {
    if (process.env.NOEL_INTEGRATION_MODE !== "true") return new Response(null, { status: 404 });
    try {
      const body = await readLimitedBody(request);
      verify(request.headers, body, process.env.NOEL_SHARED_SECRET || "");
      const parsed = schema.safeParse(JSON.parse(body));
      if (!parsed.success || parsed.data.request_id !== request.headers.get("x-noel-nonce")) {
        throw new NoelError(422, "Solicitud de verificación inválida.");
      }
      // Comprueba configuración local, no llama al proveedor ni consume tokens.
      modelConfiguration();
      return Response.json({ request_id: parsed.data.request_id, service: "noel-dashboard-generator", protocol: 1, configured: true },
        { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      return Response.json({ message: error instanceof NoelError ? error.message : "No fue posible verificar el servicio." },
        { status: error instanceof NoelError ? error.status : 422, headers: { "Cache-Control": "no-store" } });
    }
  };
}
