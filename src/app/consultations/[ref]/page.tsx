import { notFound } from "next/navigation";
import ConsultationView from "@/components/consult/ConsultationView";
import { FLAGS } from "@/lib/flags";
import { loginUrl } from "@/lib/guard";
import { currentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Consultation({ params }: PageProps<"/consultations/[ref]">) {
  if (!FLAGS.consultations) notFound();
  const { ref } = await params;
  let signedIn = false;
  try { signedIn = !!(await currentUser()).user; } catch { /* signed out */ }
  return <ConsultationView refId={ref} signedIn={signedIn} loginHref={loginUrl(`/consultations/${ref}`)} />;
}
