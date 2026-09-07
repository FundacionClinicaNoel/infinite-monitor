export function allowedInNoelMode(pathname: string, method: string): boolean {
  return (pathname === "/api/noel/generate" && method === "POST")
    || (pathname === "/api/noel/verify" && method === "POST")
    || (pathname === "/api/noel/health" && method === "GET");
}
