import { authorizeTwin, loadTwin, twinFailure, twinHeaders } from "@/lib/hospital-twin-bridge";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try { authorizeTwin(request); return Response.json((await loadTwin()).snapshot, { headers: twinHeaders }); }
  catch (error) { return twinFailure(error); }
}
