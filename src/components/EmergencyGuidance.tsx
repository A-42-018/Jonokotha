"use client";
import type { ReactNode } from "react";
import type { Lang } from "@/lib/i18n";
import type { Emergency } from "@/lib/types";
import { useT } from "./ui/useT";

/**
 * Shown INSTEAD of the normal success screen when the server flags imminent harm (self harm, violence, a child in danger).
 * The guidance text is the server's fixed text, shown as given and never rewritten or replaced by model text. Numbers are
 * large tap-to-call links. The saved report is mentioned second, with the honest line that this is not an emergency service.
 */
export default function EmergencyGuidance({ emergency, lang, refId, children }: { emergency: Emergency; lang: Lang; refId?: string; children?: ReactNode }) {
  const t = useT(lang);
  return (
    <section role="alert" aria-labelledby="em-title" className="mx-auto max-w-md space-y-4">
      <h1 id="em-title" className="text-2xl font-semibold text-danger">{t.emTitle}</h1>
      <p className="text-muted">{t.emLead}</p>
      <div className="rounded-xl border-2 border-danger bg-white p-4">
        <p className="text-lg font-semibold text-danger">{emergency.guidance[lang]}</p>
      </div>
      <ul aria-label={t.emNumbersLabel} className="grid gap-3">
        {emergency.numbers.map((n) => (
          <li key={n}>
            <a href={`tel:${n}`} className="flex min-h-14 items-center justify-center gap-3 rounded-xl bg-danger px-5 text-xl font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic">
              <span>{t.emCall}</span><span dir="ltr">{n}</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">{t.emSaved}</p>
      {refId && <p className="text-sm">{t.emSavedRef} <b className="select-all break-all">{refId}</b></p>}
      {children}
    </section>
  );
}
