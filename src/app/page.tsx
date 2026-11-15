import Link from "next/link";
import { dict, getLang } from "@/lib/i18n";

export default async function Home() {
  const t = dict[await getLang()];
  return (
    <div className="space-y-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/illustrations/hero-mobile.svg" alt="" className="mx-auto w-full max-w-md rounded-2xl" />
      <h1 className="text-3xl font-semibold text-civic">{t.tagline}</h1>
      <div className="flex flex-col items-center gap-3">
        <Link href="/report" className="w-full max-w-xs rounded-xl bg-civic px-6 py-3 text-lg font-medium text-white">{t.reportCta}</Link>
        <Link href="/office" className="text-civic underline">{t.officeCta}</Link>
      </div>
    </div>
  );
}
