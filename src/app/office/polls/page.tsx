import PollsOffice from "@/components/office/ws/PollsOffice";
import { FLAGS } from "@/lib/flags-more";
import { officePage } from "@/lib/office-page";

export default function Page() {
  return officePage("/office/polls", (x) => x.owPollsTitle, null, (c) => <PollsOffice constituency={c} surveys={FLAGS.surveys || FLAGS.officeRelease11} />);
}
