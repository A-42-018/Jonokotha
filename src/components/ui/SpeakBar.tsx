"use client";
import Button from "@/components/ui/Button";
import { useLang } from "@/components/ui/useLang";
import { usePersonalModes } from "@/components/ui/usePersonalization";
import { useT } from "@/components/ui/useT";
import { useSpeech } from "@/components/report/useSpeech";
import { country } from "@/lib/country";
import { appendTranscript } from "@/lib/speech";

/**
 * Speak-to-write for a text box: final phrases are appended to the text, which stays editable; typing always works.
 * In voice-first mode (F5.15) it is the large primary button, placed above the box by the caller.
 */
export default function SpeakBar({ onText }: { onText: (add: (prev: string) => string) => void }) {
  const t = useT();
  const lang = useLang();
  const [modes] = usePersonalModes();
  const speech = useSpeech(country().speechLocale[lang], (text) => onText((prev) => appendTranscript(prev, text)));
  const big = modes.voiceFirst;
  return (
    <div className="space-y-2" data-voice-first={big || undefined}>
      {speech.listening
        ? <Button variant="danger" size={big ? "lg" : undefined} full={big} icon={<span aria-hidden>⏹</span>} onClick={speech.stop}>{t.vStop}</Button>
        : <Button variant={big ? "primary" : "secondary"} size={big ? "lg" : undefined} full={big} icon={<span aria-hidden>🎤</span>} onClick={speech.start}>{t.pzAskSpeak}</Button>}
      {speech.listening && (
        <div role="status" aria-live="polite" className="rounded-xl border border-civic/30 bg-white p-3 text-sm">
          <p className="font-medium text-civic"><span aria-hidden>🎤 </span>{t.vLive}</p>
          <p className="mt-1 min-h-6 text-foreground">{speech.interim || t.vLiveEmpty}</p>
        </div>
      )}
      {speech.problem && (
        <p role="alert" className="rounded-xl border border-amber/60 bg-amber/10 p-3 text-sm">
          {speech.problem === "unsupported" ? t.speakUnsupported : speech.problem === "denied" ? t.vDenied : speech.problem === "silence" ? t.vSilence : speech.problem === "network" ? t.vNetwork : t.vOther}
        </p>
      )}
      {!speech.problem && <p className="jk-more text-sm text-muted">{t.vHint}</p>}
    </div>
  );
}
