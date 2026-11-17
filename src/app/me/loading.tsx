import { Skeleton } from "@/components/ui/Skeleton";
import { dict, getLang } from "@/lib/i18n";

export default async function Loading() {
  const t = dict[await getLang()];
  return (
    <div role="status" aria-busy="true" className="space-y-4">
      <span className="sr-only">{t.stLoading}</span>
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-32 w-full" />
      <div className="jk-card p-4 sm:p-5">
        <Skeleton className="mb-4 h-6 w-40" />
        <div className="mb-4 flex flex-wrap gap-2">
          {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-11 w-20 rounded-full" />)}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </div>
    </div>
  );
}
