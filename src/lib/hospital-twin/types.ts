export type TwinStatus = "normal" | "attention" | "critical";
export type TwinFlowKind = "supply" | "medication" | "patient" | "data";

export interface TwinMetricBreakdown {
  label: string;
  count: number;
}

export type TwinMetricValue =
  | number
  | string
  | TwinMetricBreakdown[]
  | undefined;

export interface TwinArea {
  id: string;
  name: string;
  floor?: string | null;
  type: "central" | "pharmacy" | "surgery" | "operating_room" | "hospitalization" | "other";
  position: [number, number, number];
  size: [number, number, number];
  status: TwinStatus;
  metrics: {
    stockHealth?: number;
    activity?: number;
    occupancy?: number;
    pending?: number;
    operationalLabel?: string;
    totalArticles?: number;
    healthyArticles?: number;
    lowStockArticles?: number;
    outOfStockArticles?: number;
    warehouseCode?: string;
    warehouseName?: string;
    lastMovementAt?: string;
    activityBreakdown?: TwinMetricBreakdown[];
    pendingBreakdown?: TwinMetricBreakdown[];
    [key: string]: TwinMetricValue;
  };
}

export interface TwinFlow {
  id: string;
  from: string;
  to: string;
  kind: TwinFlowKind;
  volume: number;
  status?: TwinStatus;
}

export interface TwinEvent {
  id: string;
  type:
    | "hospital.area.updated"
    | "supply.moved"
    | "medication.moved"
    | "patient.moved"
    | "inventory.low"
    | "operating_room.delayed"
    | "custom";
  entityType?: "supply" | "medication" | "patient" | "area" | "other";
  entityId?: string | null;
  from?: string | null;
  to?: string | null;
  areaId?: string | null;
  occurredAt: string;
  severity: TwinStatus;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface TwinProcessStage {
  id: string;
  name: string;
  count: number;
  kind?: string;
  status: TwinStatus;
  description?: string;
  source?: string;
  shareOfFloor?: number;
}

export interface TwinProcessFloor {
  id: string;
  number: string;
  name: string;
  status: TwinStatus;
  total: number;
  stages: TwinProcessStage[];
}

export interface TwinProcessTransition {
  id: string;
  from: string;
  to: string;
  count: number;
  status: TwinStatus;
  description?: string;
}

export interface HospitalProcessSnapshot {
  generatedAt: string;
  version: string;
  source: string;
  floors: TwinProcessFloor[];
  transitions: TwinProcessTransition[];
  summary: Record<string, number>;
}

export interface HospitalTwinSnapshot {
  hospitalId: string;
  generatedAt: string;
  source: "demo" | "remote";
  areas: TwinArea[];
  flows: TwinFlow[];
  process?: HospitalProcessSnapshot;
  summary: {
    areas: number;
    criticalAreas: number;
    attentionAreas: number;
    activeFlows: number;
  };
}

export interface HospitalTwinEventBatch {
  generatedAt: string;
  source: "demo" | "remote";
  events: TwinEvent[];
  nextCursor: string | null;
}
