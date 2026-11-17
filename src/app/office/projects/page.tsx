import CheckinsOffice from "@/components/office/ws/CheckinsOffice";
import ProjectsManager from "@/components/office/ws/ProjectsManager";
import { officePage } from "@/lib/office-page";

export default function Page() {
  return officePage("/office/projects", (t) => t.owPTitle, (t) => t.owPLead, (c) => <><ProjectsManager constituency={c} /><CheckinsOffice constituency={c} /></>);
}
