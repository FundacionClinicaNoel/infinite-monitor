import { NextResponse, type NextRequest } from "next/server";
import { allowedInNoelMode } from "@/lib/noel/mode";

export function proxy(request: NextRequest) {
  if (process.env.NOEL_INTEGRATION_MODE === "true"
    && !allowedInNoelMode(request.nextUrl.pathname, request.method)) {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.next();
}

// En integración, se bloquean también widgets, páginas compartidas, MCP y proxy genérico.
export const config = { matcher: "/:path*" };
