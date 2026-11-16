/**
 * Personalization controls (F5.15, masterplan 17.4). Three things, kept apart on purpose:
 * - feed ordering (`personalization_enabled`): on the account when signed in (docs/api-v1.md), mirrored on the device for the feed button
 * - simple-language mode and voice-first mode: device-local until B5.11 stores `simple_language_mode` and `voice_first` on the account
 * Nothing here infers anything about a person; the feed uses only what they chose to follow.
 */
export const FEED_PERSONAL_KEY = "jonokotha:feed-personalized:v1";
export const PERSONAL_PREFS_KEY = "jonokotha:personal-modes:v1";

export interface PersonalModes { simple: boolean; voiceFirst: boolean }
/** Stable reference: `useLocalValue` needs it. */
export const DEFAULT_MODES: PersonalModes = { simple: false, voiceFirst: false };

/** Reads a stored value safely: anything that is not two booleans falls back to the default. */
export function cleanModes(v: unknown): PersonalModes {
  const o = (v ?? {}) as Partial<PersonalModes>;
  return { simple: o.simple === true, voiceFirst: o.voiceFirst === true };
}
