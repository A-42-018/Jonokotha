"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/types";
import type { Dict, Lang } from "@/lib/i18n";

type SR = { new (): { lang: string; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; start(): void } };

export default function ReportForm({ t, lang }: { t: Dict; lang: Lang }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<{ title: string; category: string; description: string; area: string } | null>(null);
  const [busy, setBusy] = useState<"" | "draft" | "submit">("");
  const [listening, setListening] = useState(false);

  function speak() {
    const w = window as unknown as { SpeechRecognition?: SR; webkitSpeechRecognition?: SR };
    const Rec = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Rec) return;
    const r = new Rec();
    r.lang = lang === "bn" ? "bn-BD" : "en-US";
    r.onresult = (e) => setText((p) => `${p} ${e.results[0][0].transcript}`.trim());
    r.onend = () => setListening(false);
    setListening(true);
    r.start();
  }

  async function makeDraft() {
    setBusy("draft");
    const res = await fetch("/api/intake", { method: "POST", body: JSON.stringify({ text }) });
    if (res.ok) setDraft((await res.json()).draft);
    setBusy("");
  }

  async function submit() {
    setBusy("submit");
    const res = await fetch("/api/cases", { method: "POST", body: JSON.stringify(draft) });
    if (res.ok) router.push(`/issue/${(await res.json()).ref}`);
    else setBusy("");
  }

  const input = "w-full rounded-lg border border-slate-300 bg-white p-3";
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-civic">{t.reportTitle}</h1>
      <p className="text-slate-600">{t.reportHint}</p>
      <textarea className={input} rows={5} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex gap-3">
        <button type="button" onClick={speak} className="rounded-lg border border-teal px-4 py-2 text-teal">{listening ? t.listening : `🎤 ${t.speak}`}</button>
        <button type="button" disabled={text.trim().length < 3 || busy !== ""} onClick={makeDraft} className="rounded-lg bg-civic px-4 py-2 text-white disabled:opacity-50">{busy === "draft" ? t.drafting : t.draft}</button>
      </div>
      {draft && (
        <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-amber-800">{t.aiNote}</p>
          <label className="block text-sm">{t.fTitle}<input className={input} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
          <label className="block text-sm">{t.fCategory}
            <select className={input} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{t.cats[c]}</option>)}
            </select>
          </label>
          <label className="block text-sm">{t.fDescription}<textarea className={input} rows={4} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
          <label className="block text-sm">{t.fArea}<input className={input} value={draft.area} onChange={(e) => setDraft({ ...draft, area: e.target.value })} /></label>
          <button type="button" disabled={busy !== ""} onClick={submit} className="w-full rounded-lg bg-leaf px-4 py-3 font-medium text-white disabled:opacity-50">{busy === "submit" ? t.submitting : t.submit}</button>
        </div>
      )}
    </div>
  );
}
