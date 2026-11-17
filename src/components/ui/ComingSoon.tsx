import type { ReactNode } from "react";
import Badge from "./Badge";

/** Full-page "coming soon" state for tabs whose pages are not built yet. Strings come from the caller (i18n). */
export default function ComingSoon({ art, soonLabel, title, body, children }: { art: string; soonLabel: string; title: string; body: string; children?: ReactNode }) {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-3 py-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img loading="lazy" decoding="async" src={`/illustrations/${art}.svg`} alt="" className="w-48 sm:w-56" />
      <Badge tone="info">{soonLabel}</Badge>
      <h1 className="jk-h1">{title}</h1>
      <p className="text-muted">{body}</p>
      {children && <div className="mt-2 flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row">{children}</div>}
    </section>
  );
}
