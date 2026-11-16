import { emergency } from "./emergency";
import { explore } from "./explore";
import { legal } from "./legal";
import { location } from "./location";
import { admin } from "./admin";
import { ask } from "./ask";
import { engage } from "./engage";
import { feed } from "./feed";
import { ideas } from "./ideas";
import { metrics } from "./metrics";
import { mfa } from "./mfa";
import { mp } from "./mp";
import { offline } from "./offline";
import { office } from "./office";
import { pages } from "./pages";
import { push } from "./push";
import { security } from "./security";
import { share } from "./share";
import { voice } from "./voice";

const parts = [explore, location, voice, ideas, mp, engage, ask, feed, share, pages, office, admin, offline, security, mfa, emergency, legal, metrics, push];

type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (x: infer I) => void ? I : never;
type Bn = UnionToIntersection<(typeof parts)[number]["bn"]>;
type En = UnionToIntersection<(typeof parts)[number]["en"]>;

export const p2 = {
  bn: Object.assign({}, ...parts.map((p) => p.bn)) as Bn,
  en: Object.assign({}, ...parts.map((p) => p.en)) as En,
};
