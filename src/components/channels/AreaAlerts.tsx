"use client";
import { useQuery } from "@tanstack/react-query";
import QueryProvider from "@/components/QueryProvider";
import AsyncBlock from "@/components/ui/AsyncBlock";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { fetchAreaAlerts } from "@/lib/channels-api";
import { fmtDay } from "@/lib/format";

/** Recent alerts from the office for the chosen area (F7.2). Hidden when the server does not have them or there are none. */
export default function AreaAlerts(props: { constituency: string }) {
  return <QueryProvider><Inner {...props} /></QueryProvider>;
}

function Inner({ constituency }: { constituency: string }) {
  const t = useT();
  const lang = useLang();
  const q = useQuery({ queryKey: ["area-alerts", constituency], queryFn: () => fetchAreaAlerts(constituency), retry: false });
  if (q.data?.kind === "planned" || (q.data?.kind === "ok" && q.data.data.length === 0)) return null;
  return (
    <section aria-labelledby="aa-h" className="space-y-2 rounded-2xl border border-amber/60 bg-amber/10 p-4">
      <h2 id="aa-h" className="jk-h2">{t.chpAlertTitle}</h2>
      <AsyncBlock pending={q.isPending} error={q.error} onRetry={() => void q.refetch()}>
        {q.data?.kind === "ok" && (
          <ul className="space-y-2">
            {q.data.data.slice(0, 3).map((a, i) => (
              <li key={a.id ?? i} className="rounded-xl bg-white p-3">
                <p className="break-words font-medium">{lang === "en" && a.title_en ? a.title_en : a.title_bn}</p>
                {a.body && <p className="break-words text-sm">{a.body}</p>}
                <p className="text-xs text-muted">{fmtDay(a.created_at, lang)}</p>
              </li>
            ))}
          </ul>
        )}
      </AsyncBlock>
    </section>
  );
}
