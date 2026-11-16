import { describe, expect, it } from "vitest";
import { healthAlerts, parseDsn } from "@/lib/monitor";

describe("monitor", () => {
  it("parses a Sentry DSN into an envelope URL and key", () => {
    expect(parseDsn("https://abc123@o1.ingest.sentry.io/456")).toEqual({ url: "https://o1.ingest.sentry.io/api/456/envelope/", key: "abc123" });
    expect(parseDsn("nonsense")).toBeNull();
    expect(parseDsn(undefined)).toBeNull();
  });
  it("alerts on overdue and dead deliveries and on a high AI error rate", () => {
    expect(healthAlerts({ deliveries_pending: 0, deliveries_dead: 0, ai_runs_24h: 100, ai_errors_24h: 5 })).toEqual([]);
    expect(healthAlerts({ deliveries_pending: 51, deliveries_dead: 2, ai_runs_24h: 10, ai_errors_24h: 4 })).toHaveLength(3);
    expect(healthAlerts({ deliveries_pending: 0, deliveries_dead: 0, ai_runs_24h: 5, ai_errors_24h: 5 })).toEqual([]);
  });
});
