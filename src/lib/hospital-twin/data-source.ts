import type { HospitalTwinEventBatch, HospitalTwinSnapshot } from "./types";

export interface TwinEventQuery {
  cursor?: string | null;
  since?: string | null;
  limit?: number;
}

export interface TwinDataSource {
  readonly name: string;
  readonly mode: "demo" | "remote";
  getSnapshot(): Promise<HospitalTwinSnapshot>;
  getEvents(query?: TwinEventQuery): Promise<HospitalTwinEventBatch>;
}
