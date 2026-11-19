import type { Bi } from "./util";
import { bi } from "./util";

/** Texts of the demo banner and hub that are used outside the hub page. */
export const demoText: Record<"banner" | "gallery" | "exit", Bi> = {
  banner: bi("সিমুলেটেড ডেমো মোড: সব তথ্য নমুনা, কোডে তৈরি; ডাটাবেসে কিছু যায় না বা আসে না।", "Simulated demo mode: all data is example data made in code. Nothing is read from or saved to the database."),
  gallery: bi("ডেমো তালিকা", "Demo list"),
  exit: bi("ডেমো বন্ধ করুন", "Exit demo"),
};
