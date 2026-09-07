export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NOEL_INTEGRATION_MODE !== "true") {
    const { warmBaseTemplate } = await import("@/lib/widget-runner");
    warmBaseTemplate();
  }
}
