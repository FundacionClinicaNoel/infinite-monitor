import { describe, expect, it } from "vitest";
import dashboardAbastecimiento from "@/templates/dashboard-abastecimiento.json";

describe("dashboard-abastecimiento template", () => {
  it("uses the hospital twin APIs and realtime SSE stream", () => {
    expect(dashboardAbastecimiento.name).toBe("dashboard-abastecimiento");
    expect(dashboardAbastecimiento.widgetCount).toBe(1);

    const widget = dashboardAbastecimiento.widgets[0];
    const app = widget.files["src/App.tsx"];

    expect(app).toContain('fetch("/api/twin/hospital"');
    expect(app).toContain("/api/twin/events?limit=12");
    expect(app).toContain('new EventSource("/api/twin/stream")');
    expect(app).toContain('addEventListener("snapshot"');
    expect(app).toContain('addEventListener("events"');
    expect(app).not.toContain("setInterval");
    expect(app).not.toContain("const areas:");
    expect(app).not.toContain("const flows:");
  });

  it("keeps the 3D runtime dependencies isolated in deps.json", () => {
    const deps = JSON.parse(
      dashboardAbastecimiento.widgets[0].files["deps.json"],
    ) as string[];

    expect(deps.some((dep) => dep.startsWith("three@"))).toBe(true);
    expect(deps.some((dep) => dep.startsWith("@react-three/fiber@"))).toBe(true);
    expect(deps.some((dep) => dep.startsWith("@react-three/drei@"))).toBe(true);
  });
});
