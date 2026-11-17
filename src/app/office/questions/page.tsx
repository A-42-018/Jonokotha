import QuestionsInbox from "@/components/office/ws/QuestionsInbox";
import { officePage } from "@/lib/office-page";

export default function Page() {
  return officePage("/office/questions", (t) => t.owQTitle, (t) => t.owQLead, () => <QuestionsInbox />);
}
