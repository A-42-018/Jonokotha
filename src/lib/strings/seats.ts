import { pair } from "./pair";

/** The area picker over the 300 real seats, and the vacant-seat message. */
export const seats = pair(
  {
    seSearchLabel: "এলাকার নাম, জেলা বা আসন নম্বর লিখুন",
    seSearchHint: "যেমন: ঢাকা-১৭, পঞ্চগড় বা ১৫",
    seNoResults: "কোনো এলাকা পাওয়া যায়নি। অন্য বানানে চেষ্টা করুন।",
    seSearchError: "এখন খোঁজা যাচ্ছে না। কিছুক্ষণ পরে আবার চেষ্টা করুন।",
    seSearching: "খুঁজছি…",
    seSeatNo: "আসন",
    seVacant: "খালি আসন",
    mpPhotoCredit: "ছবি: বাংলাদেশ জাতীয় সংসদ",
    seVacantNote: "এই আসনে এখন কোনো সংসদ সদস্য নেই। তবু আপনি সমস্যা জানাতে পারবেন।",
  },
  {
    seSearchLabel: "Type an area name, district or seat number",
    seSearchHint: "For example: Dhaka-17, Panchagarh, 15 or Chattogram",
    seNoResults: "No area found. Try another spelling.",
    seSearchError: "Search is not working right now. Please try again shortly.",
    seSearching: "Searching…",
    seSeatNo: "Seat",
    seVacant: "Vacant seat",
    mpPhotoCredit: "Photo: Bangladesh Parliament",
    seVacantNote: "This seat has no Member of Parliament right now. You can still report a problem.",
  },
);
