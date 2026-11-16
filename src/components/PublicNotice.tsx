"use client";
import Link from "next/link";
import Card from "@/components/ui/Card";
import { useT } from "@/components/ui/useT";

/** What becomes public, shown right before something is sent. Sending counts as accepting the notice and terms. */
export default function PublicNotice({ kind }: { kind: "issue" | "idea" | "question" }) {
  const t = useT();
  return (
    <Card tone="info" padded className="text-sm">
      <p className="font-semibold">{t.pubTitle}</p>
      <p>{kind === "issue" ? t.pubIssue : kind === "idea" ? t.pubIdea : t.pubQuestionPublic}</p>
      <p>{t.pubNoPersonal}</p>
      <p>{t.pubAgree} <Link href="/privacy" className="text-civic underline">{t.lgToPrivacy}</Link> · <Link href="/terms" className="text-civic underline">{t.lgToTerms}</Link></p>
    </Card>
  );
}
