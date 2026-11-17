"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { RadioGroup } from "@/components/ui/Choice";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { ApiError } from "@/lib/api-client";
import { fetchProjectFeedback, sendProjectFeedback } from "@/lib/commitments-api";
import { fillNum, fmtNum } from "@/lib/format";
import { writeProblem } from "@/lib/r11";

/** Feedback once a project is completed (B5.5, F5.10 gap closed in F7.7). The average shows from 5 answers; one answer per verified account. */
export default function ProjectFeedback({ refId, signedIn, loginHref }: { refId: string; signedIn: boolean; loginHref: string }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const name = useId();
  const q = useQuery({ queryKey: ["project-feedback", refId], queryFn: () => fetchProjectFeedback(refId), retry: false });
  const [rating, setRating] = useState("");
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState<"sent" | "again" | null>(null);
  const key = useRef(crypto.randomUUID());
  const send = useMutation({
    mutationFn: () => sendProjectFeedback(refId, Number(rating), comment, key.current),
    onSuccess: () => { setDone("sent"); toast("success", t.pfSent); void qc.invalidateQueries({ queryKey: ["project-feedback", refId] }); },
    onError: (e) => { key.current = crypto.randomUUID(); const p = writeProblem(e); if (p === "again") setDone("again"); else setMsg(p === "auth" ? t.r1AuthMsg : e instanceof ApiError && e.status === 409 ? t.pfNotHere : t.pfFail); },
  });
  if (q.isError && q.error instanceof ApiError && (q.error.status === 404 || q.error.status === 501)) return null;
  const s = q.data;
  return (
    <Card as="section" title={t.pfTitle}>
      <p className="mb-2">{t.pfLead}</p>
      {s && (s.average_rating !== null ? <p className="mb-2 font-medium">{fillNum(t.pfAvg, { avg: fmtNum(Math.round(s.average_rating * 10) / 10, lang), n: s.feedback_count }, lang)}</p> : <p className="mb-2 text-sm text-muted">{fillNum(t.pfFew, { n: s.feedback_count }, lang)}</p>)}
      {done ? <p role="status">{done === "sent" ? t.pfSent : t.pfAgain}</p> : !signedIn ? <Link href={loginHref} className="inline-flex min-h-11 items-center text-civic underline">{t.pfSignIn}</Link> : (
        <form noValidate onSubmit={(e) => { e.preventDefault(); if (!rating) { setMsg(t.pfNeedRating); return; } setMsg(""); send.mutate(); }} className="space-y-3">
          <RadioGroup legend={t.pfPick} name={name} value={rating} onChange={setRating} options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: fillNum(t.pfScore, { n }, lang) }))} />
          <Textarea label={t.pfComment} optional rows={3} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />
          {msg && <p role="alert" className="text-sm text-danger">{msg}</p>}
          <Button type="submit" loading={send.isPending}>{t.pfSend}</Button>
        </form>
      )}
    </Card>
  );
}
