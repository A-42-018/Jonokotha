import type { ReactNode } from "react";
import CapabilityLabel from "./CapabilityLabel";

/**
 * Stands in for a feature that is planned or not switched on at the server (F5.13). It is text only: no button,
 * no input, nothing that looks pressable. A link back to something that works may be passed as `children`.
 */
export default function PlannedPanel({ title, body, as: Heading = "h2", children, id }: { title: string; body: string; as?: "h1" | "h2" | "h3"; children?: ReactNode; id?: string }) {
  return (
    <section id={id} data-planned className="flex flex-col items-start gap-2 rounded-2xl border border-dashed border-line bg-slate-50 p-4">
      <CapabilityLabel status="planned" />
      <Heading className="text-lg font-semibold text-slate-800">{title}</Heading>
      <p className="text-muted">{body}</p>
      {children}
    </section>
  );
}
