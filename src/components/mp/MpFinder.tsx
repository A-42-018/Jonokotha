"use client";
import { useT } from "@/components/ui/useT";
import QueryProvider from "../QueryProvider";
import AreaPicker from "./AreaPicker";

export default function MpFinder() {
  return <QueryProvider><FinderInner /></QueryProvider>;
}

/** "আপনার এমপি কে?" Works without an account. The picker shows every possible constituency when unsure and the citizen confirms. */
function FinderInner() {
  const t = useT();
  return (
    <AreaPicker mode="find" intro={
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img loading="lazy" decoding="async" src="/illustrations/spot-find-mp.svg" alt="" className="hidden size-24 sm:block" />
        <div>
          <h1 className="text-2xl font-semibold text-civic">{t.mpFindTitle}</h1>
          <p className="text-muted">{t.mpFindLead}</p>
        </div>
      </div>
    } />
  );
}
