import { pair } from "./pair";

/** F7.10: dark mode choice, and the read-aloud note, in Settings. */
export const theme = pair(
  {
    thTitle: "পাতার রং",
    thLead: "রাতে বা অন্ধকারে পড়তে গাঢ় রং বেছে নিতে পারেন। এই পছন্দ শুধু এই ফোন বা ব্রাউজারে থাকে।",
    thLegend: "কোন রং চান?",
    thSystem: "ফোনের মতো (নিজে থেকে বদলাবে)",
    thLight: "হালকা",
    thDark: "গাঢ়",
    thNow: "এখন দেখাচ্ছে: {mode}",
    thNowLight: "হালকা",
    thNowDark: "গাঢ়",
  },
  {
    thTitle: "Page colours",
    thLead: "You can choose a dark look for reading at night or in the dark. This choice stays on this phone or browser only.",
    thLegend: "Which look do you want?",
    thSystem: "Like the phone (changes by itself)",
    thLight: "Light",
    thDark: "Dark",
    thNow: "Showing now: {mode}",
    thNowLight: "Light",
    thNowDark: "Dark",
  },
);
