import { Skeleton as SkeletonBlock } from "@/components/ui/Skeleton";
import { dict, getLang } from "@/lib/i18n";

export default async function Loading() {
  const t = dict[await getLang()];
  return (
    <div role="status" aria-busy="true" className="space-y-4">
      <span className="sr-only">{t.stLoading}</span>
      <SkeletonBlock className="h-40 w-full" />
      <SkeletonBlock className="h-7 w-3/4" />
      <div className="grid gap-4 sm:grid-cols-2">
        <SkeletonBlock className="h-28" />
        <SkeletonBlock className="h-28" />
      </div>
      <SkeletonBlock className="h-16 w-full" />
      <SkeletonBlock className="h-16 w-full" />
    </div>
  );
}
