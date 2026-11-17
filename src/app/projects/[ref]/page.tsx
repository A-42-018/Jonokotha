import ProjectDetail from "@/components/projects/ProjectDetail";
import { loginUrl } from "@/lib/guard";
import { currentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** One public project with milestones, citizen check-ins and follow, from GET /api/v1/projects/{ref}. */
export default async function ProjectPage(props: PageProps<"/projects/[ref]">) {
  const { ref } = await props.params;
  let signedIn = false;
  try { signedIn = !!(await currentUser()).user; } catch { /* signed out */ }
  return <ProjectDetail refId={ref} signedIn={signedIn} loginHref={loginUrl(`/projects/${ref}`)} />;
}
