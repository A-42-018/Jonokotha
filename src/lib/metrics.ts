/** Every public number has an id here; the `/metrics` page defines it and `MetricNote` links to `#id`. */
export const PUBLIC_METRICS = [
  { id: "received", window: "mxWinFixed" },
  { id: "answered", window: "mxWinFixed" },
  { id: "pending", window: "mxWinFixed" },
  { id: "median", window: "mxWinFixed" },
  { id: "affected", window: "mxWinSince" },
  { id: "area", window: "mxWinFilter" },
] as const;

export type MetricId = (typeof PUBLIC_METRICS)[number]["id"];
export const metricHref = (id: MetricId) => `/metrics#${id}`;

/** Office KPIs from GET /office/kpis (backend M.11). Order is the order they are shown. */
export const OFFICE_KPI_KEYS = [
  "received", "unassigned_workload", "median_hours_to_first_response", "forwarding_rate_pct", "reopen_rate_pct",
  "median_hours_in_status", "handling_time_with_copilot", "ai_acceptance",
] as const;
