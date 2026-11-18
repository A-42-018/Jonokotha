import { dict, getLang } from "@/lib/i18n";
import { Skeleton } from "./Skeleton";

/** Route-level loading skeleton shaped like the page that is coming: a title, then a list/table or a detail layout. */
export default async function PageLoading({ shape }: { shape: "list" | "detail" }) {
  const t = dict[await getLang()];
  return (
    <div role="status" aria-busy="true" className="min-h-[100svh] space-y-4">
      <span className="sr-only">{t.stLoading}</span>
      <Skeleton className="h-8 w-48" />
      {shape === "list" ? (
        <>
          <Skeleton className="h-11 w-full" />
          <div className="space-y-3">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
        </>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="space-y-4"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-40 w-full" /><Skeleton className="h-24 w-full" /></div>
          <Skeleton className="h-64 w-full" />
        </div>
      )}
    </div>
  );
}
