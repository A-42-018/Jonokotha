"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Button from "@/components/ui/Button";
import { useT } from "@/components/ui/useT";
import { chunk, speechLang } from "@/lib/readaloud";
import { speakableBangla } from "@/lib/helper/speech-text";
import type { Lang } from "@/lib/helper/types";

/**
 * "শুনুন" under an answer: reads the answer aloud in Dadu's male voice.
 *  1. the server voice (Azure, `POST /api/v1/helper/speech`) when `GET` says it is there; the text is cleaned of personal details on the server first;
 *  2. otherwise the browser's own voice, but for Bangla ONLY a real bn-BD voice (an Indian-accented Bangla voice sounds wrong to a Bangladeshi listener);
 *  3. with neither, no button is drawn at all.
 * One voice at a time on the page. The button never reads link cards or chips (they are outside the text it is given).
 */
let stopActive: (() => void) | null = null;
let serverVoice: Promise<boolean> | null = null;
const askServer = (): Promise<boolean> => (serverVoice ??= fetch("/api/v1/helper/speech").then((r) => (r.ok ? r.json() : null)).then((j: { data?: { available?: boolean } } | null) => j?.data?.available === true).catch(() => false));

const MALE = /(male(?!.*female)|david|daniel|alex|mark|george|guy|prabhat|pradeep|ravi|rishi|james|oliver|fred)/i;
function browserVoice(lang: Lang): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const tag = speechLang(lang).toLowerCase();
  const all = window.speechSynthesis.getVoices();
  const ok = all.filter((v) => { const l = v.lang.toLowerCase().replace("_", "-"); return lang === "bn" ? l === tag : l.startsWith("en"); });
  return ok.find((v) => MALE.test(v.name)) ?? ok[0] ?? null;
}
const subscribeVoices = (cb: () => void) => { if (typeof window === "undefined" || !("speechSynthesis" in window)) return () => {}; window.speechSynthesis.addEventListener("voiceschanged", cb); return () => window.speechSynthesis.removeEventListener("voiceschanged", cb); };

export default function DaduSpeak({ text, lang, auto = false }: { text: string; lang: Lang; auto?: boolean }) {
  const t = useT();
  const [server, setServer] = useState<boolean | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const hasBrowser = useSyncExternalStore(subscribeVoices, () => !!browserVoice(lang), () => false);
  const run = useRef(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => { let live = true; void askServer().then((v) => live && setServer(v)); return () => { live = false; }; }, []);
  useEffect(() => () => { run.current++; audio.current?.pause(); if (typeof window !== "undefined") window.speechSynthesis?.cancel(); }, []);

  function stop() { run.current++; audio.current?.pause(); window.speechSynthesis?.cancel(); setState("idle"); }

  function viaBrowser(id: number) {
    const v = browserVoice(lang);
    if (!v) { setState("idle"); return; }
    const u = new SpeechSynthesisUtterance(lang === "bn" ? speakableBangla(text) : text);
    u.voice = v; u.lang = v.lang; u.rate = 0.95;
    u.onend = u.onerror = () => { if (run.current === id) setState("idle"); };
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
    setState("playing");
  }

  async function play() {
    stopActive?.();
    const id = ++run.current;
    stopActive = stop;
    if (!server) { viaBrowser(id); return; }
    setState("loading");
    const parts = chunk(text, 220);
    const fetchClip = async (s: string): Promise<string | null> => {
      for (let a = 0; a < 2; a++) {
        try {
          const r = await fetch("/api/v1/helper/speech", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: s, lang }) });
          if (r.ok && (r.headers.get("Content-Type") ?? "").startsWith("audio/")) return URL.createObjectURL(await r.blob());
        } catch { /* retry once */ }
      }
      return null;
    };
    let next = fetchClip(parts[0]);
    for (let i = 0; i < parts.length; i++) {
      const url = await next;
      if (run.current !== id) { if (url) URL.revokeObjectURL(url); return; }
      if (!url) { if (i === 0) { viaBrowser(id); return; } break; }       // a later clip that fails is skipped; a failed first clip falls back to the browser voice
      next = i + 1 < parts.length ? fetchClip(parts[i + 1]) : Promise.resolve(null);
      const a = new Audio(url);
      audio.current = a;
      setState("playing");
      await new Promise<void>((done) => { a.onended = a.onerror = () => done(); a.play().catch(() => done()); });
      URL.revokeObjectURL(url);
      if (run.current !== id) return;
    }
    if (run.current === id) setState("idle");
  }

  // After a spoken question the answer is read out once, as soon as it is known whether any voice exists (the microphone press was the person's gesture).
  const started = useRef(false);
  useEffect(() => { if (auto && !started.current && server !== null && (server || hasBrowser) && text.trim()) { started.current = true; void play(); } }); // eslint-disable-line react-hooks/exhaustive-deps

  if (!text.trim() || server === null || (!server && !hasBrowser)) return null;
  return (
    <Button variant="ghost" type="button" onClick={() => (state === "idle" ? void play() : stop())} aria-pressed={state !== "idle"}>
      <span aria-hidden>{state === "idle" ? "🔊" : "⏹"}</span> {state === "idle" ? t.ddSpeak : state === "loading" ? t.ddSpeakLoading : t.ddSpeakStop}
    </Button>
  );
}
