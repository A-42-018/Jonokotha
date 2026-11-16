import Link from "next/link";
import Card from "@/components/ui/Card";
import { dict, getLang } from "@/lib/i18n";

export default async function Method() {
  const t = dict[await getLang()];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-civic">{t.mpMethodTitle}</h1>
      <Card>
        <ul className="list-disc space-y-2 ps-5">
          <li>{t.mpMethodBody1}</li><li>{t.mpMethodBody2}</li><li>{t.mpMethodBody3}</li><li>{t.mpMethodBody4}</li><li>{t.mpMethodBody5}</li>
        </ul>
      </Card>
      <Link href="/mp" className="inline-flex min-h-11 items-center text-civic underline">{t.mpBackFind}</Link>
    </div>
  );
}
