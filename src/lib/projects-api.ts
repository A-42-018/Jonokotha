import { api } from "@/lib/api-client";
import { dataStatusOf, type DataStatus } from "@/lib/capability";

export const PROJECT_STATUSES = ["planned", "in_progress", "completed", "paused", "cancelled"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export interface ProjectItem {
  ref: string; constituency_key: string; title: string; description: string | null; status: ProjectStatus;
  budget_text: string | null; start_date: string | null; expected_end_date: string | null;
  source_url: string | null; source_checked_at: string | null; updated_at: string; is_sample?: boolean; data_status?: DataStatus;
}

/** Public projects of one area (`GET /api/v1/projects`). Budget text is the office's own wording with its source, never a citizen estimate. */
export const fetchProjects = (constituency: string) =>
  api<ProjectItem[]>(`/projects?constituency=${encodeURIComponent(constituency)}&limit=50`).then((r) => r.data.map((p) => ({ ...p, capability: dataStatusOf(p) })));

export const MILESTONE_STATUSES = ["pending", "done", "delayed"] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];
export interface Milestone { id: string; title: string; due_date: string | null; status: MilestoneStatus; note: string | null; completed_at: string | null }
export interface ProjectDetail extends ProjectItem { milestones: Milestone[] }

/** One public project with its milestones (`GET /api/v1/projects/{ref}`). A 404 means it is not published. */
export const fetchProject = (ref: string) =>
  api<Omit<ProjectDetail, "milestones"> & { milestones?: Milestone[] }>(`/projects/${encodeURIComponent(ref)}`)
    .then((r) => ({ ...r.data, milestones: r.data.milestones ?? [], capability: dataStatusOf(r.data) }));

/** Counts only what the office marked; nothing is estimated. Order: dated steps by date, undated last. */
export function milestoneSummary(ms: Milestone[]) {
  const sorted = [...ms].sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  return { total: ms.length, done: ms.filter((m) => m.status === "done").length, delayed: ms.filter((m) => m.status === "delayed").length, sorted };
}
