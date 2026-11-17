import type { ReactNode } from "react";
import type { Dict } from "@/lib/i18n";

/** Admin page frame: heading and lead (the side menu lives in app/admin/layout.tsx). Role is checked by each page (guardAdmin). */
export default function AdminShell({ title, lead, children }: { t?: Dict; title: string; lead?: string; current?: string; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-civic">{title}</h1>
      {lead && <p className="text-muted">{lead}</p>}
      {children}
    </div>
  );
}
