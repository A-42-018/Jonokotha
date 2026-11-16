import type { ReactNode } from "react";
import type { Dict } from "@/lib/i18n";

/** Admin page frame: heading (the side menu lives in app/admin/layout.tsx) and the sample-data notice. Role is checked by each page (guardAdmin). */
export default function AdminShell({ t, title, lead, sample = true, children }: { t: Dict; title: string; lead?: string; sample?: boolean; current?: string; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-civic">{title}</h1>
      {lead && <p className="text-muted">{lead}</p>}
      {sample && <p className="rounded-xl border border-amber/60 bg-amber/10 p-3 text-sm">{t.adSampleBanner}</p>}
      {children}
    </div>
  );
}
