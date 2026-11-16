"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getRecognizer, speechProblem, type Recognizer, type SpeechProblem } from "@/lib/speech";

export type SpeechState = { listening: boolean; interim: string; problem: SpeechProblem | "unsupported" | null };

/**
 * Browser speech recognition (bn-BD / en-US). Final phrases go to `onFinal`; the in-progress phrase is
 * exposed as `interim` for a live transcript. Nothing starts until `start()` (a user click).
 * Typing always remains available as the fallback. Audio handling is the browser's; the app stores no audio.
 */
export function useSpeech(bcp47: string, onFinal: (text: string) => void) {
  const [state, setState] = useState<SpeechState>({ listening: false, interim: "", problem: null });
  const rec = useRef<Recognizer | null>(null);
  const cb = useRef(onFinal);
  useEffect(() => { cb.current = onFinal; });
  useEffect(() => () => rec.current?.stop(), []);

  const start = useCallback(() => {
    const Rec = getRecognizer();
    if (!Rec) { setState({ listening: false, interim: "", problem: "unsupported" }); return; }
    const r = new Rec();
    r.lang = bcp47;
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (e.results[i].isFinal) cb.current(text); else interim += text;
      }
      setState((s) => ({ ...s, interim }));
    };
    r.onerror = (e) => setState((s) => ({ ...s, problem: speechProblem(e.error) ?? s.problem }));
    r.onend = () => { rec.current = null; setState((s) => ({ ...s, listening: false, interim: "" })); };
    rec.current = r;
    setState({ listening: true, interim: "", problem: null });
    try { r.start(); } catch { setState({ listening: false, interim: "", problem: "other" }); }
  }, [bcp47]);

  const stop = useCallback(() => rec.current?.stop(), []);
  return { ...state, start, stop };
}
