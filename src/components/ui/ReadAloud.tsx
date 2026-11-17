"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { FLAGS } from "@/lib/flags-more";
import { browserCanSpeak, chunk, fetchAudio, fetchSpeakInfo, hasVoice, speechLang, SERVER_MAX } from "@/lib/readaloud";
import Button from "./Button";
import { useLang } from "./useLang";
import { useT } from "./useT";

type State = "idle" | "loading" | "playing" | "novoice" | "fail";

/**
 * "শুনুন": reads a piece of text on the screen aloud (F7.9). Behind the `readAloud` flag; draws nothing when the flag is off or the device cannot speak.
 * It speaks only the text it is given. The server voice is tried first when the server says it has one; otherwise the browser's own voice is used.
 */
export default function ReadAloud({ text, what }: { text: string; what: string }) {
  const t = useT();
  const lang = useLang();
  const [state, setState] = useState<State>("idle");
  const can = useSyncExternalStore(() => () => {}, () => browserCanSpeak(), () => false);   // false on the server and first paint, then what this device can do
  const run = useRef(0);                       // bumped on stop, so a late answer cannot start speaking
  const audio = useRef<HTMLAudioElement | null>(null);
  const on = FLAGS.readAloud && text.trim().length > 0;

  useEffect(() => () => { run.current++; window.speechSynthesis?.cancel(); audio.current?.pause(); }, []);

  function stop() {
    run.current++;
    window.speechSynthesis?.cancel();
    audio.current?.pause();
    setState("idle");
  }

  async function play() {
    const id = ++run.current;
    const alive = () => run.current === id;
    setState("loading");
    const info = await fetchSpeakInfo();
    const tag = speechLang(lang);
    if (info.available) {
      const parts = chunk(text, Math.min(info.max_chars ?? SERVER_MAX, SERVER_MAX));
      let ok = true;
      for (const part of parts) {
        if (!alive()) return;
        const blob = await fetchAudio(part, lang);
        if (!blob) { ok = false; break; }
        if (!alive()) return;
        setState("playing");
        const done = await new Promise<boolean>((resolve) => {
          const a = new Audio(URL.createObjectURL(blob));
          audio.current = a;
          a.onended = () => resolve(true);
          a.onerror = () => resolve(false);
          void a.play().catch(() => resolve(false));
        });
        if (!done) { ok = false; break; }
      }
      if (ok) { if (alive()) setState("idle"); return; }
    }
    if (!alive()) return;
    if (!browserCanSpeak()) { setState("fail"); return; }
    const synth = window.speechSynthesis;
    if (!hasVoice(synth.getVoices(), tag)) { setState("novoice"); return; }
    const parts = chunk(text, 220);
    setState("playing");
    parts.forEach((part, i) => {
      const u = new SpeechSynthesisUtterance(part);
      u.lang = tag;
      if (i === parts.length - 1) u.onend = () => { if (alive()) setState("idle"); };
      u.onerror = () => { if (alive()) setState("fail"); };
      synth.speak(u);
    });
  }

  if (!on || !can) return null;
  const busy = state === "playing" || state === "loading";
  const shown = state === "loading" ? t.raLoading : busy ? t.raStop : t.raListen;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {/* The accessible name starts with the visible words (WCAG 2.5.3) and adds what is read. */}
      <Button variant="ghost" aria-label={`${shown}: ${what}`} aria-pressed={busy} onClick={() => (busy ? stop() : void play())}>
        <span aria-hidden>{busy ? "■" : "🔊"}</span> {shown}
      </Button>
      {state === "novoice" && <span role="status" className="text-sm text-muted">{t.raNoVoice}</span>}
      {state === "fail" && <span role="alert" className="text-sm text-danger">{t.raFail}</span>}
    </span>
  );
}
