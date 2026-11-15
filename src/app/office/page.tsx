import Link from "next/link";
import NoAccess from "@/components/ui/NoAccess";
import State from "@/components/ui/State";
import { dict, getLang } from "@/lib/i18n";
import { listCases } from "@/lib/store";
import { currentUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";


export default async function Office() {
  const t = dict[await getLang()];
  const { sb, user, isStaff } = await currentUser();
  if (!user) redirect("/login?expired=1");
  if (!isStaff) return <NoAccess t={t} />;
  const cases = await listCases(sb);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-civic">{t.queue}</h1>
      {cases.length === 0 && <State kind="officeEmpty" title={t.emptyQueue} as="h2" />}
      <ul className="space-y-2">
        {cases.map((c) => (
          <li key={c.ref}>
            <Link href={`/office/${c.ref}`} className="block rounded-xl bg-white p-4 shadow-sm">
              <div className="flex justify-between text-sm text-slate-500"><span>{c.ref}</span><span>{t.statuses[c.status]}</span></div>
              <div className="font-medium">{c.title}</div>
              <div className="text-sm text-teal">{t.cats[c.category]}</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
