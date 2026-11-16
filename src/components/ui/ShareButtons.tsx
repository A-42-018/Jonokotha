"use client";
import { buttonClass } from "./Button";
import { shareLinks } from "@/lib/share";
import { useOrigin } from "./useOrigin";
import { useT } from "./useT";

/** WhatsApp and Facebook share links (plain links, no third-party scripts). Rendered after hydration so the URL is absolute. */
export default function ShareButtons({ path, text }: { path: string; text: string }) {
  const t = useT();
  const origin = useOrigin();
  if (!origin) return null;
  const l = shareLinks(origin, path, text);
  return (
    <div className="grid grid-cols-2 gap-2">
      <a href={l.whatsapp} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: "secondary" })}>{t.shWhatsApp}<span className="sr-only"> ({t.shNewTab})</span></a>
      <a href={l.facebook} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: "secondary" })}>{t.shFacebook}<span className="sr-only"> ({t.shNewTab})</span></a>
    </div>
  );
}
