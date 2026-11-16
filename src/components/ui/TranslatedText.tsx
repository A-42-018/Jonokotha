"use client";
import Link from "next/link";
import { useState } from "react";
import Button from "@/components/ui/Button";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { ApiError } from "@/lib/api-client";
import { detectLang, translate } from "@/lib/ai-helpers-api";

type State = { kind: "idle" } | { kind: "busy" } | { kind: "done"; text: string; showing: "translation" | "original" } | { kind: "error"; msg: "trSignIn" | "trFail" | "trOffline" | "trUnavailable" };

/**
 * Public text with "See translation" (F5.14, §17.2). The original is always the text on screen first and one tap away
 * afterwards; a translation is always labelled as a machine translation. It shows nothing when the text is already in the
 * page language. `POST /ai/translate` needs a signed-in account: a visitor gets a sign-in link, not a hidden failure.
 */
export default function TranslatedText({ text, className = "", signedIn, next = "/" }: { text: string; className?: string; signedIn: boolean; next?: string }) {
  const t = useT();
  const page = useLang();
  const [s, setS] = useState<State>({ kind: "idle" });
  const source = detectLang(text);
  const same = source === page;

  async function run() {
    setS({ kind: "busy" });
    try {
      const r = await translate(text, page);
      setS(r.available && r.translation ? { kind: "done", text: r.translation, showing: "translation" } : { kind: "error", msg: "trUnavailable" });
    } catch (e) {
      setS({ kind: "error", msg: e instanceof ApiError && e.status === 401 ? "trSignIn" : e instanceof ApiError && e.isNetwork ? "trOffline" : "trFail" });
    }
  }

  const shown = s.kind === "done" && s.showing === "translation" ? s.text : text;
  return (
    <div className="space-y-1">
      <p className={className} lang={s.kind === "done" && s.showing === "translation" ? page : source}>{shown}</p>
      {!same && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {s.kind === "done" && s.showing === "translation" && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-muted">{t.trLabel}</span>}
          {!signedIn && s.kind === "idle" && <Link href={`/login?need=1&next=${encodeURIComponent(next)}`} className="inline-flex min-h-11 items-center text-civic underline">{t.trSignIn}</Link>}
          {signedIn && (s.kind === "idle" || s.kind === "error") && !(s.kind === "error" && s.msg === "trSignIn") && (
            <Button variant="ghost" onClick={() => void run()}>{t.trShow}</Button>
          )}
          {s.kind === "busy" && <span role="status" className="text-muted">{t.trWorking}</span>}
          {s.kind === "done" && (
            <Button variant="ghost" onClick={() => setS({ ...s, showing: s.showing === "translation" ? "original" : "translation" })}>
              {s.showing === "translation" ? t.trOriginal : t.trShowAgain}
            </Button>
          )}
          {s.kind === "error" && s.msg === "trSignIn" && <Link href={`/login?need=1&next=${encodeURIComponent(next)}`} className="inline-flex min-h-11 items-center text-civic underline">{t.trSignIn}</Link>}
          {s.kind === "error" && s.msg !== "trSignIn" && <span role="alert" className="text-muted">{t[s.msg]}</span>}
        </div>
      )}
    </div>
  );
}
