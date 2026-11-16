import { normalizeDigits } from "../digits";
import type { CountryAdapter } from "./index";

/** Bangladesh, the first adapter. Mobile numbers: 01[3-9]XXXXXXXX, +8801..., 8801..., with Bangla or Latin digits. */
export const BANGLADESH: CountryAdapter = {
  code: "BD", nameEn: "Bangladesh", nameNative: "বাংলাদেশ",
  defaultLocale: "bn", locales: ["bn", "en"], currency: "BDT", dateFormat: "dd/MM/yyyy", timezone: "Asia/Dhaka",
  adminLevels: [
    { level: "division", name_en: "Division", name_bn: "বিভাগ" }, { level: "district", name_en: "District", name_bn: "জেলা" }, { level: "upazila", name_en: "Upazila", name_bn: "উপজেলা" },
    { level: "city", name_en: "City corporation or municipality", name_bn: "সিটি কর্পোরেশন বা পৌরসভা" }, { level: "union", name_en: "Union", name_bn: "ইউনিয়ন" }, { level: "ward", name_en: "Ward", name_bn: "ওয়ার্ড" },
  ],
  identityChecks: ["email_code"], notificationChannels: ["in_app", "web_push", "email"], emergencyNumbers: { general: "999" },
  numerals: "bn",
  normalizePhone(input) {
    const d = normalizeDigits(input).replace(/[\s()-]/g, "");
    const m = d.match(/^(?:\+?880|0)(1[3-9]\d{8})$/);
    return m ? `+880${m[1]}` : null;
  },
};
