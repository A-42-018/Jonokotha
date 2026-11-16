import { notFound } from "next/navigation";
import UiGallery from "@/components/ui/UiGallery";
import { dict, getLang } from "@/lib/i18n";

// Review-only page: it does not exist in production builds.
export default async function DevUi() {
  if (process.env.NODE_ENV === "production") notFound();
  const t = dict[await getLang()];
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold text-civic">{t.dev.title}</h1>
      <p className="text-muted">{t.dev.intro}</p>
      <UiGallery />
    </div>
  );
}
