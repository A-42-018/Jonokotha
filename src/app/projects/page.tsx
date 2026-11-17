import ProjectsList from "@/components/projects/ProjectsList";
import { getConstituencyId } from "@/lib/constituency-server";
import { DEMO_CONSTITUENCY } from "@/lib/demo-data";
import { dict, getLang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/** Project tracker for the chosen area, from GET /api/v1/projects. */
export default async function Projects() {
  const t = dict[await getLang()];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-civic">{t.pjTitle}</h1>
      <p className="text-muted">{t.pjLead}</p>
      <ProjectsList constituency={(await getConstituencyId()) ?? DEMO_CONSTITUENCY.id} />
    </div>
  );
}
