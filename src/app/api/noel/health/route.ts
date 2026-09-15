export function GET() {
  if (process.env.NOEL_INTEGRATION_MODE !== "true") return new Response(null, { status: 404 });
  return Response.json({ service: "noel-dashboard-generator", protocol: 1 }, {
    headers: { "Cache-Control": "no-store" },
  });
}
