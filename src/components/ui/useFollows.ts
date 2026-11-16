"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addFollow, fetchFollows, findFollow, removeFollow, type FollowType } from "@/lib/engagement-api";

/** The signed-in person's follows from /me/follows. Needs a QueryProvider above it. `toggle` follows or unfollows. */
export function useFollows(signedIn: boolean) {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["follows"], queryFn: fetchFollows, enabled: signedIn });
  const toggle = useMutation({
    mutationFn: async ({ type, target }: { type: FollowType; target: string }) => {
      const hit = findFollow(list.data, type, target);
      if (hit) { await removeFollow(hit.id); return false; }
      await addFollow(type, target);
      return true;
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ["follows"] }),
  });
  return { follows: list.data, loading: list.isPending && signedIn, isFollowing: (type: FollowType, target: string) => !!findFollow(list.data, type, target), toggle };
}
