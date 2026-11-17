import IdeasReview from "@/components/office/ws/IdeasReview";
import { officePage } from "@/lib/office-page";

export default function Page() {
  return officePage("/office/ideas", (t) => t.owIdeasTitle, (t) => t.owIdeasLead, (c) => <IdeasReview constituency={c} />);
}
