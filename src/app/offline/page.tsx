import { getLang } from "@/lib/i18n";

export default async function Offline() {
  const bn = (await getLang()) === "bn";
  return (
    <div className="space-y-4 py-8 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/illustrations/state-offline.svg" alt="" className="mx-auto w-56" />
      <h1 className="text-2xl font-semibold text-civic">{bn ? "ইন্টারনেট নেই" : "You are offline"}</h1>
      <p className="text-slate-600">{bn ? "সংযোগ ফিরলে আবার চেষ্টা করুন।" : "Please try again when you are back online."}</p>
    </div>
  );
}
