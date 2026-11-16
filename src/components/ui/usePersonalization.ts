"use client";
import { cleanModes, DEFAULT_MODES, PERSONAL_PREFS_KEY, type PersonalModes } from "@/lib/personalize";
import { useLocalValue } from "./useLocalValue";

/** Simple-language and voice-first modes for this device (account storage waits for B5.11). */
export function usePersonalModes(): [PersonalModes, (next: PersonalModes) => void] {
  const [raw, set] = useLocalValue<PersonalModes>(PERSONAL_PREFS_KEY, DEFAULT_MODES);
  return [cleanModes(raw), set];
}
