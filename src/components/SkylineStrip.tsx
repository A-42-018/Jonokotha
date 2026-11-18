/**
 * "What your area needs" strip: a neighbourhood street with the things people report on Jonokotha — a school, a hand pump, street lights, a clinic,
 * power lines, a canal bridge, market stalls, a bus, a water tank — leading to the representative's office and a mobile tower. It stands on the
 * footer's top line. Decoration only, so it is hidden from assistive tech and print. Colours come from CSS (`.jk-skyline` in globals.css) so the dark
 * theme can lift it off the dark page.
 */

/** Rectangle as a path. */
const rect = (x: number, y: number, w: number, h: number) => `M${x},${y}h${w}v${h}h${-w}Z`;
/** Filled circle as a path. */
const dot = (cx: number, cy: number, r: number) => `M${cx - r},${cy}a${r},${r} 0 1 0 ${r * 2},0a${r},${r} 0 1 0 ${-r * 2},0Z`;
/** Row of lit windows: n windows of size w×h starting at (x, y), step dx. */
const windows = (x: number, y: number, n: number, dx: number, w = 6, h = 8) =>
  Array.from({ length: n }, (_, i) => rect(x + i * dx, y, w, h)).join("");
/** A market stall at x0: striped awning, two posts, a counter and three heaps of produce. */
const stall = (x0: number) =>
  `M${x0},62L${x0 + 4},50H${x0 + 30}L${x0 + 34},62Z` + rect(x0 + 2, 62, 2, 28) + rect(x0 + 30, 62, 2, 28) + rect(x0 + 2, 78, 30, 4) +
  dot(x0 + 10, 76, 3) + dot(x0 + 17, 76, 3) + dot(x0 + 24, 76, 3);
/** A street light at x: pole, curved arm, lamp head. */
const lamp = (x: number) => rect(x - 1, 36, 3, 54) + `M${x},36Q${x},29 ${x + 12},29V32Q${x + 3},32 ${x + 2},38Z` + rect(x + 9, 32, 10, 3);
/** A power pole at x: pole and two cross arms. */
const pole = (x: number) => rect(x - 2, 22, 4, 68) + rect(x - 13, 28, 26, 3) + rect(x - 9, 36, 18, 3);

/** Distant tree line, drawn lighter behind the main silhouette. */
const BACK = "M0,90V78Q60,64 120,74T240,70T360,76T480,68T600,76T720,70T840,76T960,68T1080,76T1200,70T1320,76T1440,70V90Z";

const FRONT = [
  // school: block, pediment, flagpole with a flag
  rect(20, 54, 92, 36) + "M14,54L66,34L118,54Z" + rect(124, 30, 2, 60) + rect(126, 30, 14, 9),
  // hand pump (tube well): base, pipe, head, spout and handle
  rect(156, 82, 18, 8) + rect(163, 56, 4, 26) + rect(158, 52, 14, 6) + "M172,56h10v3h-10Z" + "M158,54L146,46L148,43L162,51Z",
  lamp(200),
  // clinic: block and roof edge (the cross is a warm detail)
  rect(236, 48, 90, 42) + rect(232, 44, 98, 5),
  pole(350) + pole(548),
  // canal bridge: deck, railing with posts and piers
  rect(380, 62, 150, 5) + rect(380, 56, 150, 2) + windows(382, 56, 10, 15, 2, 6) + rect(392, 67, 6, 23) + rect(452, 67, 6, 23) + rect(512, 67, 6, 23),
  // market stalls
  stall(580) + stall(620) + stall(660),
  // bus
  "M720,84V62Q720,56 728,56H796Q808,56 812,68V84Z" + dot(738, 84, 6) + dot(796, 84, 6),
  // water tank on legs
  "M836,62V48Q836,40 853,40Q870,40 870,48V62Z" + rect(850, 35, 6, 5) + rect(842, 62, 3, 28) + rect(862, 62, 3, 28),
  // flats
  rect(890, 46, 40, 44) + rect(936, 60, 50, 30),
  // street tree and a street light
  dot(1012, 66, 14) + rect(1010, 76, 4, 14) + lamp(1034),
  // mobile tower and a small block
  "M1330,90L1344,30H1348L1362,90H1356L1346,44L1336,90ZM1338,72H1354V75H1338ZM1341,56H1351V59H1341Z" + dot(1346, 28, 3),
  rect(1380, 60, 40, 30),
].join("");

/** Warm details: lit windows, the clinic's cross, lamp glow, the bus windows and the tower's signal arcs. */
const LIGHTS =
  windows(30, 62, 5, 16, 8, 10) +
  rect(277, 54, 8, 22) + rect(270, 61, 22, 8) + windows(244, 60, 1, 0, 10, 12) + windows(302, 60, 1, 0, 10, 12) +
  rect(209, 35, 10, 2) + rect(1043, 35, 10, 2) +
  windows(728, 62, 5, 14, 10, 9) +
  windows(896, 52, 3, 11, 5, 8) + windows(896, 68, 3, 11, 5, 8) + windows(942, 66, 3, 14, 6, 8) +
  windows(1388, 66, 3, 10, 5, 7);
const SIGNAL = "M1336,20a14,14 0 0 1 20,0M1330,14a22,22 0 0 1 32,0";
/** Power lines sagging between the two poles. */
const WIRES = "M363,29Q450,50 535,29M359,37Q450,56 539,37";

/** The representative's office (steps, columned block, cornice, pediment), shifted right to stand between the street and the tower. */
const OFFICE =
  "M1000,90V84H1260V90ZM1010,84V80H1250V84ZM1024,80V46H1236V80ZM1018,47V40H1242V47ZM1094,40L1130,22L1166,40Z";
const OFFICE_LIGHTS = windows(1036, 52, 7, 13, 5, 20) + windows(1146, 52, 7, 13, 5, 20) + "M1122,80V56h16V80Z";

export default function SkylineStrip() {
  return (
    <div aria-hidden="true" data-testid="skyline-strip" className="jk-skyline pointer-events-none mt-12 select-none print:hidden">
      <svg className="mx-auto block h-auto w-full max-w-[75rem]" viewBox="0 0 1440 90" preserveAspectRatio="xMidYMax meet">
        <path d={BACK} fill="currentColor" fillOpacity="0.16" />
        <path d={WIRES} fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d={FRONT} fill="currentColor" />
        <path d={LIGHTS} className="fill-amber/80" />
        <g transform="translate(50 0)">
          <path d={OFFICE} fill="currentColor" />
          <path d={OFFICE_LIGHTS} className="fill-amber/80" />
        </g>
        <path d={SIGNAL} fill="none" strokeWidth="2" strokeLinecap="round" className="stroke-amber" />
      </svg>
    </div>
  );
}
