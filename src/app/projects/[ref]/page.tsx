import Link from "next/link";
import ProjectDetail from "@/components/projects/ProjectDetail";
import { R2 } from "@/lib/flags-r2";
import { dict, getLang } from "@/lib/i18n";
import { loginUrl } from "@/lib/guard";
import { currentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** One public project with milestones, citizen check-ins and follow, from GET /api/v1/projects/{ref}. With the budget flag on, a link to the figures quoted for it. */
export default async function ProjectPage(props: PageProps<"/projects/[ref]">) {
  const { ref } = await props.params;
  let signedIn = false;
  try { signedIn = !!(await currentUser()).user; } catch { /* signed out */ }
  const t = dict[await getLang()];
  return (
    <>
      <ProjectDetail refId={ref} signedIn={signedIn} loginHref={loginUrl(`/projects/${ref}`)} />
      {R2.budget && <p className="mt-4"><Link href={`/budget?project=${encodeURIComponent(ref)}`} className="inline-flex min-h-11 items-center text-civic underline">{t.r2BgTitle}</Link></p>}
    </>
  );
}
