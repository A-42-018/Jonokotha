"use client";
import { cleanModes, DEFAULT_MODES, PERSONAL_PREFS_KEY, type PersonalModes } from "@/lib/personalize";
import { cleanNumerals, DEFAULT_NUMERALS, NUMERALS_KEY, setNumerals, type Numerals } from "@/lib/numerals";
import { useLocalValue } from "./useLocalValue";

/** Simple-language and voice-first modes for this device (account storage waits for B5.11). */
export function usePersonalModes(): [PersonalModes, (next: PersonalModes) => void] {
  const [raw, set] = useLocalValue<PersonalModes>(PERSONAL_PREFS_KEY, DEFAULT_MODES);
  return [cleanModes(raw), set];
}

/**
 * The numeral choice for this device. Also hands it to `fmtNum` and friends while rendering, so every component that
 * reads the language (useLang, useT) formats with it and re-renders when it changes. Server rendering and hydration use "auto".
 */
export function useNumerals(): [Numerals, (next: Numerals) => void] {
  const [raw, set] = useLocalValue<Numerals>(NUMERALS_KEY, DEFAULT_NUMERALS);
  const value = cleanNumerals(raw);
  setNumerals(value);
  return [value, set];
}
