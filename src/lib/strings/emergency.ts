import { pair } from "./pair";

/**
 * Emergency guidance (masterplan 17.8, 21.6, 28). The guidance TEXT itself always comes from the server (docs/api-v1.md, imminent
 * harm) and is shown as given. Only the frame around it is written here. Wording is a draft for native-speaker and safety review.
 */
export const emergency = pair(
  {
    emNote: "জরুরি হলে ৯৯৯-এ ফোন করুন।",
    emNoteMore: "বিস্তারিত",
    emTitle: "আগে নিজের নিরাপত্তা দেখুন",
    emLead: "আপনার লেখায় বিপদের কথা আছে বলে মনে হয়েছে। নিচের নম্বরে এখনই ফোন করা যায়।",
    emCall: "ফোন করুন",
    emSaved: "আপনার লেখাটি জমা হয়েছে। তবে জনকথা জরুরি সেবা নয়; কেউ সঙ্গে সঙ্গে দেখবেন, তার নিশ্চয়তা নেই।",
    emSavedRef: "রেফারেন্স নম্বর:",
    emContinueReport: "আমার রিপোর্ট দেখুন",
    emContinueAsk: "আমার প্রশ্নগুলো দেখুন",
    emAskAnother: "আরেকটি প্রশ্ন লিখুন",
    emNumbersLabel: "জরুরি নম্বর",
    isOfficialNote: "জনকথা সরকারি চ্যানেল নয়। “পাঠানো হয়েছে” মানে এমপির অফিস বিষয়টি দায়িত্বে থাকা সংস্থাকে জানিয়েছে। সংস্থা নিজের খাতায় তুলেছে বা কাজ শুরু করেছে, এমন নয়।",
    isReferredNote: "এই সমস্যা দায়িত্বে থাকা সংস্থাকে জানানো হয়েছে। সংস্থা নিজের রেফারেন্স নম্বর না দেওয়া পর্যন্ত ধরে নেবেন না যে ওদের খাতায় উঠেছে।",
  },
  {
    emNote: "In an emergency, call 999.",
    emNoteMore: "Details",
    emTitle: "Your safety comes first",
    emLead: "What you wrote seems to mention danger. You can call one of these numbers right now.",
    emCall: "Call",
    emSaved: "Your message was saved. But Jonokotha is not an emergency service, and nobody is guaranteed to read it right away.",
    emSavedRef: "Reference number:",
    emContinueReport: "View my report",
    emContinueAsk: "View my questions",
    emAskAnother: "Write another question",
    emNumbersLabel: "Emergency numbers",
    isOfficialNote: "Jonokotha is not an official channel. “Sent” means the MP's office told the responsible authority. It does not mean the authority has registered the issue or started work.",
    isReferredNote: "This issue was passed on to the responsible authority. Until that authority gives its own reference number, do not treat it as a registered complaint with them.",
  },
);
