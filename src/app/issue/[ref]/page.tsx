import { notFound } from "next/navigation";
import IssueView from "@/components/issue/IssueView";
import type { Metadata } from "next";
import { dict, getLang } from "@/lib/i18n";
import { issueMetadata } from "@/lib/share";
import { readReferral } from "@/lib/referral";
import { getCase } from "@/lib/store";
import { currentUser, supabaseServer } from "@/lib/supabase/server";

/** Open Graph tags so links shared to WhatsApp/Facebook show title, category and area (never the description or reporter). */
export async function generateMetadata({ params }: PageProps<"/issue/[ref]">): Promise<Metadata> {
  const { ref } = await params;
  const c = await getCase(await supabaseServer(), ref).catch(() => undefined);
  if (!c) return {};
  const t = dict[await getLang()];
  return issueMetadata(c, t.cats[c.category], process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000", t.appName);
}

export default async function Issue({ params }: PageProps<"/issue/[ref]">) {
  const { ref } = await params;
  const sb = await supabaseServer();
  const c = await getCase(sb, ref);
  if (!c) notFound();
  const lang = await getLang();
  let signedIn = false;
  try { signedIn = !!(await currentUser()).user; } catch { /* signed out */ }
  return <IssueView c={c} t={dict[lang]} lang={lang} signedIn={signedIn} referral={signedIn ? await readReferral(sb, ref) : null} />;
}
