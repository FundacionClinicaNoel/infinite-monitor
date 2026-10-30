import { authorizeTwin, twinFailure, TwinError } from "@/lib/hospital-twin-bridge";
import { generateDashboardDesign } from "@/lib/hospital-dashboard-design";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;
let busy = false;
let attempts: number[] = [];
export async function POST(request: Request) {
  let acquired = false;
  try {
    authorizeTwin(request);
    if (busy) throw new TwinError(429, "Ya hay un diseño en generación. Inténtalo al terminar.");
    const now = Date.now(); attempts = attempts.filter(t => now-t<60000);
    if (attempts.length>=5) throw new TwinError(429, "Se alcanzó el límite de generación por minuto.");
    if (!request.headers.get("content-type")?.includes("application/json")) throw new TwinError(415, "Se requiere JSON.");
    busy=true; acquired=true; attempts.push(now);
    const reader = request.body?.getReader(); if (!reader) throw new TwinError(422, "Solicitud inválida.");
    let size = 0; const chunks: Uint8Array[] = [];
    while (true) { const {value,done}=await reader.read(); if(done)break; size+=value.byteLength; if(size>16384){await reader.cancel();throw new TwinError(413,"Solicitud demasiado extensa.");} chunks.push(value); }
    let input; try { input=JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new TwinError(422,"JSON inválido."); }
    return Response.json(await generateDashboardDesign(input),{headers:{"Cache-Control":"private, no-store"}});
  } catch(error) { return twinFailure(error); }
  finally { if(acquired)busy=false; }
}
