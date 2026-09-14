import { describe, expect, it } from "vitest";
import { HospitalEventEngine } from "@/lib/hospital-twin/event-engine";
import type {
  HospitalTwinEventBatch,
  HospitalTwinSnapshot,
} from "@/lib/hospital-twin/types";

const engine = new HospitalEventEngine();

describe("HospitalEventEngine", () => {
  it("recalculates summary and drops flows that reference unknown areas", () => {
    const snapshot: HospitalTwinSnapshot = {
      hospitalId: "test",
      generatedAt: "2026-09-14T12:00:00Z",
      source: "demo",
      areas: [
        {
          id: "central",
          name: "Central",
          type: "central",
          position: [0, 0, 0],
          size: [2, 1, 2],
          status: "normal",
          metrics: { stockHealth: 90 },
        },
        {
          id: "q02",
          name: "Q02",
          type: "operating_room",
          position: [4, 0, 0],
          size: [2, 1, 2],
          status: "critical",
          metrics: { stockHealth: 20 },
        },
      ],
      flows: [
        { id: "valid", from: "central", to: "q02", kind: "supply", volume: 4 },
        { id: "invalid", from: "central", to: "missing", kind: "supply", volume: 8 },
      ],
      summary: { areas: 999, criticalAreas: 999, attentionAreas: 999, activeFlows: 999 },
    };

    const result = engine.normalizeSnapshot(snapshot);

    expect(result.flows).toHaveLength(1);
    expect(result.flows[0].id).toBe("valid");
    expect(result.summary).toEqual({
      areas: 2,
      criticalAreas: 1,
      attentionAreas: 0,
      activeFlows: 1,
    });
  });

  it("removes patient identifiers and non-allowlisted metadata", () => {
    const batch: HospitalTwinEventBatch = {
      generatedAt: "2026-09-14T12:00:00Z",
      source: "remote",
      nextCursor: null,
      events: [
        {
          id: "event-1",
          type: "patient.moved",
          entityType: "patient",
          entityId: "patient-document-that-must-not-reach-ui",
          from: "hosp",
          to: "cirugia",
          occurredAt: "2026-09-14T11:59:00Z",
          severity: "normal",
          metadata: {
            quantity: 1,
            procedureCode: "534001",
            patientName: "NO DEBE SALIR",
            document: "123456789",
          } as Record<string, string | number | boolean | null>,
        },
      ],
    };

    const result = engine.normalizeEvents(batch);

    expect(result.events[0].entityId).toBeNull();
    expect(result.events[0].metadata).toEqual({
      quantity: 1,
      procedureCode: "534001",
    });
    expect(result.events[0].metadata).not.toHaveProperty("patientName");
    expect(result.events[0].metadata).not.toHaveProperty("document");
  });
});
