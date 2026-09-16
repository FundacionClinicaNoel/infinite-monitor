import type {
  HospitalProcessSnapshot,
  HospitalTwinEventBatch,
  HospitalTwinSnapshot,
  TwinArea,
  TwinEvent,
  TwinFlow,
  TwinMetricBreakdown,
  TwinStatus,
} from "./types";

const SAFE_METADATA_KEYS = new Set([
  "quantity", "stock", "stockHealth", "occupancy", "pending", "delayMinutes",
  "procedureCode", "orderId", "warehouse", "operatingRoom", "status",
]);
const NUMERIC_METRIC_KEYS = new Set([
  "stockHealth", "activity", "occupancy", "pending", "totalArticles",
  "healthyArticles", "lowStockArticles", "outOfStockArticles",
]);
const STRING_METRIC_KEYS = new Set([
  "operationalLabel", "warehouseCode", "warehouseName", "lastMovementAt",
]);
const BREAKDOWN_METRIC_KEYS = new Set(["activityBreakdown", "pendingBreakdown"]);

function clampMetric(value: unknown, min = 0, max = 10000000): number | undefined {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  return Math.min(max, Math.max(min, numeric));
}

function safeText(value: unknown, max = 240): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text ? text.slice(0, max) : undefined;
}

function normalizeStatus(value: unknown): TwinStatus {
  return value === "critical" || value === "attention" ? value : "normal";
}

function normalizeBreakdown(value: unknown): TwinMetricBreakdown[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const rows = value.slice(0, 100).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const label = safeText(record.label, 120);
    const count = clampMetric(record.count);
    return label && count !== undefined ? [{ label, count }] : [];
  });
  return rows.length ? rows : undefined;
}

function sanitizeMetrics(metrics: Record<string, unknown> | undefined): TwinArea["metrics"] {
  const safe: TwinArea["metrics"] = {};
  for (const [key, value] of Object.entries(metrics ?? {})) {
    if (NUMERIC_METRIC_KEYS.has(key)) {
      const metric = clampMetric(value);
      if (metric !== undefined) safe[key] = metric;
    } else if (STRING_METRIC_KEYS.has(key)) {
      const text = safeText(value);
      if (text !== undefined) safe[key] = text;
    } else if (BREAKDOWN_METRIC_KEYS.has(key)) {
      const breakdown = normalizeBreakdown(value);
      if (breakdown) safe[key] = breakdown;
    }
  }
  return safe;
}

function sanitizeMetadata(metadata: Record<string, unknown> | undefined) {
  if (!metadata) return undefined;
  const safe: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!SAFE_METADATA_KEYS.has(key)) continue;
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      safe[key] = value;
    }
  }
  return Object.keys(safe).length ? safe : undefined;
}

function normalizeArea(area: TwinArea): TwinArea {
  return {
    ...area,
    id: String(area.id),
    name: String(area.name),
    status: normalizeStatus(area.status),
    position: area.position.map((v) => Number(v) || 0) as [number, number, number],
    size: area.size.map((v) => Math.max(0.1, Number(v) || 1)) as [number, number, number],
    metrics: sanitizeMetrics(area.metrics as Record<string, unknown>),
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
    entityId: event.entityType === "patient" ? null : event.entityId ? String(event.entityId) : null,
    occurredAt: new Date(event.occurredAt).toISOString(),
    severity: normalizeStatus(event.severity),
    metadata: sanitizeMetadata(event.metadata),
  };
}

function normalizeProcess(process: HospitalProcessSnapshot | undefined): HospitalProcessSnapshot | undefined {
  if (!process) return undefined;
  const floors = (process.floors ?? []).slice(0, 50).map((floor) => ({
    id: String(floor.id),
    number: String(floor.number),
    name: String(floor.name),
    status: normalizeStatus(floor.status),
    total: clampMetric(floor.total) ?? 0,
    stages: (floor.stages ?? []).slice(0, 100).map((stage) => ({
      id: String(stage.id),
      name: String(stage.name),
      count: clampMetric(stage.count) ?? 0,
      kind: safeText(stage.kind),
      status: normalizeStatus(stage.status),
      description: safeText(stage.description, 500),
      source: safeText(stage.source, 160),
      shareOfFloor: clampMetric(stage.shareOfFloor, 0, 100),
    })),
  }));
  const transitions = (process.transitions ?? []).slice(0, 100).map((transition) => ({
    id: String(transition.id),
    from: String(transition.from),
    to: String(transition.to),
    count: clampMetric(transition.count) ?? 0,
    status: normalizeStatus(transition.status),
    description: safeText(transition.description, 500),
  }));
  const summary = Object.fromEntries(
    Object.entries(process.summary ?? {})
      .map(([key, value]) => [key, clampMetric(value)])
      .filter((entry): entry is [string, number] => entry[1] !== undefined),
  );
  return {
    generatedAt: new Date(process.generatedAt).toISOString(),
    version: String(process.version),
    source: safeText(process.source, 160) ?? "remote",
    floors,
    transitions,
    summary,
  };
}

export class HospitalEventEngine {
  normalizeSnapshot(snapshot: HospitalTwinSnapshot): HospitalTwinSnapshot {
    const areas = snapshot.areas.map(normalizeArea);
    const areaIds = new Set(areas.map((area) => area.id));
    const flows = snapshot.flows.map(normalizeFlow).filter((flow) => areaIds.has(flow.from) && areaIds.has(flow.to));
    return {
      ...snapshot,
      generatedAt: new Date(snapshot.generatedAt).toISOString(),
      areas,
      flows,
      process: normalizeProcess(snapshot.process),
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
