"use client";
import { useId, useSyncExternalStore } from "react";
import Card from "@/components/ui/Card";
import { RadioGroup } from "@/components/ui/Choice";
import { useTheme } from "@/components/ui/useTheme";
import { useT } from "@/components/ui/useT";
import { FLAGS } from "@/lib/flags-more";
import { cleanTheme } from "@/lib/theme";
import ReadAloud from "@/components/ui/ReadAloud";

const subscribe = (cb: () => void) => { const o = new MutationObserver(cb); o.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] }); return () => o.disconnect(); };

/** Settings: page colours (dark mode) and a note about the Listen button (F7.10, F7.9). Each shows only when its flag is on. */
export default function ThemePanel() {
  const t = useT();
  const name = useId();
  const [theme, setTheme] = useTheme();
  const dark = useSyncExternalStore(subscribe, () => document.documentElement.dataset.theme === "dark", () => false);
  if (!FLAGS.darkMode && !FLAGS.readAloud) return null;
  return (
    <>
      {FLAGS.darkMode && (
        <Card as="section" title={t.thTitle}>
          <p className="mb-2 text-muted">{t.thLead}</p>
          <RadioGroup legend={t.thLegend} name={name} value={theme} onChange={(v) => setTheme(cleanTheme(v))} options={[{ value: "system", label: t.thSystem }, { value: "light", label: t.thLight }, { value: "dark", label: t.thDark }]} />
          <p className="mt-2 text-sm text-muted" role="status">{t.thNow.replace("{mode}", dark ? t.thNowDark : t.thNowLight)}</p>
        </Card>
      )}
      {FLAGS.readAloud && (
        <Card as="section" title={t.raSettingsTitle}>
          <p className="mb-2">{t.raSettingsBody}</p>
          <p className="mb-2 text-sm text-muted">{t.raPrivacy}</p>
          <ReadAloud text={t.raSettingsBody} what={t.raSettingsTitle} />
        </Card>
      )}
    </>
  );
}
