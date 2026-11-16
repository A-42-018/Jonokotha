"use client";
import Link from "next/link";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { useLocalValue } from "@/components/ui/useLocalValue";
import { useLang } from "@/components/ui/useLang";
import { useShare } from "@/components/ui/useShare";
import { useT } from "@/components/ui/useT";
import { useToast } from "@/components/ui/Toast";
import { fillNum, fmtDate, type Dict } from "@/lib/i18n";
import { shownSupports, type Idea, type IdeaStatus } from "@/lib/ideas";

const NONE: string[] = [];
export const SUPPORT_KEY = "jonokotha:idea-support:v1";

const TONE: Record<IdeaStatus, BadgeTone> = {
  submitted: "neutral", moderation: "neutral", office_review: "info", needs_info: "warning", under_consideration: "info",
  planned: "teal", not_planned: "neutral", in_progress: "teal", implemented: "success",
};
const ICON: Record<IdeaStatus, string> = {
  submitted: "•", moderation: "⏳", office_review: "👁", needs_info: "❓", under_consideration: "💭", planned: "🗓", not_planned: "✕", in_progress: "🔧", implemented: "✓",
};
export const ideaStatusLabel = (t: Dict, s: IdeaStatus) => t[`idSub_${s}` as keyof Dict] as string;

/** One idea. One support per idea per account: tracked on this device until the API exists (see idSupportLocalNote). */
export default function IdeaCard({ idea, signedIn }: { idea: Idea; signedIn: boolean }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const [mine, setMine] = useLocalValue<string[]>(SUPPORT_KEY, NONE);
  const supported = mine.includes(idea.id);
  const { share } = useShare(t, `/ideas#${idea.id}`, idea.title);

  function toggle() {
    setMine((m) => (m.includes(idea.id) ? m.filter((x) => x !== idea.id) : [...m, idea.id]));
    toast("success", supported ? t.idSupportRemoved : t.idSupportThanks);
  }

  return (
    <Card as="article" padded={false} className="space-y-3 p-4">
      <div id={idea.id} className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/illustrations/cat-${idea.category}.svg`} alt="" className="size-12 shrink-0" />
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="text-lg font-semibold text-foreground">{idea.title}</h3>
          <p className="text-sm text-muted">{t.cats[idea.category]} · {idea.area} · {fmtDate(idea.createdAt, lang)}</p>
        </div>
      </div>
      <p>{idea.summary}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={TONE[idea.status]} icon={ICON[idea.status]}>{ideaStatusLabel(t, idea.status)}</Badge>
        {idea.sample && <Badge tone="warning">{t.exSample}</Badge>}
        <span className="text-sm text-muted">{fillNum(t.idSupportCount, { n: shownSupports(idea, supported) }, lang)}</span>
      </div>
      {idea.reason && <p className="rounded-xl bg-slate-100 p-3 text-sm"><span className="font-medium">{t.idReason}: </span>{idea.reason}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {signedIn ? (
          <Button variant={supported ? "success" : "secondary"} aria-pressed={supported} onClick={toggle}>{supported ? t.idSupported : t.idSupport}</Button>
        ) : (
          <Link href={`/login?need=1&next=${encodeURIComponent("/ideas")}`} className="inline-flex min-h-11 items-center text-civic underline">{t.idSupportNeedsSignIn}</Link>
        )}
        <Button variant="ghost" onClick={() => void share()}>{t.shareLink}</Button>
      </div>
    </Card>
  );
}
