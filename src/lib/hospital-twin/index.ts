import { DemoTwinDataSource } from "./demo-data-source";
import { HospitalEventEngine } from "./event-engine";
import { HttpTwinDataSource } from "./http-data-source";
import type { TwinDataSource } from "./data-source";

let source: TwinDataSource | null = null;
const engine = new HospitalEventEngine();

export function getTwinDataSource(): TwinDataSource {
  if (source) return source;

  const remoteUrl = process.env.HOSPITAL_TWIN_SOURCE_URL?.trim();
  const remoteToken = process.env.HOSPITAL_TWIN_SOURCE_TOKEN?.trim();

  source = remoteUrl
    ? new HttpTwinDataSource(remoteUrl, remoteToken)
    : new DemoTwinDataSource();

  return source;
}

export async function getHospitalTwinSnapshot() {
  const dataSource = getTwinDataSource();
  const normalized = engine.normalizeSnapshot(await dataSource.getSnapshot());
  return { ...normalized, source: dataSource.mode };
}

export async function getHospitalTwinEvents(query?: {
  cursor?: string | null;
  since?: string | null;
  limit?: number;
}) {
  const dataSource = getTwinDataSource();
  const normalized = engine.normalizeEvents(await dataSource.getEvents(query));
  return { ...normalized, source: dataSource.mode };
}

export function getHospitalTwinSourceInfo() {
  const dataSource = getTwinDataSource();
  return { name: dataSource.name, mode: dataSource.mode };
}
