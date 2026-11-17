import Link from "next/link";
import RepProfile from "@/components/mp/RepProfile";
import { R2 } from "@/lib/flags-r2";
import { dict, getLang } from "@/lib/i18n";

export default async function RepProfilePage({ params }: PageProps<"/mp/[id]">) {
  const { id } = await params;
  const t = dict[await getLang()];
  return (
    <>
      <RepProfile id={id} />
      {R2.mpRecords && /^[0-9a-f-]{36}$/i.test(id) && <p className="mt-4"><Link href={`/mp-records?mp=${encodeURIComponent(id)}`} className="inline-flex min-h-11 items-center text-civic underline">{t.r2MrTitle}</Link></p>}
    </>
  );
}
