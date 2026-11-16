import { pair } from "./pair";

export const voice = pair(
  {
    vStop: "থামুন",
    vLive: "যা বলছেন, এখানে লেখা হচ্ছে:",
    vLiveEmpty: "বলুন, আমরা শুনছি…",
    vDenied: "মাইক্রোফোন ব্যবহারের অনুমতি দেওয়া হয়নি। ব্রাউজারের সেটিংসে অনুমতি দিন, অথবা নিচের ঘরে লিখে জানান।",
    vSilence: "কোনো কথা শোনা যায়নি। আবার চেষ্টা করুন, অথবা লিখে জানান।",
    vNetwork: "ইন্টারনেটের সমস্যায় বলে লেখা গেল না। লিখে জানান, অথবা পরে আবার চেষ্টা করুন।",
    vOther: "বলে লেখা গেল না। লিখে জানান।",
    vHint: "বলার পর লেখাটি দেখে ঠিক করে নিন। ভুল শুনলে নিজে ঠিক করতে পারবেন।",
  },
  {
    vStop: "Stop",
    vLive: "What you are saying, as it is written:",
    vLiveEmpty: "Go ahead, we are listening…",
    vDenied: "Microphone permission was not given. Allow it in your browser settings, or type in the box below.",
    vSilence: "We did not hear anything. Try again, or type instead.",
    vNetwork: "Speech to text needs internet and could not connect. Type instead, or try again later.",
    vOther: "Speech to text did not work. Please type instead.",
    vHint: "After speaking, read the text and fix it. You can correct anything it heard wrongly.",
  },
);
