import type { TwinDataSource, TwinEventQuery } from "./data-source";
import type { HospitalTwinEventBatch, HospitalTwinSnapshot } from "./types";

export class HttpTwinDataSource implements TwinDataSource {
  readonly name = "http";
  readonly mode = "remote" as const;

  constructor(
    private readonly baseUrl: string,
    private readonly token?: string,
  ) {}

  private headers(): HeadersInit {
    return {
      Accept: "application/json",
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
    };
  }

  async getSnapshot(): Promise<HospitalTwinSnapshot> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/snapshot`, {
      method: "GET",
      headers: this.headers(),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      throw new Error(`Twin snapshot source returned HTTP ${response.status}`);
    }
    return (await response.json()) as HospitalTwinSnapshot;
  }

  async getEvents(query: TwinEventQuery = {}): Promise<HospitalTwinEventBatch> {
    const url = new URL(`${this.baseUrl.replace(/\/$/, "")}/events`);
    if (query.cursor) url.searchParams.set("cursor", query.cursor);
    if (query.since) url.searchParams.set("since", query.since);
    if (query.limit) url.searchParams.set("limit", String(query.limit));

    const response = await fetch(url, {
      method: "GET",
      headers: this.headers(),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      throw new Error(`Twin events source returned HTTP ${response.status}`);
    }
    return (await response.json()) as HospitalTwinEventBatch;
  }
}
