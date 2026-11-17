"use client";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Dialog from "@/components/ui/Dialog";
import { useLang } from "@/components/ui/useLang";
import { useLocalValue } from "@/components/ui/useLocalValue";
import { useT } from "@/components/ui/useT";
import { MY_AREA_KEY, type MyArea } from "@/lib/areas-api";
import { fillNum } from "@/lib/format";
import AreaPicker from "@/components/mp/AreaPicker";
import QueryProvider from "@/components/QueryProvider";

/** Profile: the citizen's own area, chosen with the same picker as Find your MP. Kept on this device until the server can store it (B5.7). */
export default function MyAreaCard() {
  const t = useT();
  const lang = useLang();
  const [mine, setMine] = useLocalValue<MyArea | null>(MY_AREA_KEY, null);
  const [open, setOpen] = useState(false);
  return (
    <Card title={t.arMyAreaTitle}>
      {mine ? (
        <div className="space-y-1">
          <p className="font-medium">{fillNum(t.arSaved, { name: lang === "bn" ? mine.name_bn : mine.name_en }, lang)}</p>
          <p className="text-sm text-muted">{t.arSavedHere}</p>
        </div>
      ) : <p className="text-muted">{t.arNoneSaved}</p>}
      <div className="mt-3 flex flex-wrap gap-3">
        <Button variant="secondary" onClick={() => setOpen(true)}>{mine ? t.arMyAreaOpen : t.arMyAreaPick}</Button>
        {mine && <Button variant="ghost" onClick={() => setMine(null)}>{t.arClear}</Button>}
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title={t.arTitle} description={t.arLead}
        actions={<Button variant="ghost" onClick={() => setOpen(false)}>{t.arClose}</Button>}>
        {open && (
          <QueryProvider>
            <AreaPicker mode="choose" onConfirm={(m) => { setMine({ key: m.constituency.key, name_bn: m.constituency.name_bn, name_en: m.constituency.name_en, sample: m.constituency.is_demo }); setOpen(false); }} />
          </QueryProvider>
        )}
      </Dialog>
    </Card>
  );
}
