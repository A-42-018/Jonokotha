"use client";
import dynamic from "next/dynamic";

// The feed brings TanStack Query with it; loading it after first paint keeps the home page's first-load JS inside the budget.
const FollowedFeed = dynamic(() => import("./FollowedFeed"), { ssr: false, loading: () => <div className="h-24" aria-hidden /> });

export default function FollowedFeedLazy({ signedIn }: { signedIn: boolean }) {
  return <FollowedFeed signedIn={signedIn} />;
}
