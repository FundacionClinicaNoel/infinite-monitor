import { describe, expect, it } from "vitest";
import {
  encodeTwinSseComment,
  encodeTwinSseMessage,
} from "@/lib/hospital-twin/sse";

describe("hospital twin SSE", () => {
  it("encodes named SSE messages with id and retry", () => {
    const payload = encodeTwinSseMessage({
      event: "events",
      id: "cursor-42",
      retry: 2500,
      data: { ok: true, count: 2 },
    });

    expect(payload).toContain("id: cursor-42\n");
    expect(payload).toContain("event: events\n");
    expect(payload).toContain("retry: 2500\n");
    expect(payload).toContain('data: {"ok":true,"count":2}\n\n');
  });

  it("sanitizes line breaks in protocol fields", () => {
    const payload = encodeTwinSseMessage({
      event: "snapshot\ninvalid",
      id: "cursor\r\ninvalid",
      data: null,
    });

    expect(payload).toContain("event: snapshot invalid\n");
    expect(payload).toContain("id: cursor invalid\n");
    expect(payload).not.toContain("\ninvalid\n");
  });

  it("encodes heartbeat comments", () => {
    expect(encodeTwinSseComment("heartbeat\nnow")).toBe(
      ": heartbeat now\n\n",
    );
  });
});
