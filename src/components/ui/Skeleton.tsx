import { cx } from "./cx";

/** Grey pulsing block for loading skeletons. Decorative: wrap a group in role="status" with a sr-only label. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("animate-pulse rounded-xl bg-slate-200 motion-reduce:animate-none", className)} />;
}

/** `lines` text-height bars; the last one is shorter. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden className={cx("space-y-2", className)}>
      {Array.from({ length: lines }, (_, i) => <Skeleton key={i} className={cx("h-4", i === lines - 1 && lines > 1 ? "w-2/3" : "w-full")} />)}
    </div>
  );
}

export default Skeleton;
