import { pair } from "./pair";

/** "Find my seat from my location" in the area dialog. Wording is a draft for native-speaker review. */
export const locateSeat = pair(
  {
    lsBtn: "আমার অবস্থান থেকে আসন খুঁজুন",
    lsBusy: "অবস্থান খোঁজা হচ্ছে…",
    lsPrivacy: "অবস্থান শুধু এই খোঁজার জন্য ব্যবহার হয়, জমা রাখা হয় না।",
    lsDenied: "অবস্থান জানার অনুমতি পাওয়া যায়নি। নিচে নাম লিখে খুঁজতে পারবেন।",
    lsUnsupported: "এই ডিভাইসে অবস্থান জানা যাচ্ছে না। নিচে নাম লিখে খুঁজুন।",
    lsFailed: "আসন খুঁজে পাওয়া গেল না। আবার চেষ্টা করুন, অথবা নিচে নাম লিখে খুঁজুন।",
    lsOutside: "আপনার অবস্থান কোনো জেলার সঙ্গে মেলেনি। নিচে নাম লিখে খুঁজুন।",
    lsOr: "অথবা",
    lsFoundSeat: "আপনার অবস্থান এই আসনে। বেছে নিতে এটিতে চাপুন।",
    lsFoundDistrict: "আপনি {district} জেলায় আছেন। এই জেলার কোন আসন আপনার, তা অবস্থান থেকে নিশ্চিত করা যায় না। আপনারটি বেছে নিন।",
  },
  {
    lsBtn: "Find my seat from my location",
    lsBusy: "Finding your location…",
    lsPrivacy: "Your location is used for this search only and is not saved.",
    lsDenied: "Location permission was not given. You can search by name below.",
    lsUnsupported: "This device cannot share its location. Search by name below.",
    lsFailed: "We could not find your seat. Try again, or search by name below.",
    lsOutside: "Your location did not match any district. Search by name below.",
    lsOr: "or",
    lsFoundSeat: "Your location is in this seat. Tap it to choose it.",
    lsFoundDistrict: "You are in {district} district. Your location cannot tell us which seat in the district is yours, so choose yours.",
  },
);
