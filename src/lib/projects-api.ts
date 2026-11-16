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
