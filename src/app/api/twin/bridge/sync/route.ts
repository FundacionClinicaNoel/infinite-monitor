import { authorizeTwin, storeTwin, twinFailure, TwinError } from "@/lib/hospital-twin-bridge";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    authorizeTwin(request);
    if (!request.headers.get("content-type")?.includes("application/json")) throw new TwinError(415, "Se requiere JSON.");
    const reader = request.body?.getReader();
    if (!reader) throw new TwinError(422, "Contrato inválido.");
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 524288) { await reader.cancel(); throw new TwinError(413, "Tamaño excedido."); } chunks.push(value); }
    let input; try { input = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new TwinError(422, "JSON inválido."); }
    return Response.json(await storeTwin(input), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return twinFailure(error); }
}
