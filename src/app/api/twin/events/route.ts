import { getHospitalTwinEvents } from "@/lib/hospital-twin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const since = url.searchParams.get("since");
  const parsedLimit = Number(url.searchParams.get("limit") ?? "30");
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(100, Math.max(1, parsedLimit))
    : 30;

  try {
    const batch = await getHospitalTwinEvents({ cursor, since, limit });
    return Response.json(batch, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("[hospital-twin] events error", error);
    return Response.json(
      {
        error: "No fue posible obtener los eventos operacionales del hospital.",
        code: "HOSPITAL_TWIN_EVENTS_UNAVAILABLE",
      },
      { status: 503 },
    );
  }
}
