"use client";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Textarea from "@/components/ui/Textarea";
import { useT } from "@/components/ui/useT";
import { sendMoreInfo } from "@/lib/report-api";

/**
 * The reporter answers the office's request for more information. Shown only while the issue is waiting for it,
 * because the server accepts the message only then. Anyone who is not signed in is sent to sign in.
 */
export default function MoreInfo(props: { refId: string; signedIn: boolean }) {
  return <QueryProvider><Inner {...props} /></QueryProvider>;
}

function Inner({ refId, signedIn }: { refId: string; signedIn: boolean }) {
  const t = useT();
  const [text, setText] = useState("");
  const [short, setShort] = useState(false);
  const send = useMutation({ mutationFn: () => sendMoreInfo(refId, text.trim()) });
  if (!signedIn) {
    return <Card title={t.rxMoreTitle}><Link href={`/login?need=1&next=${encodeURIComponent(`/issue/${refId}`)}`} className="inline-flex min-h-11 items-center text-civic underline">{t.rxMoreSignIn}</Link></Card>;
  }
  if (send.isSuccess) return <Card title={t.rxMoreTitle}><p role="status">{t.rxMoreSent}</p></Card>;
  return (
    <Card title={t.rxMoreTitle}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (text.trim().length < 5) { setShort(true); return; } setShort(false); send.mutate(); }}>
        <p className="text-muted">{t.rxMoreBody}</p>
        <Textarea label={t.rxMoreLabel} rows={4} maxLength={2000} value={text} error={short ? t.rxMoreShort : undefined} onChange={(e) => setText(e.target.value)} />
        {send.isError && <p role="alert" className="text-sm text-danger">{t.rxMoreFail}</p>}
        <Button type="submit" loading={send.isPending}>{t.rxMoreSend}</Button>
      </form>
    </Card>
  );
}
