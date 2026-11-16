# 3-minute video: "Vibe to Production in 180 Seconds"

Preliminary-submission video. Record on a phone-size window (375px) for the citizen scenes
and a 1280px window for the office scenes. Keep Bangla on screen. Total target: **2:50**
(10 seconds of slack under the 3-minute limit).

Task 0.9 notes: no demo-data helper screen is shown in the app. Sample data is seeded
through the backend before recording and labelled "নমুনা".

## Part A. Opening and build story (0:00 to 0:30)

| # | Time | Screen / URL | What to tap | What to say (plain Bangla) | Sec |
|---|---|---|---|---|---|
| A1 | 0:00 | Home, `/` (375px) | Nothing. Slow scroll to the report card. | "রাস্তায় গর্ত, ড্রেন বন্ধ। কিন্তু কাকে জানাবেন, জানেন না। জনকথা এই সমস্যার সমাধান।" | 12 |
| A2 | 0:12 | Claude Code session and commit list (`git log --oneline`) | Show the terminal, scroll the commit trail. | "পুরো অ্যাপটি এআই-এর সঙ্গে কথা বলে বানানো, আইডিয়া থেকে চালু অ্যাপ কয়েক দিনে।" | 18 |

## Part B. Golden path (0:30 to 2:35)

| # | Time | Screen / URL | What to tap | What to say (plain Bangla) | Sec |
|---|---|---|---|---|---|
| 1 | 0:30 | Home in Bangla, `/` (375px) | Point at the tagline and the "নমুনা" badge. | "অ্যাপ খুললেই বাংলা। নমুনা তথ্য আলাদা করে লেখা আছে।" | 8 |
| 2 | 0:38 | Constituency picker, header button "এলাকা বাছুন" on `/` | Tap "এলাকা বাছুন", choose "নমুনা নির্বাচনী এলাকা". | "প্রথমে নিজের নির্বাচনী এলাকা বাছি। অভিযোগ এই এলাকার অফিসে যাবে।" | 10 |
| 3 | 0:48 | `/report` (signed-in citizen) | Tap "সমস্যা জানান" on home. Type a short Bangla sentence, for example: "আমাদের পাড়ার মোড়ে রাস্তায় বড় গর্ত, রাতে বাইক পড়ে যাচ্ছে।" | "এখানে নিজের ভাষায় লিখি। বলতেও পারি।" | 14 |
| 4 | 1:02 | `/report`, AI draft | Tap "খসড়া তৈরি করুন". Show "এআই-এর প্রস্তাব" badges. Edit the title; the badge changes to "আপনি বদলেছেন". | "এআই শিরোনাম আর ধরন ঠিক করে দেয়। বদলানোর অধিকার আমার।" | 16 |
| 5 | 1:18 | `/report`, privacy warning | Add a fake phone number such as 01XXXXXXXXX to the text. The warning "ব্যক্তিগত তথ্য আছে মনে হচ্ছে" appears. Delete the number. | "ফোন নম্বর লিখলে অ্যাপ সাবধান করে। অফিস দরকার হলে নিজেই যোগাযোগ করবে।" | 10 |
| 6 | 1:28 | Success screen (after submit) | Tap "জমা দিন". Point at the reference number, then tap "নম্বর কপি করুন". | "জমা হলো। এই রেফারেন্স নম্বর দিয়ে পরে অগ্রগতি দেখব।" | 10 |
| 7 | 1:38 | `/issue/[ref]` | Tap "অভিযোগ দেখুন". Show status chip and "অগ্রগতি" timeline. | "যে কেউ এই নম্বরে অবস্থা দেখতে পারে, ব্যক্তিগত তথ্য ছাড়া।" | 10 |
| 8 | 1:48 | `/office` (staff, 1280px) | Switch to the staff window. Show the table and the new case at the top. | "এবার এমপি অফিসের দিক। আসা অভিযোগের তালিকায় নতুনটি এসেছে।" | 10 |
| 9 | 1:58 | `/office/[ref]` | Tap "খুলুন". Point at the "শুধু কর্মীদের জন্য" AI panel: summary, similar cases (use the seeded duplicate), suggested agency with source. | "এআই সারসংক্ষেপ, একই ধরনের অভিযোগ আর প্রস্তাবিত সংস্থা দেখায়। এটা শুধু কর্মীরা দেখেন।" | 20 |
| 10 | 2:18 | `/office/[ref]`, approve | Tap "স্বীকৃতি অনুমোদন করুন", read the confirm dialog, tap "হ্যাঁ, অনুমোদন করুন". Toast "স্বীকৃতি অনুমোদন হয়েছে" appears. | "কর্মী নিজে অনুমোদন না দিলে কিছুই যায় না। সিদ্ধান্ত মানুষের।" | 12 |
| 11 | 2:30 | `/issue/[ref]` (citizen window, refresh) | Status now "অফিস দেখেছে", new timeline step. | "নাগরিকের পাতায় অবস্থা বদলে গেছে।" | 5 |

## Part C. Optional and close (2:35 to 2:50)

| # | Time | Screen / URL | What to tap | What to say (plain Bangla) | Sec |
|---|---|---|---|---|---|
| 12 | 2:35 | Header toggle, any page (optional, cut first if long) | Tap "English", then back to "বাংলা". | "ইংরেজিতেও চলে।" | 4 |
| 13 | 2:39 | Install prompt on `/` (optional, Chrome Android only) | Tap "ইনস্টল করুন" if the card shows. | "ফোনে ইনস্টল করে রাখা যায়, ইন্টারনেট কম হলেও চলে।" | 5 |
| 14 | 2:44 | Deployed URL and logo | Show the staging or live URL on screen. | "ভয়েস, আইডিয়া, এমপি প্রোফাইল ও হটস্পট আসছে। জনকথা।" | 6 |

Seconds add up to 170 (2:50). Scenes 12 and 13 are optional; dropping them frees 9 seconds.

## Pre-recording checklist

Language and display
- [ ] Language is Bangla (toggle shows "English"). `lang` cookie is `bn`.
- [ ] Citizen scenes recorded at 375px wide (phone or devtools 375x812). Office scenes at 1280px wide. Browser zoom 100%.
- [ ] Browser chrome clean: no bookmarks bar, no extensions icons, notifications off.
- [ ] Sound: quiet room, microphone checked, voice-over in plain Bangla.

Data
- [ ] Staging URL live and reachable on the recording network.
- [ ] Sample data labelled "নমুনা" (constituency, representative card, any seeded cases). No real names, phone numbers or addresses.
- [ ] One seeded duplicate case in the same category so "একই ধরনের অভিযোগ" shows a match.
- [ ] Anthropic key set on the server so the AI draft and summary are real (otherwise the panel shows "এআই সারসংক্ষেপ চালু নেই").
- [ ] Sample report text and fake phone number ready to paste.

Accounts
- [ ] Citizen account signed in, in one browser profile (phone-size window).
- [ ] Staff account signed in, in a second profile (1280px window). Check `/office` loads and does not show "এই পাতা শুধু অফিসের কর্মীদের জন্য।"
- [ ] Citizen has picked the sample constituency, so the picker is not covering the first screen.
- [ ] Case for the approve scene is still in status "গ্রহণ করা হয়েছে" (new case, not yet approved).

State
- [ ] Offline banner is NOT showing (network on, DevTools "Offline" unticked).
- [ ] No leftover draft: "আপনার অসমাপ্ত লেখা ফিরিয়ে আনা হয়েছে" must not appear. Clear localStorage or tap "মুছে নতুন করে শুরু করুন".
- [ ] Install prompt: for scene 13 clear `jk-install-dismissed` in localStorage; otherwise skip the scene.
- [ ] Do one dry run end to end with a stopwatch before the real take.

## Rehearsal log (task 0.9, 2026-11-16)

Setup: temporary `.env.local` with dummy `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, dev server, built-in browser pane. No backend was connected, so any step that needs sign-in or database rows could only be checked up to the redirect or error state.

| Scene | Result |
|---|---|
| 1 Home in Bangla (375px, 1280px) | Works. Tagline, hero, report card, "নমুনা" badges on the area button and representative card all show. Desktop layout fine. |
| 2 Constituency picker | Works. The dialog opens from "এলাকা বাছুন" (button label reads "নির্বাচনী এলাকা বদলান" once an area is set; the sample area is the default, so on video tap it and show the tick). |
| 3 to 6 `/report`, AI draft, privacy warning, success | Not testable here. Signed out, `/report` correctly redirects to `/login`. Needs a real Supabase session and the Anthropic key. Test on staging. |
| 7 `/issue/[ref]` | Not testable here. A made-up ref correctly shows the not-found state ("পাতাটি পাওয়া যায়নি", "হোমে ফিরুন"). Needs a real case. |
| 8 to 11 `/office`, case workspace, approve, toast | Not testable here. Signed out, `/office` correctly redirects to `/login?expired=1` with the "আবার সাইন ইন করুন" message. Needs a staff session and a case. |
| 12 English toggle | Works. Switches to English (`lang="en"`) and back to Bangla. Reset the `lang` cookie to `bn` before recording. |
| 13 Install prompt | Not testable in the pane (no `beforeinstallprompt`). Check on Chrome Android. |
| Offline banner | Works. Firing the `offline` event shows "আপনি অফলাইনে আছেন…", and `online` shows "আবার অনলাইনে এসেছেন". Not showing in normal state. |

Broken steps found: none in the frontend. No code changes were needed.

Still to verify on staging before recording (needs backend): scenes 3 to 11 end to end,
including that the new case reaches `/office` quickly, the seeded duplicate appears under
"একই ধরনের অভিযোগ", and `/issue/[ref]` shows the new status after approval. Also time the
AI draft: if it takes more than about 5 seconds, cut or speed up scene 4 in the edit.
