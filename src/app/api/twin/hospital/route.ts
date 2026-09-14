import {
  getHospitalTwinSnapshot,
  getHospitalTwinSourceInfo,
} from "@/lib/hospital-twin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await getHospitalTwinSnapshot();
    return Response.json(snapshot, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Hospital-Twin-Source": getHospitalTwinSourceInfo().mode,
      },
    });
  } catch (error) {
    console.error("[hospital-twin] snapshot error", error);
    return Response.json(
      {
        error: "No fue posible obtener el estado operacional del hospital.",
        code: "HOSPITAL_TWIN_SNAPSHOT_UNAVAILABLE",
      },
      { status: 503 },
    );
  }
}
