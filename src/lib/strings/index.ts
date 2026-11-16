import { emergency } from "./emergency";
import { explore } from "./explore";
import { legal } from "./legal";
import { liaison } from "./liaison";
import { location } from "./location";
import { admin } from "./admin";
import { areas } from "./areas";
import { ask } from "./ask";
import { capability } from "./capability";
import { community } from "./community";
import { engage } from "./engage";
import { feed } from "./feed";
import { home } from "./home";
import { ideas } from "./ideas";
import { metrics } from "./metrics";
import { mfa } from "./mfa";
import { mp } from "./mp";
import { nav } from "./nav";
import { offline } from "./offline";
import { office } from "./office";
import { officeWs } from "./officeWs";
import { pages } from "./pages";
import { projects } from "./projects";
import { push } from "./push";
import { referral } from "./referral";
import { reportExtras } from "./reportExtras";
import { security } from "./security";
import { refresh } from "./refresh";
import { share } from "./share";
import { voice } from "./voice";

const parts = [explore, location, voice, ideas, mp, engage, ask, feed, share, pages, office, officeWs, liaison, admin, offline, security, mfa, emergency, legal, metrics, push, community, capability, referral, reportExtras, refresh, nav, home, projects, areas];

type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (x: infer I) => void ? I : never;
type Bn = UnionToIntersection<(typeof parts)[number]["bn"]>;
type En = UnionToIntersection<(typeof parts)[number]["en"]>;

export const p2 = {
  bn: Object.assign({}, ...parts.map((p) => p.bn)) as Bn,
  en: Object.assign({}, ...parts.map((p) => p.en)) as En,
};
