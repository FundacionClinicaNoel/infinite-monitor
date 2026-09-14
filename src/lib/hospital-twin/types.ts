export type TwinStatus = "normal" | "attention" | "critical";
export type TwinFlowKind = "supply" | "medication" | "patient" | "data";

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
    [key: string]: number | undefined;
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

export interface HospitalTwinSnapshot {
  hospitalId: string;
  generatedAt: string;
  source: "demo" | "remote";
  areas: TwinArea[];
  flows: TwinFlow[];
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
