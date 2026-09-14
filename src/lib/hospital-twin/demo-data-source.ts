import type { TwinDataSource, TwinEventQuery } from "./data-source";
import type {
  HospitalTwinEventBatch,
  HospitalTwinSnapshot,
  TwinArea,
  TwinEvent,
  TwinFlow,
} from "./types";

const AREAS: TwinArea[] = [
  { id: "central", name: "Central", type: "central", position: [-6, 0, 0], size: [3, 1, 2.4], status: "normal", metrics: { stockHealth: 86, activity: 12 } },
  { id: "farmacia", name: "Farmacia", type: "pharmacy", position: [-2, 0, -3], size: [3, 1, 2.2], status: "attention", metrics: { stockHealth: 57, activity: 18, pending: 4 } },
  { id: "cirugia", name: "Cirugía", type: "surgery", position: [2, 0, 0], size: [3.2, 1, 2.6], status: "normal", metrics: { stockHealth: 74, activity: 21, occupancy: 68 } },
  { id: "q01", name: "Q01", type: "operating_room", position: [6, 0, -2.8], size: [2, 1, 1.6], status: "normal", metrics: { stockHealth: 81, activity: 5, occupancy: 61 } },
  { id: "q02", name: "Q02", type: "operating_room", position: [6, 0, 0], size: [2, 1, 1.6], status: "critical", metrics: { stockHealth: 29, activity: 11, occupancy: 94, pending: 3 } },
  { id: "q03", name: "Q03", type: "operating_room", position: [6, 0, 2.8], size: [2, 1, 1.6], status: "attention", metrics: { stockHealth: 44, activity: 7, occupancy: 77, pending: 1 } },
  { id: "hosp", name: "Hospitalización", type: "hospitalization", position: [-2, 0, 3.2], size: [3.2, 1, 2.2], status: "normal", metrics: { stockHealth: 79, activity: 14, occupancy: 72 } },
];

const FLOWS: TwinFlow[] = [
  { id: "central-farmacia", from: "central", to: "farmacia", kind: "supply", volume: 28 },
  { id: "central-hosp", from: "central", to: "hosp", kind: "supply", volume: 19 },
  { id: "farmacia-cirugia", from: "farmacia", to: "cirugia", kind: "medication", volume: 17 },
  { id: "cirugia-q01", from: "cirugia", to: "q01", kind: "medication", volume: 7 },
  { id: "cirugia-q02", from: "cirugia", to: "q02", kind: "medication", volume: 12, status: "attention" },
  { id: "cirugia-q03", from: "cirugia", to: "q03", kind: "medication", volume: 8 },
  { id: "hosp-cirugia", from: "hosp", to: "cirugia", kind: "patient", volume: 6 },
];

function getDemoEvents(now = new Date()): TwinEvent[] {
  const at = (secondsAgo: number) => new Date(now.getTime() - secondsAgo * 1000).toISOString();
  return [
    {
      id: `inventory-low-q02-${now.toISOString().slice(0, 16)}`,
      type: "inventory.low",
      entityType: "area",
      areaId: "q02",
      occurredAt: at(18),
      severity: "critical",
      metadata: { stockHealth: 29, operatingRoom: "Q02" },
    },
    {
      id: `medication-q02-${now.toISOString().slice(0, 16)}`,
      type: "medication.moved",
      entityType: "medication",
      from: "cirugia",
      to: "q02",
      occurredAt: at(42),
      severity: "attention",
      metadata: { quantity: 4, operatingRoom: "Q02" },
    },
    {
      id: `delay-q02-${now.toISOString().slice(0, 16)}`,
      type: "operating_room.delayed",
      entityType: "area",
      areaId: "q02",
      occurredAt: at(75),
      severity: "attention",
      metadata: { delayMinutes: 31, operatingRoom: "Q02" },
    },
    {
      id: `supply-farmacia-${now.toISOString().slice(0, 16)}`,
      type: "supply.moved",
      entityType: "supply",
      from: "central",
      to: "farmacia",
      occurredAt: at(110),
      severity: "normal",
      metadata: { quantity: 12, warehouse: "Central" },
    },
  ];
}

export class DemoTwinDataSource implements TwinDataSource {
  readonly name = "demo";
  readonly mode = "demo" as const;

  async getSnapshot(): Promise<HospitalTwinSnapshot> {
    const now = new Date();
    return {
      hospitalId: "clinica-noel-demo",
      generatedAt: now.toISOString(),
      source: "demo",
      areas: AREAS,
      flows: FLOWS,
      summary: { areas: 0, criticalAreas: 0, attentionAreas: 0, activeFlows: 0 },
    };
  }

  async getEvents(query: TwinEventQuery = {}): Promise<HospitalTwinEventBatch> {
    const now = new Date();
    const limit = Math.min(100, Math.max(1, query.limit ?? 30));
    const since = query.since ? new Date(query.since).getTime() : 0;
    const events = getDemoEvents(now)
      .filter((event) => new Date(event.occurredAt).getTime() > since)
      .slice(0, limit);

    return {
      generatedAt: now.toISOString(),
      source: "demo",
      events,
      nextCursor: events.at(-1)?.occurredAt ?? query.cursor ?? null,
    };
  }
}
