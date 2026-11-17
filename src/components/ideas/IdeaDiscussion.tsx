"use client";
import IdeaComments from "@/components/ideas/IdeaComments";
import IdeaPoints from "@/components/ideas/IdeaPoints";
import { useFeature } from "@/components/ui/useFeature";

/** For / against points replace open comment threads where the server has switched them on (`idea_arguments`); otherwise the comments stay (F7.4). */
export default function IdeaDiscussion({ refId, signedIn }: { refId: string; signedIn: boolean }) {
  const points = useFeature("idea_arguments");
  return points ? <IdeaPoints refId={refId} signedIn={signedIn} /> : <IdeaComments refId={refId} signedIn={signedIn} />;
}
