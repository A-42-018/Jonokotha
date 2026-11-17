import { FLAGS } from "./flags";

/** One place for citizen navigation (masterplan 6.1 and 6.2), used by the desktop top bar and the "more" lists. */
export interface NavItem { href: string; key: "navHome" | "navArea" | "navProjects" | "navIdeas" | "navAskMp" | "navFindMp" | "navPolls" | "navHelp" | "navConsult" | "navTerms" | "navAbout" }

export function primaryNav(flags: { consultations: boolean } = FLAGS): NavItem[] {
  return [
    { href: "/", key: "navHome" },
    { href: "/area", key: "navArea" },
    { href: "/projects", key: "navProjects" },
    { href: "/ideas", key: "navIdeas" },
    { href: "/ask", key: "navAskMp" },
    { href: "/mp", key: "navFindMp" },
    ...(flags.consultations ? [{ href: "/consultations", key: "navConsult" } as NavItem] : []),
  ];
}

/** Pages that do not fit the bar: polls, help and about, terms. Shown under "More" on desktop and as a list on the home page. */
export function moreNav(): NavItem[] {
  return [
    { href: "/polls", key: "navPolls" },
    { href: "/help", key: "navHelp" },
    { href: "/about", key: "navAbout" },
    { href: "/terms", key: "navTerms" },
  ];
}
