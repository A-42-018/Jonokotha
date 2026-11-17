import { notFound } from "next/navigation";
import CommitmentDetail from "@/components/tracker/CommitmentDetail";
import { FLAGS } from "@/lib/flags";

export const dynamic = "force-dynamic";

export default async function CommitmentPage(props: PageProps<"/commitments/[ref]">) {
  if (!FLAGS.commitments) notFound();
  const { ref } = await props.params;
  return <CommitmentDetail refId={ref} />;
}
