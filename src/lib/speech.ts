export type SpeechProblem = "denied" | "silence" | "network" | "other";

/** Maps a Web Speech API error code to a problem the UI has words for. */
export function speechProblem(code: string | undefined): SpeechProblem | null {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed": return "denied";
    case "no-speech": return "silence";
    case "network": return "network";
    case "aborted": return null; // we stopped it ourselves
    default: return "other";
  }
}

/** Adds a recognised phrase to existing text with one space between. */
export function appendTranscript(base: string, add: string): string {
  const a = add.trim();
  if (!a) return base;
  return base.trim() ? `${base.trimEnd()} ${a}` : a;
}

export interface Recognizer {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  start(): void;
  stop(): void;
}

export function getRecognizer(): (new () => Recognizer) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognizer; webkitSpeechRecognition?: new () => Recognizer };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
