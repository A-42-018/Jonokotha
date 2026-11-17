import { pair } from "./pair";

/** F7.9: read-aloud (masterplan 19.6). */
export const readaloud = pair(
  {
    raListen: "শুনুন",
    raStop: "থামান",
    raLoading: "তৈরি হচ্ছে…",
    raNoVoice: "এই ফোনে বাংলা পড়ার মতো কণ্ঠ নেই। ফোনের সেটিংসে ভাষা ও কণ্ঠ যোগ করলে শুনতে পারবেন।",
    raFail: "পড়ে শোনানো গেল না। আবার চেষ্টা করুন।",
    raPrivacy: "পড়া হয় আপনার ফোনের কণ্ঠে। সার্ভারের কণ্ঠ চালু থাকলে লেখাটি আগে ব্যক্তিগত তথ্য মুছে পাঠানো হয়।",
    raWhatResponse: "অফিসের উত্তর",
    raWhatMessage: "অফিসের বার্তা",
    raWhatStatement: "বাক্যটি",
    raWhatIdea: "আইডিয়া",
    raWhatProject: "প্রকল্পের কথা",
    raWhatQuestion: "প্রশ্ন",
    raSettingsTitle: "পড়ে শোনানো",
    raSettingsBody: "কিছু পাতায় “শুনুন” বোতাম থাকে। চাপলে লেখাটি জোরে পড়ে শোনানো হয়।",
  },
  {
    raListen: "Listen",
    raStop: "Stop",
    raLoading: "Preparing…",
    raNoVoice: "This phone has no voice for Bangla. Add the language and voice in your phone's settings to listen.",
    raFail: "Could not read it aloud. Try again.",
    raPrivacy: "It is read in your phone's own voice. If the server voice is on, personal details are removed from the text before it is sent.",
    raWhatResponse: "the office's reply",
    raWhatMessage: "the office's message",
    raWhatStatement: "the statement",
    raWhatIdea: "the idea",
    raWhatProject: "the project text",
    raWhatQuestion: "the question",
    raSettingsTitle: "Read aloud",
    raSettingsBody: "Some pages have a “Listen” button. Press it to hear the text read aloud.",
  },
);
