import { notFound } from "next/navigation";
import { RegionOverview } from "@/components/r2/Regional";
import { R2 } from "@/lib/flags-r2";
import { officePage } from "@/lib/office-page";

export default async function Page() {
  if (!R2.regional) notFound();
  return officePage("/office/region", (x) => x.r2RgTitle, (x) => x.r2RgLead, () => <RegionOverview />);
}
