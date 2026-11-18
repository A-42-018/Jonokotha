/** Shared by the chat route and the panel: what a reply from Dadu looks like. Client-safe (no zod, no server imports). */
export type Lang = "bn" | "en";
export type Bi = { bn: string; en: string };
export type Mood = "idle" | "greet" | "think" | "talk" | "happy" | "sorry";

export type Block =
  | { type: "text"; text: string }
  | { type: "chips"; items: { label: string; send: string }[] }
  /** A same-site page. `href` always comes from a fixed table, never from what a person typed. */
  | { type: "link"; href: string; label: string }
  /** Voice only: the panel shows "going to …" for two seconds with Cancel, then opens `href`. */
  | { type: "navigate"; href: string; label: string; say: string }
  | { type: "handoff"; links: { href: string; label: string }[] }
  | { type: "emergency"; text: string; numbers: string[] };

export interface ChatTurn { role: "user" | "bot"; text: string }
export interface ChatRequest { messages: ChatTurn[]; lang: Lang; page: string; voice: boolean }
export interface ChatResponse {
  blocks: Block[];
  intent: string;
  confidence: number;
  source: "rules" | "kb" | "emergency" | "ai";
  lang: Lang;
  mood: Mood;
}
