import { about } from "./about";
import { emergency } from "./emergency";
import { explore } from "./explore";
import { legal } from "./legal";
import { liaison } from "./liaison";
import { live } from "./live";
import { location } from "./location";
import { admin } from "./admin";
import { adminConsole } from "./adminConsole";
import { aiHelpers } from "./aiHelpers";
import { areas } from "./areas";
import { ask } from "./ask";
import { capability } from "./capability";
import { community } from "./community";
import { channels } from "./channels";
import { checkins } from "./checkins";
import { consult } from "./consult";
import { ideas11 } from "./ideas11";
import { release11 } from "./release11";
import { release2a } from "./release2a";
import { release2b } from "./release2b";
import { engage } from "./engage";
import { feed } from "./feed";
import { heatmap } from "./heatmap";
import { home } from "./home";
import { ideas } from "./ideas";
import { metrics } from "./metrics";
import { mfa } from "./mfa";
import { mp } from "./mp";
import { nav } from "./nav";
import { offline } from "./offline";
import { office } from "./office";
import { office11 } from "./office11";
import { officeWs } from "./officeWs";
import { pages } from "./pages";
import { personalize } from "./personalize";
import { pilot } from "./pilot";
import { projects } from "./projects";
import { priorities } from "./priorities";
import { push } from "./push";
import { readaloud } from "./readaloud";
import { referral } from "./referral";
import { reportExtras } from "./reportExtras";
import { security } from "./security";
import { refresh } from "./refresh";
import { seats } from "./seats";
import { share } from "./share";
import { surveys } from "./surveys";
import { theme } from "./theme";
import { tracker } from "./tracker";
import { voice } from "./voice";

const parts = [explore, location, voice, ideas, mp, engage, ask, feed, share, pages, office, officeWs, liaison, live, admin, adminConsole, offline, security, mfa, emergency, legal, metrics, push, community, capability, referral, reportExtras, refresh, nav, home, projects, areas, aiHelpers, personalize, about, seats, pilot, release11, consult, ideas11, checkins, channels, surveys, tracker, priorities, office11, readaloud, heatmap, theme, release2a, release2b];

type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (x: infer I) => void ? I : never;
type Bn = UnionToIntersection<(typeof parts)[number]["bn"]>;
type En = UnionToIntersection<(typeof parts)[number]["en"]>;

export const p2 = {
  bn: Object.assign({}, ...parts.map((p) => p.bn)) as Bn,
  en: Object.assign({}, ...parts.map((p) => p.en)) as En,
};
