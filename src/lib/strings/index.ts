import { explore } from "./explore";
import { location } from "./location";

const parts = [explore, location];

type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (x: infer I) => void ? I : never;
type Bn = UnionToIntersection<(typeof parts)[number]["bn"]>;
type En = UnionToIntersection<(typeof parts)[number]["en"]>;

export const p2 = {
  bn: Object.assign({}, ...parts.map((p) => p.bn)) as Bn,
  en: Object.assign({}, ...parts.map((p) => p.en)) as En,
};
