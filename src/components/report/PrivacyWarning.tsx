import type { Dict } from "@/lib/i18n";
import Card from "../ui/Card";

/** Shown when the text looks like it contains a phone or ID number. Does not block submitting. */
export default function PrivacyWarning({ t }: { t: Dict }) {
  return (
    <Card tone="warning" padded className="text-sm">
      <div role="alert">
        <p className="font-semibold text-amber-900">⚠ {t.privacyWarnTitle}</p>
        <p>{t.privacyWarnBody}</p>
      </div>
    </Card>
  );
}
