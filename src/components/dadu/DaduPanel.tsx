"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { useLang } from "@/components/ui/useLang";
import { useSpeech } from "@/components/report/useSpeech";
import { useT } from "@/components/ui/useT";
import { api, ApiError } from "@/lib/api-client";
import { country } from "@/lib/country";
import { DADU } from "@/lib/flags-dadu";
import { fillNum } from "@/lib/format";
import type { Block, ChatResponse, Mood } from "@/lib/helper/types";
import { starters } from "@/lib/helper/starters";
import DaduAvatar from "./DaduAvatar";
import DaduSpeak from "./DaduSpeak";

type Msg = { id: number; from: "user" | "bot"; text?: string; blocks?: Block[]; source?: ChatResponse["source"]; spoken?: boolean };
type Going = { href: string; label: string; say: string };
const KEY = "jonokotha:dadu:v1";
const GO_MS = 2000;
/** A link the helper draws must be a plain path of this site. The server only ever sends fixed paths, and this checks again. */
const safeHref = (h: string) => /^\/(?!\/)[A-Za-z0-9/_\-?=&.#%]*$/.test(h);

function load(): Msg[] { try { return (JSON.parse(sessionStorage.getItem(KEY) ?? "[]") as Msg[]).map((m) => ({ ...m, spoken: false })); } catch { return []; } }
const textOf = (m: Msg) => m.text ?? (m.blocks?.find((b) => b.type === "text") as { text: string } | undefined)?.text ?? "";

export default function DaduPanel({ page, onClose }: { page: string; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>(load);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [mood, setMood] = useState<Mood>("greet");
  const [going, setGoing] = useState<Going | null>(null);
  const [note, setNote] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = useRef(msgs.reduce((m, x) => Math.max(m, x.id), 0));

  const stopGo = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  useEffect(() => stopGo, []);
  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify(msgs.slice(-20))); } catch { /* private mode */ } log.current?.scrollTo({ top: log.current.scrollHeight }); }, [msgs]);
  useEffect(() => { input.current?.focus(); const m = setTimeout(() => setMood("idle"), 1800); return () => clearTimeout(m); }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") { if (going) { stopGo(); setGoing(null); } else onClose(); } }; document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }, [going, onClose]);

  const go = useCallback((g: Going) => { stopGo(); setGoing(null); if (safeHref(g.href)) { onClose(); router.push(g.href); } }, [router, onClose]);

  const send = useCallback(async (raw: string, voice: boolean) => {
    const text = raw.trim();
    if (!text || busy) return;
    stopGo(); setGoing(null); setNote("");
    const next: Msg[] = [...msgs, { id: ++id.current, from: "user", text }];
    setMsgs(next); setDraft(""); setBusy(true); setMood("think");
    try {
      const turns = next.slice(-10).map((m) => ({ role: m.from, text: textOf(m).slice(0, 500) })).filter((x) => x.text);
      const r = await api<ChatResponse>("/helper/chat", { body: { messages: turns, lang, page, voice } });
      const nav = r.data.blocks.find((b): b is Extract<Block, { type: "navigate" }> => b.type === "navigate");
      setMsgs((p) => [...p, { id: ++id.current, from: "bot", blocks: r.data.blocks.filter((b) => b.type !== "navigate"), source: r.data.source, spoken: voice && !nav }]);
      setMood(r.data.mood);
      if (nav && safeHref(nav.href)) {
        const g = { href: nav.href, label: nav.label, say: nav.say };
        setGoing(g);
        timer.current = setTimeout(() => go(g), GO_MS);
      }
    } catch (e) {
      setNote(e instanceof ApiError ? (e.status === 0 ? t.ddOffline : e.status === 429 ? t.ddLimit : e.status === 404 ? t.ddNotOn : t.ddFail) : t.ddFail);
      setMood("sorry");
    } finally { setBusy(false); setTimeout(() => setMood("idle"), 2600); }
  }, [busy, msgs, lang, page, go, t]);

  const stopMic = useRef<() => void>(() => {});
  const speech = useSpeech(country().speechLocale[lang], (text) => { void send(text, true); stopMic.current(); });
  useEffect(() => { stopMic.current = speech.stop; });
  const problem = speech.problem === "unsupported" ? t.ddUnsupported : speech.problem === "denied" ? t.ddDenied : speech.problem === "silence" ? t.ddSilence : speech.problem === "network" ? t.ddNetwork : speech.problem ? t.ddOther : "";
  const shown = mood === "idle" && speech.listening ? "greet" : mood;

  return (
    <div role="dialog" aria-label={t.ddPanel} className="fixed inset-0 z-[60] flex flex-col bg-white shadow-xl sm:inset-auto sm:bottom-24 sm:end-4 sm:h-[34rem] sm:max-h-[calc(100vh-7rem)] sm:w-[23rem] sm:rounded-2xl sm:border sm:border-slate-200">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-civic/5 p-3 sm:rounded-t-2xl">
        <DaduAvatar mood={shown} size="head" className="h-14 w-14 shrink-0 rounded-full bg-white ring-2 ring-civic/20" />
        <div className="min-w-0 grow"><p className="text-lg font-semibold text-civic">{t.ddName}</p><p className="text-sm text-muted">{t.ddTagline}</p></div>
        <Button variant="ghost" type="button" onClick={() => { setMsgs([]); stopGo(); setGoing(null); setNote(""); }} aria-label={t.ddRestart}><span aria-hidden>↺</span></Button>
        <Button variant="ghost" type="button" onClick={onClose} aria-label={t.ddClose}><span aria-hidden>✕</span></Button>
      </header>

      <div ref={log} role="log" aria-live="polite" className="grow space-y-3 overflow-y-auto p-3">
        <p className="rounded-lg bg-slate-50 p-2 text-sm text-muted">{t.ddDisclosure}</p>
        {msgs.length === 0 && (
          <div className="space-y-2">
            <p><span className="sr-only">{t.ddBot}</span>{lang === "bn" ? "স্বাগতম! আমি জমির দাদু। সমস্যা জানানো, এমপিকে প্রশ্ন বা আইডিয়া নিয়ে জিজ্ঞাসা করুন, ঠিক পাতায় পৌঁছে দেব।" : "Welcome! I am Jomir Dadu. Ask me about reporting a problem, asking your MP or sharing an idea, and I will take you to the right page."}</p>
            <div className="flex flex-wrap gap-2">{starters(page, lang).map((s) => <Button key={s.label} variant="secondary" type="button" onClick={() => void send(s.send, false)}>{s.label}</Button>)}</div>
          </div>
        )}
        {msgs.map((m) => (
          <div key={m.id} className={m.from === "user" ? "flex justify-end" : ""}>
            {m.from === "user" ? (
              <p className="max-w-[85%] rounded-2xl rounded-ee-sm bg-civic px-3 py-2 text-white"><span className="sr-only">{t.ddYou}</span>{m.text}</p>
            ) : (
              <div className="max-w-[92%] space-y-2 rounded-2xl rounded-es-sm bg-slate-100 px-3 py-2">
                <span className="sr-only">{t.ddBot}</span>
                {m.blocks?.map((b, i) => <BlockView key={i} b={b} t={t} onSend={(s) => void send(s, false)} />)}
                {m.source === "ai" && <p data-no-speech className="text-xs text-muted">✨ {t.ddAiNote}</p>}
                <div data-no-speech><DaduSpeak text={textOf(m)} lang={lang} auto={!!m.spoken && m.id === msgs[msgs.length - 1]?.id} /></div>
              </div>
            )}
          </div>
        ))}
        {busy && <p className="text-sm text-muted" role="status">{t.ddThinking}</p>}
        {note && <p role="alert" className="text-danger">{note}</p>}
        {going && (
          <div className="rounded-xl border border-civic/30 bg-civic/5 p-3" data-dadu-going>
            <p className="font-medium">{fillNum(t.ddGoing, { where: going.label }, lang)}</p>
            <p className="text-sm text-muted">{going.say}</p>
            <div className="mt-2 flex gap-2">
              <Button type="button" onClick={() => go(going)}>{t.ddGoNow}</Button>
              <Button type="button" variant="secondary" onClick={() => { stopGo(); setGoing(null); setNote(t.ddCancelled); }}>{t.ddCancel}</Button>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 p-3">
        {DADU.voice && (
          <div className="mb-2 flex items-center gap-2">
            <Button type="button" variant={speech.listening ? "danger" : "secondary"} aria-pressed={speech.listening} onClick={() => (speech.listening ? speech.stop() : speech.start())}>
              <span aria-hidden>{speech.listening ? "⏹" : "🎤"}</span> {speech.listening ? t.ddMicStop : t.ddMic}
            </Button>
            <p className="text-xs text-muted" aria-live="polite">{speech.listening ? (speech.interim || t.ddListening) : problem || t.ddHint}</p>
          </div>
        )}
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(draft, false); }}>
          <label className="grow"><span className="sr-only">{t.ddInput}</span>
            <input ref={input} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500} placeholder={t.ddPlaceholder} autoComplete="off" className="min-h-11 w-full rounded-xl border border-slate-400 px-3 focus-visible:outline-2 focus-visible:outline-civic" />
          </label>
          <Button type="submit" disabled={busy || !draft.trim()}>{t.ddSend}</Button>
        </form>
      </div>
    </div>
  );
}

function BlockView({ b, t, onSend }: { b: Block; t: ReturnType<typeof useT>; onSend: (s: string) => void }) {
  if (b.type === "text") return <p className="whitespace-pre-line">{b.text}</p>;
  if (b.type === "emergency") return <div role="alert" className="rounded-lg border border-danger/40 bg-danger/5 p-2"><p className="font-semibold text-danger">{t.ddEmergency}</p><p>{b.text}</p></div>;
  if (b.type === "link" && safeHref(b.href)) return <p data-no-speech><Link href={b.href} className="inline-flex min-h-11 items-center text-civic underline">{t.ddOpen}: {b.label} →</Link></p>;
  if (b.type === "handoff") return <p data-no-speech className="text-sm">{t.ddHandoff}: {b.links.filter((l) => safeHref(l.href)).map((l, i) => <span key={l.href}>{i > 0 && " · "}<Link href={l.href} className="inline-flex min-h-11 items-center text-civic underline">{l.label}</Link></span>)}</p>;
  if (b.type === "chips") return <div data-no-speech className="flex flex-wrap gap-2">{b.items.map((c) => <Button key={c.label} variant="secondary" type="button" onClick={() => onSend(c.send)}>{c.label}</Button>)}</div>;
  return null;
}
