/**
 * Capability labels (masterplan 2.9, 31 #20). Every record or feature is one of four things, and the screen says which:
 * - live: real data, real server behaviour; no label is shown (a label on everything would be noise)
 * - sample: example rows that are not real reports or people
 * - demo: seeded data for a demonstration
 * - planned: not built or not switched on yet; the screen must not offer a control that looks usable
 *
 * The backend (B5.13) will send `data_status` on records and features. Until it does, the client reads the older
 * `is_sample` flag, and the table below says which features are known not to exist on the server yet.
 */
export type DataStatus = "live" | "sample" | "demo" | "planned";

const ALL: readonly DataStatus[] = ["live", "sample", "demo", "planned"];

export function isDataStatus(v: unknown): v is DataStatus {
  return typeof v === "string" && (ALL as readonly string[]).includes(v);
}

/** Status of one API record: the server's `data_status` first, then the legacy `is_sample` / `is_demo` flags, else live. */
export function dataStatusOf(item: { data_status?: unknown; is_sample?: unknown; is_demo?: unknown; sample?: unknown } | null | undefined): DataStatus {
  if (!item) return "live";
  if (isDataStatus(item.data_status)) return item.data_status;
  if (item.is_demo === true) return "demo";
  if (item.is_sample === true || item.sample === true) return "sample";
  return "live";
}

/** The least real status of a list: planned over demo over sample over live. Used for one banner above a list. */
export function worstStatus(items: readonly ({ data_status?: unknown; is_sample?: unknown; is_demo?: unknown; sample?: unknown } | null | undefined)[]): DataStatus {
  const rank: Record<DataStatus, number> = { live: 0, sample: 1, demo: 2, planned: 3 };
  return items.reduce<DataStatus>((w, i) => {
    const s = dataStatusOf(i);
    return rank[s] > rank[w] ? s : w;
  }, "live");
}

/**
 * Features this client knows the server does not offer yet. Each entry names the backend item that will switch it on.
 * A screen asks `featureStatus(key)` and shows `PlannedPanel` instead of a control that cannot work.
 */
export const FEATURES = {
  polls: { status: "planned", backend: "B5.5" },
  realtime: { status: "planned", backend: "B5.8" },
  consultations: { status: "planned", backend: "B7.1" },
  staffDirectory: { status: "planned", backend: "B5.1" },
  authorContest: { status: "planned", backend: "M.9" },
  mfaRecoveryCodes: { status: "planned", backend: "M.6" },
  areaHierarchy: { status: "planned", backend: "B5.7" },
  areaCorrection: { status: "planned", backend: "B5.7" },
  commentReports: { status: "planned", backend: "B5.5" },
  liaisonAcknowledge: { status: "planned", backend: "B5.2" },
  liaisonReference: { status: "planned", backend: "B5.2" },
  liaisonClose: { status: "planned", backend: "B5.2" },
  adminUserList: { status: "planned", backend: "B5.3" },
  adminAreaRecords: { status: "planned", backend: "B5.3" },
  adminCategories: { status: "planned", backend: "B5.3" },
  adminSla: { status: "planned", backend: "B5.3" },
  adminAppeals: { status: "planned", backend: "B5.3" },
  adminHealthDetail: { status: "planned", backend: "B5.3" },
  adminAlerts: { status: "planned", backend: "B5.3" },
  adminIntegrations: { status: "planned", backend: "B5.3" },
  adminFlags: { status: "planned", backend: "B5.3" },
  adminKnowledgeManage: { status: "planned", backend: "B5.3" },
  adminDemo: { status: "planned", backend: "B5.3" },
} as const satisfies Record<string, { status: DataStatus; backend: string }>;

export type FeatureKey = keyof typeof FEATURES;

export function featureStatus(key: FeatureKey): DataStatus {
  return FEATURES[key].status;
}
