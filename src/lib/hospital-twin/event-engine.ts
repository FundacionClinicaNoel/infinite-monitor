import type {
  HospitalTwinEventBatch,
  HospitalTwinSnapshot,
  TwinArea,
  TwinEvent,
  TwinFlow,
  TwinStatus,
} from "./types";

const SAFE_METADATA_KEYS = new Set([
  "quantity",
  "stock",
  "stockHealth",
  "occupancy",
  "pending",
  "delayMinutes",
  "procedureCode",
  "orderId",
  "warehouse",
  "operatingRoom",
  "status",
]);

function clampMetric(value: unknown, min = 0, max = 100000): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(max, Math.max(min, value));
}

function normalizeStatus(value: unknown): TwinStatus {
  return value === "critical" || value === "attention" ? value : "normal";
}

function sanitizeMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, string | number | boolean | null> | undefined {
  if (!metadata) return undefined;
  const safe: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!SAFE_METADATA_KEYS.has(key)) continue;
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      safe[key] = value;
    }
  }
  return Object.keys(safe).length ? safe : undefined;
}

function normalizeArea(area: TwinArea): TwinArea {
  const metrics = Object.fromEntries(
    Object.entries(area.metrics ?? {})
      .map(([key, value]) => [key, clampMetric(value)])
      .filter(([, value]) => value !== undefined),
  );

  return {
    ...area,
    id: String(area.id),
    name: String(area.name),
    status: normalizeStatus(area.status),
    position: area.position.map((v) => Number(v) || 0) as [number, number, number],
    size: area.size.map((v) => Math.max(0.1, Number(v) || 1)) as [number, number, number],
    metrics,
  };
}

function normalizeFlow(flow: TwinFlow): TwinFlow {
  return {
    ...flow,
    id: String(flow.id),
    from: String(flow.from),
    to: String(flow.to),
    volume: Math.max(0, Number(flow.volume) || 0),
    status: flow.status ? normalizeStatus(flow.status) : undefined,
  };
}

function normalizeEvent(event: TwinEvent): TwinEvent {
  return {
    ...event,
    id: String(event.id),
    entityId: event.entityId ? String(event.entityId) : null,
    occurredAt: new Date(event.occurredAt).toISOString(),
    severity: normalizeStatus(event.severity),
    metadata: sanitizeMetadata(event.metadata),
  };
}

export class HospitalEventEngine {
  normalizeSnapshot(snapshot: HospitalTwinSnapshot): HospitalTwinSnapshot {
    const areas = snapshot.areas.map(normalizeArea);
    const areaIds = new Set(areas.map((area) => area.id));
    const flows = snapshot.flows
      .map(normalizeFlow)
      .filter((flow) => areaIds.has(flow.from) && areaIds.has(flow.to));

    return {
      ...snapshot,
      generatedAt: new Date(snapshot.generatedAt).toISOString(),
      areas,
      flows,
      summary: {
        areas: areas.length,
        criticalAreas: areas.filter((area) => area.status === "critical").length,
        attentionAreas: areas.filter((area) => area.status === "attention").length,
        activeFlows: flows.length,
      },
    };
  }

  normalizeEvents(batch: HospitalTwinEventBatch): HospitalTwinEventBatch {
    return {
      ...batch,
      generatedAt: new Date(batch.generatedAt).toISOString(),
      events: batch.events.map(normalizeEvent),
    };
  }
}
