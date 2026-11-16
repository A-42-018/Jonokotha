"use client";
import MetricNote from "@/components/ui/MetricNote";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { useShare } from "@/components/ui/useShare";
import { useT } from "@/components/ui/useT";
import { useLang } from "@/components/ui/useLang";
import { useLocalValue } from "@/components/ui/useLocalValue";
import { fillNum } from "@/lib/format";
import { ApiError } from "@/lib/api-client";
import { fetchAffectedCount, setAffected } from "@/lib/engagement-api";
import ReportContent from "@/components/ReportContent";
import { FOLLOWS_KEY, isFollowing, NO_FOLLOWS } from "@/lib/follows";
import { useFollows } from "@/components/ui/useFollows";
import QueryProvider from "@/components/QueryProvider";
import Link from "next/link";
import ShareButtons from "@/components/ui/ShareButtons";

type Props = { refId: string; title: string; signedIn?: boolean; meTooBase?: number };
export default function IssueActions(props: Props) {
  return <QueryProvider><IssueActionsInner {...props} /></QueryProvider>;
}

/** Citizen actions on an issue, all through /api/v1: "me too" (count from the server), follow, report content (moderation). */
function IssueActionsInner({ refId, title, signedIn = false, meTooBase = 0 }: Props) {
  const t = useT();
  const toast = useToast();
  const { copyLink, share } = useShare(t, `/issue/${refId}`, title);
  const lang = useLang();
  // This device only remembers that you pressed "me too" (the API does not say who), to label the button.
  const [hint, setHint] = useLocalValue(FOLLOWS_KEY, NO_FOLLOWS);
  const meToo = isFollowing(hint, "meToo", refId);
  const { isFollowing: followed, toggle: toggleFollow_ } = useFollows(signedIn);
  const following = followed("issue", refId);
  const qc = useQueryClient();
  const count = useQuery({ queryKey: ["affected", refId], queryFn: () => fetchAffectedCount(refId), placeholderData: meTooBase, staleTime: 15_000 });
  const affect = useMutation({
    mutationFn: (on: boolean) => setAffected(refId, on),
    onSuccess: (n, on) => {
      qc.setQueryData(["affected", refId], n);
      setHint(on ? { ...hint, meToo: [...new Set([...hint.meToo, refId])] } : { ...hint, meToo: hint.meToo.filter((x) => x !== refId) });
      toast("success", on ? t.enMeTooAdded : t.enMeTooRemoved);
    },
    onError: (e) => toast("error", e instanceof ApiError && e.code === "rule_not_met" ? t.enMeTooOwn : t.enActionFail),
  });
  const follow = () => toggleFollow_.mutate({ type: "issue", target: refId }, {
    onSuccess: (now) => toast("info", now ? t.isFollowToast : t.isUnfollowToast),
    onError: (e) => toast("error", e instanceof ApiError && e.code === "rule_not_met" ? t.enFollowLimit : t.enActionFail),
  });

  return (
    <>
      <Card title={t.isShareTitle} headingAs="h2">
        <div className="space-y-3">
          {signedIn ? (
            <Button
              full
              variant={meToo ? "success" : "secondary"}
              aria-pressed={meToo}
              icon={<span aria-hidden>👍</span>}
              loading={affect.isPending}
              onClick={() => affect.mutate(!meToo)}
            >
              {meToo ? t.enMeTooDone : t.enMeToo}
            </Button>
          ) : (
            <Link href={`/login?need=1&next=${encodeURIComponent(`/issue/${refId}`)}`} className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-civic px-4 font-medium text-civic">{t.enMeToo} · {t.enSignIn}</Link>
          )}
          <p className="text-sm" aria-live="polite">{fillNum(t.enMeTooCount, { n: count.data ?? meTooBase }, lang)}</p>
          <p className="text-xs text-muted">{t.enMeTooHint}</p>
          <MetricNote id="affected" period={t.mxWinSince} updated={count.dataUpdatedAt ? new Date(count.dataUpdatedAt).toISOString() : undefined} />
          {!signedIn ? (
            <Link href={`/login?need=1&next=${encodeURIComponent(`/issue/${refId}`)}`} className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-civic px-4 font-medium text-civic">{t.isFollow} · {t.enSignIn}</Link>
          ) : (
          <Button
            full
            variant="secondary"
            aria-pressed={following}
            loading={toggleFollow_.isPending}
            onClick={follow}
            icon={<span aria-hidden>{following ? "🔔" : "🔕"}</span>}
          >
            {following ? t.isFollowing : t.isFollow}
          </Button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => void copyLink()}>{t.copyLink}</Button>
            <Button variant="secondary" onClick={() => void share()}>{t.shareLink}</Button>
          </div>
          <ShareButtons path={`/issue/${refId}`} text={`${t.shText} ${title}`} />
          <p className="text-sm text-muted">{t.isShareHint}</p>
          <ReportContent type="issue" refId={refId} signedIn={signedIn} next={`/issue/${refId}`} />
        </div>
      </Card>

    </>
  );
}

