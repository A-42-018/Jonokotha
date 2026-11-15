"use client";
import { useEffect, useRef, useState } from "react";
import { CATEGORIES } from "@/lib/types";
import type { Dict, Lang } from "@/lib/i18n";
import ReportSuccess from "./ReportSuccess";

type Draft = { title: string; category: string; description: string; area: string };
type Field = keyof Draft;

const DRAFT_KEY = "jonokotha:report-draft:v1";
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

// Phone (BD mobile, with or without +880) or a long digit run (NID, passport, bank-like numbers).
export function hasPersonalNumber(raw: string) {
  const s = raw.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
  if (/(?:\+?880|0)\s*1[3-9](?:[\s-]?\d){8}/.test(s)) return true;
  return /\d(?:[\s-]?\d){9,}/.test(s);
}

type SR = { new (): { lang: string; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; start(): void } };

export default function ReportForm({ t, lang, constituencyId }: { t: Dict; lang: Lang; constituencyId: string }) {
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [edited, setEdited] = useState<Field[]>([]);
  const [sentRef, setSentRef] = useState("");
  const [restored, setRestored] = useState(false);
  const loaded = useRef(false);
  const [busy, setBusy] = useState<"" | "draft" | "submit">("");
  const [listening, setListening] = useState(false);

  // Recover an interrupted draft once on mount, then autosave every change.
  useEffect(() => {
    const id = setTimeout(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as { text?: string; draft?: Draft | null; edited?: Field[] };
        if (d.text || d.draft) {
          setText(d.text ?? "");
          setDraft(d.draft ?? null);
          setEdited(d.edited ?? []);
          setRestored(true);
        }
      }
    } catch { /* storage unavailable or corrupt: start empty */ }
    loaded.current = true;
    }, 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      if (!text && !draft) localStorage.removeItem(DRAFT_KEY);
      else localStorage.setItem(DRAFT_KEY, JSON.stringify({ text, draft, edited }));
    } catch { /* ignore */ }
  }, [text, draft, edited]);

  function clearDraft() {
    setText(""); setDraft(null); setEdited([]); setRestored(false);
  }

  function editField(k: Field, v: string) {
    setDraft((d) => (d ? { ...d, [k]: v } : d));
    setEdited((e) => (e.includes(k) ? e : [...e, k]));
  }

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
    if (res.ok) { setDraft((await res.json()).draft); setEdited([]); }
    setBusy("");
  }

  async function submit() {
    setBusy("submit");
    const res = await fetch("/api/cases", { method: "POST", body: JSON.stringify({ ...draft, constituencyId }) });
    if (res.ok) {
      const { ref } = await res.json();
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      setSentRef(ref);
      setBusy("");
    } else setBusy("");
  }

  const input = "w-full rounded-lg border border-slate-300 bg-white p-3";
  const warn = hasPersonalNumber(`${text} ${draft ? `${draft.title} ${draft.description} ${draft.area}` : ""}`);
  const badge = (k: Field) => (
    <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${edited.includes(k) ? "bg-slate-100 text-slate-700" : "bg-amber-100 text-amber-900"}`}>
      {edited.includes(k) ? t.editedBadge : `✨ ${t.aiBadge}`}
    </span>
  );

  if (sentRef) return <ReportSuccess t={t} refId={sentRef} onAnother={() => { setSentRef(""); clearDraft(); }} />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-civic">{t.reportTitle}</h1>
      <p className="text-slate-600">{t.reportHint}</p>
      {restored && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-sky-50 p-3 text-sm text-civic">
          <span>{t.draftRestored}</span>
          <button type="button" onClick={clearDraft} className="min-h-11 px-2 underline">{t.draftDiscard}</button>
        </div>
      )}
      <textarea className={input} rows={5} value={text} onChange={(e) => setText(e.target.value)} aria-label={t.reportTitle} />
      {warn && (
        <div role="alert" className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">⚠ {t.privacyWarnTitle}</p>
          <p>{t.privacyWarnBody}</p>
        </div>
      )}
      <div className="flex gap-3">
        <button type="button" onClick={speak} className="min-h-11 rounded-lg border border-teal px-4 py-2 text-teal">{listening ? t.listening : `🎤 ${t.speak}`}</button>
        <button type="button" disabled={text.trim().length < 3 || busy !== ""} onClick={makeDraft} className="min-h-11 rounded-lg bg-civic px-4 py-2 text-white disabled:opacity-50">{busy === "draft" ? t.drafting : t.draft}</button>
      </div>
      {draft && (
        <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-amber-800">{t.aiNote}</p>
          <label className="block text-sm">{t.fTitle}{badge("title")}<input className={input} value={draft.title} onChange={(e) => editField("title", e.target.value)} /></label>
          <label className="block text-sm">{t.fCategory}{badge("category")}
            <select className={input} value={draft.category} onChange={(e) => editField("category", e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{t.cats[c]}</option>)}
            </select>
          </label>
          <label className="block text-sm">{t.fDescription}{badge("description")}<textarea className={input} rows={4} value={draft.description} onChange={(e) => editField("description", e.target.value)} /></label>
          <label className="block text-sm">{t.fArea}{badge("area")}<input className={input} value={draft.area} onChange={(e) => editField("area", e.target.value)} /></label>
          <p className="text-xs text-slate-600">{t.draftSaved}</p>
          <button type="button" disabled={busy !== ""} onClick={submit} className="min-h-11 w-full rounded-lg bg-leaf px-4 py-3 font-medium text-white disabled:opacity-50">{busy === "submit" ? t.submitting : t.submit}</button>
        </div>
      )}
    </div>
  );
}
