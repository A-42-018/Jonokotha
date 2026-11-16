import { explore } from "./explore";
import { location } from "./location";
import { ask } from "./ask";
import { engage } from "./engage";
import { feed } from "./feed";
import { ideas } from "./ideas";
import { mp } from "./mp";
import { share } from "./share";
import { voice } from "./voice";

const parts = [explore, location, voice, ideas, mp, engage, ask, feed, share];

type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (x: infer I) => void ? I : never;
type Bn = UnionToIntersection<(typeof parts)[number]["bn"]>;
type En = UnionToIntersection<(typeof parts)[number]["en"]>;

export const p2 = {
  bn: Object.assign({}, ...parts.map((p) => p.bn)) as Bn,
  en: Object.assign({}, ...parts.map((p) => p.en)) as En,
};
