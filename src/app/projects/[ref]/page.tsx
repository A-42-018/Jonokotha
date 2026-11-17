import ProjectDetail from "@/components/projects/ProjectDetail";

export const dynamic = "force-dynamic";

/** One public project with milestones, from GET /api/v1/projects/{ref}. */
export default async function ProjectPage(props: PageProps<"/projects/[ref]">) {
  const { ref } = await props.params;
  return <ProjectDetail refId={ref} />;
}
