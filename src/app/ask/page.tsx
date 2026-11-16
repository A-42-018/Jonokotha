import Link from "next/link";
import AskForm from "@/components/ask/AskForm";
import EmergencyNote from "@/components/EmergencyNote";
import Card from "@/components/ui/Card";
import { getConstituencyId } from "@/lib/constituency-server";
import { DEMO_CONSTITUENCY } from "@/lib/demo-data";
import { SAMPLE_FAQ } from "@/lib/ask";
import { dict, getLang } from "@/lib/i18n";
import { currentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Ask() {
  const lang = await getLang();
  const t = dict[lang];
  let signedIn = false;
  try { signedIn = !!(await currentUser()).user; } catch { /* signed out */ }
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img loading="lazy" decoding="async" src="/illustrations/spot-ask-mp.svg" alt="" className="hidden size-24 sm:block" />
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-civic">{t.askTitle}</h1>
          <p className="text-muted">{t.askLead}</p>
          <Link href="/ask/inbox" className="inline-flex min-h-11 items-center text-civic underline">{t.askInbox}</Link>
        </div>
      </div>
      <EmergencyNote t={t} />
      <AskForm signedIn={signedIn} constituency={(await getConstituencyId()) ?? DEMO_CONSTITUENCY.id} />
      <section aria-labelledby="faq" className="space-y-2">
        <h2 id="faq" className="text-xl font-semibold text-foreground">{t.askFaqTitle}</h2>
        <p className="text-sm text-muted">{t.askFaqNote}</p>
        {SAMPLE_FAQ.map((f) => (
          <Card key={f.id} as="details" className="group">
            <summary className="min-h-11 cursor-pointer py-2 font-medium">{lang === "bn" ? f.qBn : f.qEn}</summary>
            <p className="pb-2">{lang === "bn" ? f.aBn : f.aEn}</p>
          </Card>
        ))}
      </section>
    </div>
  );
}
