import { pair } from "./pair";

/** Capability labels (masterplan 2.9): live, sample, demo, planned. See lib/capability.ts. */
export const capability = pair(
  {
    capLive: "চালু আছে",
    capSample: "নমুনা",
    capDemo: "ডেমো",
    capPlanned: "শীঘ্রই আসছে",
    capSampleHint: "এটি নমুনা তথ্য। আসল সমস্যা বা মানুষ নয়।",
    capDemoHint: "এটি ডেমোর জন্য বানানো তথ্য। আসল নয়।",
    capPlannedHint: "এই সুবিধা এখনো চালু হয়নি। চাপার মতো কিছু নেই।",
    capNotOn: "এই সার্ভারে এই সুবিধা এখনো চালু করা হয়নি।",
    capPlannedAria: "এখনো চালু হয়নি",
  },
  {
    capLive: "Live",
    capSample: "Sample",
    capDemo: "Demo",
    capPlanned: "Coming soon",
    capSampleHint: "This is sample data. It is not a real report or person.",
    capDemoHint: "This data was made for a demonstration. It is not real.",
    capPlannedHint: "This feature is not switched on yet. There is nothing to press.",
    capNotOn: "This feature is not switched on at this server yet.",
    capPlannedAria: "Not switched on yet",
  },
);
