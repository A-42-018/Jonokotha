"use client";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useFollows } from "@/components/ui/useFollows";
import { useT } from "@/components/ui/useT";

/** "খবর রাখুন" on a project (F7.3): `POST /me/follows {type: "project"}` (B5.5). Signed-out visitors get a sign-in link. */
export default function FollowProject({ refId, signedIn, loginHref }: { refId: string; signedIn: boolean; loginHref: string }) {
  const t = useT();
  const toast = useToast();
  const { isFollowing, toggle, loading } = useFollows(signedIn);
  if (!signedIn) return <Link href={loginHref} className="inline-flex min-h-11 items-center text-civic underline">{t.ckFollowSignIn}</Link>;
  const on = isFollowing("project", refId);
  return (
    <Button variant={on ? "success" : "secondary"} aria-pressed={on} disabled={loading} loading={toggle.isPending}
      onClick={() => toggle.mutate({ type: "project", target: refId }, { onSuccess: (now) => toast("success", now ? t.ckFollowOn : t.ckFollowOff), onError: () => toast("error", t.ckFollowFail) })}>
      {on ? t.ckFollowing : t.ckFollow}
    </Button>
  );
}
