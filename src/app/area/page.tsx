import ExploreView from "@/components/explore/ExploreView";
import { nowMs, type ExploreIssue } from "@/lib/explore";
import { SAMPLE_ISSUES } from "@/lib/sample";
import { listCases } from "@/lib/store";
import { currentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Explore issues. Real public cases (no coordinates yet: list only) plus labelled sample rows. */
export default async function Area() {
  let real: ExploreIssue[] = [];
  let loadFailed = false;
  try {
    const { sb } = await currentUser();
    real = (await listCases(sb)).map((c) => ({
      ref: c.ref, title: c.title, category: c.category, status: c.status, area: c.area, createdAt: c.createdAt,
      updatedAt: c.timeline.at(-1)?.at ?? c.createdAt,
    }));
  } catch {
    loadFailed = true;
  }
  return <ExploreView issues={[...real, ...SAMPLE_ISSUES]} loadFailed={loadFailed} now={nowMs()} />;
}
