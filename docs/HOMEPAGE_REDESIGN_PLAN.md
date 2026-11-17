# Homepage redesign plan (জনকথা home, `/`)

**Status:** built on branch `ui-home-redesign` (17 Nov 2026), not committed. See §9 for what changed from this plan during the build.
**Scope:** the home page plus the shared header, footer and bottom tab bar it sits in, and new vector art made in Recraft
**Inspiration:** five mockups supplied on 17 Nov 2026. Round 1: "teal and orange" (reference A) and "green and cream" (reference B). Round 2: mint "আপনার এলাকার কণ্ঠস্বর" (C), navy and sand "একসাথে গড়ি সুন্দর এলাকা" (D), and the full-width river panorama (E). See §2 and §2b.
**Mockups:** [desktop](mockups/home-desktop-v1.png) and [phone](mockups/home-phone-v1.png), generated 17 Nov 2026 in Recraft with Nano Banana 2.1. They show the direction only: the Bangla text inside them is image-generated and not a spec, and the health tile shows a red cross where the final art must use a green plus (§6.4, T7).

---

## 1. What is wrong today (checked on `localhost:3000` at 375 and 1366 px, 17 Nov 2026)

| Problem | Evidence | Effect |
|---|---|---|
| The first screen does not invite action | The hero is a small centred strip (`max-w-xl`) with the tagline under it and **no button**. The first button is in the onboarding banner, not the report action. | People see a picture and a sentence, then have to scroll to find out what to do. |
| Phones scroll almost two screens before anything local appears | The three action cards stack on phones and each is about 300 px tall. "আপনার এলাকার অবস্থা" starts at about 1,450 px on a 375 × 812 screen (estimated from screenshots; the in-pane DOM measurement was unreliable on the phone viewport). | The area status, which is the reason to come back, is hidden below the fold. |
| Text looks hazy | Contrast passes (secondary text `#475569` on `#f4f8fc` is 7.1:1). The haze comes from size and weight: `HomeBlocks` uses `text-xs` 5 times and `text-sm` 6 times, so Bangla at 12–14 px in weight 400. Bangla conjuncts and vowel signs need more size than Latin. Pale blue page, white cards and light 1 px `slate-200` borders put pale on pale. The fonts use `display: "optional"`, so a first visit on a slow link can render in the device's fallback Bangla font (the fonts did load in my local check). | Text reads blurry and thin, especially on cheap Android screens. |
| Looks dated and generic | A single blue (`#1d5fa8`) on a pale blue page, bordered boxes and equal weight for every section. Nothing about it says Bangladesh. | Feels like a template, not a local civic service. |
| The art does not read | The category icons are abstract shapes in mixed styles: `cat-safety`, `cat-facilities` and `cat-education` are hard to recognise, and `cat-drainage` is a different style. The hero figures are tiny. | Pictures cannot help people who read slowly. |
| Too many equal blocks | Onboarding banner, three cards, snapshot, news, ideas, MP card, a "planned" polls box with nothing to press, and a link grid that repeats the menu. | No hierarchy; the eye has nowhere to land. |
| Snapshot is a dead block on low counts | With fewer than 5 cases each tile says "পাঁচের কম" three times in large type. | It looks broken although it is a deliberate privacy rule. |

## 2. What we take from each reference

| From reference A (teal and orange) | From reference B (green and cream) |
|---|---|
| Text on the left and a large illustration on the right in the hero, with one strong orange button | Warm Bangladesh palette: deep green, cream and terracotta |
| Three action cards that overlap the bottom of the hero, each with a coloured top band and a round white icon | **Voice and photo CTA pill** (mic, label and camera in one big button) |
| Status list with coloured progress bars and status chips | Three stat cards (icon, label, count badge, progress bar) |
| Category grid next to the status on desktop | **Category grid "সমস্যার ধরন বাছুন"**: 12 pastel tiles that match our 12 categories exactly |
| | Red emergency strip "জরুরি বিপদে ৯৯৯-এ ফোন করুন" above a dark green footer with leaf decoration |
| | Illustration rich in Bangladeshi daily life (rickshaw, saree, lungi, tin roofs, electric poles) |

**Direction:** reference B's palette, art style and content blocks, with reference A's overlapping cards on desktop. Round 2 (§2b) changes the hero art and the header.

## 2b. Second round of references (three desktop mockups)

| Ref | Adopted | Not adopted, and why |
|---|---|---|
| C (mint) | Each action card carries its own illustration: a person pointing at a broken road, a citizen asking an MP, a family sharing an idea. This matches prompts C1–C3. Status chips with an icon and words. | **Hero area search box.** A second large input beside the report button splits the first action, and live search needs client JavaScript the home page cannot afford; the header area picker stays. **"লাইভ ফিড".** We show only what the API returns, not a live stream, so the title stays "এলাকার খবর". |
| D (navy and sand) | **Phone hero:** four neighbours talking (woman in saree, young man, man in panjabi, elderly man in white panjabi and lungi) in front of a tin-roof house, apartment block and rickshaws. **"কীভাবে কাজ করে"** three-step strip, which replaces the onboarding banner. Dark header band. | **Pinned bottom 999 bar.** It covers content and collides with the phone tab bar; the red strip stays at the end of every page. **Idea thumbnails.** Ideas have no picture field. |
| E (panorama) | **Desktop hero:** one wide river panorama (Dhaka skyline with the Jatiya Sangsad, railway bridge, country boats, tin-roof village, rickshaw, krishnachura) with the headline on a quiet pale sky. | **Glossy 3D cards and icons:** they clash with the flat vector tiles. The "jenokotha.com" spelling in the screenshot. |

Two rules from this round:
- **Every word comes from HTML, never from the images.** All three mockups contain garbled Bangla (for example the line under "সমস্যা জানান" in C and the "ধরণ বাছুন" label in E). An image generator cannot be trusted with Bangla, so generated art must contain no text at all.
- **Dark header.** A, D and the footers of B and E frame the page in a dark band. The header becomes deep green `#0B3D2E` with a marigold wordmark (`#F2A33A`, 5.9:1), white links (12.2:1) and a **marigold button with ink text** (7.2:1). A brick button would fail on this background (2.4:1), so brick stays for the hero pill on cream. The header then matches the footer and frames the page.

Hero art choice, which you can overrule: panorama on desktop (E) and neighbours group on phone (D). A wide panorama crops badly on a 375 px screen, and the group scene reads well small. The earlier mother-and-pothole street scene is dropped.

## 3. Visual system

### 3.1 Colour tokens (`src/app/globals.css`)

Recommendation: switch the brand from blue to **Bangladesh green across the whole app** by changing the token values. Every page already uses `text-civic` and `bg-civic`, so one change re-skins the app consistently. A green home with blue inner pages would look broken.

| Token | Value | Use | Contrast (checked) |
|---|---|---|---|
| `--color-civic` (brand) | `#006A4E` (flag green) | Links, headings accents, filled buttons | 6.6:1 on white, 6.2:1 on cream |
| `--color-brand-deep` *(new)* | `#0B3D2E` | **Header band**, footer | white text 12.2:1, marigold 5.9:1 |
| Header button *(new)* | `#F2A33A` with ink `#1B2A22` text | "সমস্যা জানান" in the header | 7.2:1 (brick on this band is only 2.4:1) |
| `--color-brick` *(new)* | `#C2410C`, hover `#9A3412` | Main CTA (report pill, report tab) | white text 5.2:1 (hover 7.3:1) |
| `--background` | `#FBF6EC` (cream) | Page | — |
| `--foreground` / `ink` | `#1B2A22` | Headings, body | 13.9:1 on cream |
| `ink-2` *(new)* | `#3B4A41` | Body copy, descriptions | 8.7:1 on cream, 9.4:1 on white |
| `--color-muted` | `#55625A` | Meta lines only (dates, period) | 5.9:1 on cream, 6.4:1 on white |
| `--color-danger` | `#B91C1C` | Emergency strip | white text 6.5:1 |
| Status: reported | `#C2410C` on `#FDE7DA` | Stat card, chip | 5.2:1 / ink on tint 12:1 |
| Status: in progress | `#1F6F8B` on `#DCEEF5` | Stat card, chip | 5.7:1 on white |
| Status: resolved | `#1F7A3F` on `#DDF1E3` | Stat card, chip | 5.4:1 on white |
| Marigold accent | `#F2A33A` | Decoration only, never text on light | 5.9:1 as text on `#0B3D2E` only |

Category tile tints (decoration; the label is ink on the tint, ≥ 11:1): roads `#FDE3CF`, drainage `#F9D5CC`, water `#D6ECF8`, electricity `#FCE9B8`, waste `#D5EDD9`, flooding `#CFE3F5`, health `#CDEBE6`, education `#FBEFC2`, safety `#E3DAF3`, environment `#DCEFC9`, facilities `#D3EEF0`, other `#ECEAE6`.

Dark theme: map cream to `--dk-bg`, `ink-2` to `--dk-muted` and brand text to `#7ED3B2` (10.3:1 on `#0E1621`). Any new background class such as `bg-cream` needs a `html[data-theme="dark"]` override, just as `.bg-white` has today. Update `tests/unit/contrast.test.ts` with every new pair.

### 3.2 Typography (fixes the haze)

| Role | Phone / desktop | Font and weight | Line height | Colour |
|---|---|---|---|---|
| Hero H1 | 30 / 52 px | Anek Bangla 700 | 1.25 | ink |
| Section H2 | 22 / 28 px | Anek Bangla 600 | 1.3 | ink |
| Card title | 19 / 21 px | Anek Bangla 600 | 1.35 | ink |
| Body and descriptions | 17 / 18 px | Hind Siliguri 400 (500 on tinted backgrounds) | 1.7 | ink-2 |
| Meta (period, dates, counts) | 15 px | Hind Siliguri 500 | 1.5 | muted |
| Buttons | 18 px | Hind Siliguri 600 | — | — |

Rules:
- No Bangla text under 15 px on the home page: no `text-xs`, and `text-sm` only for Latin.
- In `layout.tsx`, change both fonts from `display: "optional"` to `display: "swap"` (keep `adjustFontFallback`) so the brand Bangla font is used on the first visit. Add Anek Bangla weight 700 for H1 only. Gate: CLS ≤ 0.05 on `/` in Lighthouse mobile. If CLS goes above that, keep `optional` for the heading font only.

### 3.3 Shape, depth and spacing

- Cards: `rounded-2xl` (16 px), white, **soft shadow instead of a grey border**: `0 1px 2px rgb(27 42 34 / .06), 0 8px 24px rgb(27 42 34 / .08)`.
- The CTA pill is fully rounded and 64 px tall on phones, 72 px on desktop.
- Section gaps are 40 px on phones and 64 px on desktop. Keep the content width at `max-w-7xl`.
- Background: cream page, with one or two soft organic blob shapes behind the hero (inline SVG paths in `#F3E6CF` and `#E4F0E6`, decorative and `aria-hidden`).
- Icons in UI chrome (stat cards, chips, CTA mic and camera, chevrons) are inline SVG line icons, not Recraft art.

## 4. Page structure

### 4.1 Phone (375 px)

```
┌─────────────────────────────────────┐
│ [mark] জনকথা            🔔  EN  (D) │  header, deep green, 56 px
│ 📍 নমুনা নির্বাচনী এলাকা ▾  [নমুনা]  │  area pill
├─────────────────────────────────────┤
│ আপনার এলাকার সমস্যা,                │  H1 30 px / 700
│ সরাসরি জনপ্রতিনিধির কাছে              │
│ বলুন, লিখুন বা ছবি তুলুন। আমরা খসড়া  │  17 px ink-2
│ করে দেব, আপনি দেখে জমা দেবেন।          │
│ ╭─────────────────────────────────╮ │
│ │ 🎤  বলুন বা ছবি তুলে সমস্যা জানান 📷 │ │  brick pill, 64 px
│ ╰─────────────────────────────────╯ │
│ নতুন? তিন ধাপে জেনে নিন ›             │  text link (replaces banner)
│ [   hero illustration, 4:3 crop   ] │
├─────────────────────────────────────┤
│ আপনার এলাকার অবস্থা                  │
│ [জানানো ২৩] [কাজ চলছে ৬] [সমাধান ৩]   │  3 compact stat cards + bars
│ গত ৩০ দিন · হালনাগাদ … · কীভাবে গোনা হয় │
├─────────────────────────────────────┤
│ সমস্যার ধরন বাছুন                     │
│ [রাস্তাঘাট] [ড্রেন ও নালা] [পানি]        │  3 columns × 4 rows,
│ [বিদ্যুৎ]  [ময়লা]      [জলাবদ্ধতা]     │  each a link to /report
│ …                                   │
├─────────────────────────────────────┤
│ [💡 আইডিয়া দিন                    ›] │  compact rows, 80 px,
│ [🗣 এমপিকে প্রশ্ন করুন               ›] │  not 380 px cards
│ [🔎 অভিযোগের খোঁজ নিন               ›] │
├─────────────────────────────────────┤
│ এলাকার খবর (list with status chips)  │
│ আপনার জনপ্রতিনিধি (card)              │
│ জনপ্রিয় আইডিয়া                       │
├─────────────────────────────────────┤
│ ⚠ জরুরি বিপদে ৯৯৯-এ ফোন করুন          │  red strip, tel:999
│ dark green footer, leaves, links     │
└─────────────────────────────────────┘
  [হোম] [এলাকা] (+ brick) [আইডিয়া] [আমি]   bottom tab bar
```

Target: H1, sub-line and CTA visible without scrolling. Area status starts within about 1.2 screens (about 1,000 px) and the category grid within 2. Today the area status starts at about 1,450 px.

### 4.2 Desktop (≥ 1024 px)

```
[deep green band: logo জনকথা (marigold) | হোম  এলাকা  আইডিয়া  এমপিকে প্রশ্ন  আরও ▾ | 📍 area ▾ | 🔔 | (সমস্যা জানান, marigold) | EN | (D)]
┌─────────── full-bleed panorama, about 420 px tall (ref E), flat sunrise bands ─────────┐
│ আপনার এলাকার সমস্যা,                 │  Dhaka skyline + Jatiya Sangsad, river,        │
│ সরাসরি জনপ্রতিনিধির কাছে  (52 px)     │  railway bridge, boats, tin-roof village,      │
│ sub-line  (on the quiet pale sky)     │  rickshaw, krishnachura; left 40% stays sky    │
│ ╭ 🎤 বলুন বা ছবি তুলে সমস্যা জানান 📷 ╮  │                                                │
│ নতুন? তিন ধাপে জেনে নিন ›               │                                                │
└───────────────────────────────────────────────────────────────────────────────────────┘
      ┌ idea ──────┐   ┌ ask MP ────┐   ┌ track ─────┐    ← overlap the hero by 48 px (ref A)
      │ band + art │   │ band + art │   │ band + art │      coloured band: brick / green / deep green
      └────────────┘   └────────────┘   └────────────┘
আপনার এলাকার অবস্থা — নমুনা নির্বাচনী এলাকা
[stat card] [stat card] [stat card]
সমস্যার ধরন বাছুন
[6 × 2 tiles]
┌ এলাকার খবর (2/3) ──────────────────┐ ┌ আপনার জনপ্রতিনিধি (1/3) ┐
│ rows with status chip and bar        │ │ জনপ্রিয় আইডিয়া           │
└──────────────────────────────────────┘ └──────────────────────────┘
[red emergency strip]   [dark green footer: links in 3 columns, "not an official channel" note, leaves]
```

### 4.3 Section specs

| # | Section | Component | Data | Notes |
|---|---|---|---|---|
| 1 | Hero | `HomeHero` (rewrite, server) | none | `<picture>`: `home-hero.svg` (panorama, from lg) and `home-hero-sm.svg` (neighbours group, below lg). Both are required now. On desktop the art is a full-bleed band (`object-cover object-right`) and the text column sits on its quiet pale sky, so ink text on `#FBF3E4` is 13.6:1 wherever it falls. `fetchPriority="high"`, explicit width/height. The pill is one `<Link href="/report">` with the visible label; the mic and camera are decorative inside it. Optional deep links `?mode=voice` and `?mode=photo` come in step 5. |
| 2 | Area status | `HomeSnapshot` restyled as 3 stat cards | `loadSnapshot` (unchanged) | Icon, label, count badge and bar (bar = share of total). Privacy rule unchanged: when `shownCount` is null, show "৫-এর কম" in the badge **and once** under the cards: "সংখ্যা কম হলে গোপনীয়তার জন্য সঠিক সংখ্যা দেখানো হয় না।" Keep the period, updated time and "কীভাবে গোনা হয়" link (F.7 rule) and the sample label. |
| 3 | Category grid | `CategoryGrid` (new, server) | `CATEGORIES`, `t.cats` | 12 links to `/report?category=<id>`, art plus label, tint per category. Grid: 3 columns on phones, 4 on tablet, 6 on desktop. Each tile ≥ 96 px tall with a visible focus ring. |
| 4 | Action cards | `ActionCards` (restyle) | none | Idea `/ideas/new`, ask `/ask`, track (see below). Desktop: ref A cards with a coloured band and an overlap, with the card illustration (C1–C3) in a round white badge on the band as in ref C. Phones: compact rows (art 56 px, title, one line and a chevron). |
| 4b | How it works | `HowItWorks` (new, server) | none | Ref D's three-step strip, placed after the category grid. Steps: জানান, জমা দিন, অগ্রগতি দেখুন, with the sentences in the strings list below. A "বিস্তারিত ›" link goes to `/welcome`. Three columns with arrows from md, three stacked rows on phones. It says what happens in general terms and promises no response time or outcome. |
| 5 | Area news | `AreaNews` / `FollowedFeed` (restyle) | as today | Rows with a status chip; no grey borders; 17 px titles. |
| 6 | Your representative | `AreaRepCard` (restyle) | `loadAreaRep` | Keep "verified on" and source host (trust rule). |
| 7 | Popular ideas | `PopularIdeas` (restyle) | `loadPopularIdeas` | Support count as a pill. |
| 8 | Emergency strip | `EmergencyStrip` (new, server, in layout above footer) | `strings/emergency.ts` | "জরুরি বিপদে ৯৯৯-এ ফোন করুন" with a `tel:999` link. It must stay on every page (F5.17). |
| 9 | Footer | `SiteFooter` (restyle) | — | Dark green with a leaf decoration. Keep the "not an official channel" note. The links from `ExploreLinks` move here. |

Track card: link to `/me` when signed in. Add a small reference form for everyone: a GET `<form action="/issue/find">` with one labelled input. A route handler redirects to `/issue/[ref]`, or back with an error message if the ref is malformed. No client JS.

**Removed from home:**
- `ActivePolls`: the "planned" box has nothing to press.
- `ExploreLinks`: repeats the menu; moves to the footer.
- `OnboardingCard`: a client component; replaced by the static `HowItWorks` strip (4b) and the small "নতুন? তিন ধাপে জেনে নিন ›" link under the hero pill, both pointing to `/welcome`. This also frees home first-load JS.

The third card is a deliberate change from reference A. Reference A repeats "সমস্যা জানান" as card 1, but the hero pill and category grid already lead to reporting. Tracking a report is the most common reason to come back.

## 5. Code changes

| Area | Files | Change |
|---|---|---|
| Tokens and type | `src/app/globals.css`, `src/app/layout.tsx` (fonts, `themeColor` to `#0B3D2E`), `src/app/manifest.ts` | §3 |
| Shell | `src/components/ui/TopNav.tsx`, `BottomTabBar.tsx`, `MoreMenu.tsx`, `src/components/SiteFooter.tsx`, new `EmergencyStrip.tsx` | Restyle; brick report button; active nav underline (ref B) |
| Home | `src/app/page.tsx`, `src/components/citizen/HomeHero.tsx`, `ActionCards.tsx`, `HomeBlocks.tsx`, `AreaNews.tsx`, new `CategoryGrid.tsx` | §4 |
| Report deep link | `src/app/report/page.tsx`, `src/components/ReportForm.tsx`, `src/components/report/CategoryPicker.tsx` | Read `?category=` (validate with `isCategory`), preselect it and start on the description step. Signed-out visits go to `loginUrl("/report?category=…")` (`src/lib/guard.ts`) instead of the bare `/login`, so the choice survives sign-in. A saved draft wins over the URL, and the user is told. |
| Track by reference | new `src/app/issue/find/route.ts` | Validate the ref format and redirect |
| Strings | `src/lib/strings/home.ts` (bn and en) | See below |
| Art | `public/illustrations/` | §6 |
| Docs | `docs/design-system.md` (tokens, new components), `docs/aibc/build-provenance.md` (Recraft used for vector art) | |

New strings (bn / en). They must pass `tests/unit/language.test.ts`: no Latin letters or ASCII digits in Bangla, and none of the avoid-list words.
- `hmHeroSub`: "বলুন, লিখুন বা ছবি তুলুন। আমরা খসড়া করে দেব, আপনি দেখে জমা দেবেন।" / "Speak, type or take a photo. We draft it, you check and send."
- `hmCta`: "বলুন বা ছবি তুলে সমস্যা জানান" / "Report a problem by voice or photo"
- `hmNewHere`: "নতুন? তিন ধাপে জেনে নিন" / "New here? Learn it in three steps"
- `hmHowTitle`: "কীভাবে কাজ করে" / "How it works"; `hmHowMore`: "বিস্তারিত" / "Details"
- `hmHow1`: "জানান" / "Report", body "ছবি তুলুন, বলুন বা লিখুন। আমরা খসড়া করে দেব।" / "Photo, voice or text. We draft it."
- `hmHow2`: "জমা দিন" / "Send", body "আপনি দেখে নিলে এলাকার অফিস সমস্যাটি দেখতে পায়।" / "Once you confirm, the area office can see it."
- `hmHow3`: "অগ্রগতি দেখুন" / "Follow progress", body "রেফারেন্স নম্বর দিয়ে যে কোনো সময় খোঁজ নিন।" / "Check any time with your reference number."
- `hmCatsTitle`: "সমস্যার ধরন বাছুন" / "Choose a problem type"
- `hmTrackTitle` / `hmTrackBody` / `hmTrackLabel` / `hmTrackCta`: "অভিযোগের খোঁজ নিন" / "রেফারেন্স নম্বর দিয়ে দেখুন কাজ কতদূর এগোল।" / "রেফারেন্স নম্বর" / "খুঁজুন"; and "Track a report" / "Use your reference number to see progress." / "Reference number" / "Find"
- `hmFewNote`: "সংখ্যা কম হলে গোপনীয়তার জন্য সঠিক সংখ্যা দেখানো হয় না।" / "Small numbers are not shown exactly, to protect privacy."
- `hmEmergency`: "জরুরি বিপদে ৯৯৯-এ ফোন করুন" / "In an emergency, call 999"
- Category labels already exist (`t.cats`) and match reference B one to one.

Hard constraints:
- **Home stays server-only.** The first-load JS margin is almost used up (budget 150 KB gzip, `tests/e2e/perf.spec.ts`). No new client components on `/`; removing `OnboardingCard` adds margin.
- Every SVG ≤ 90 KB (`perf.spec.ts`). If the approved hero cannot fit, raise the limit for `home-hero*.svg` only to 140 KB (≈ 40 KB gzip) in the test rather than degrade the art.
- 44 px touch targets, visible focus, logical properties (`ms-`, `pe-`) and no meaning by colour alone. Status chips keep an icon and words.
- The simple-language mode CSS (`html[data-simple] main img[src^="/illustrations/card-"]`) must follow the new card file names.

## 6. Vector art (Recraft)

### 6.1 Inventory

| File | Aspect | Shown at | Budget | Replaces |
|---|---|---|---|---|
| `home-hero.svg` (panorama) | 20:7 (2000 × 700) | full width, about 420 px tall, from lg | ≤ 140 KB (see §5) | `hero-desktop.svg` on home |
| `home-hero-sm.svg` (neighbours group) | 4:3 | 343 × 257 phone | ≤ 90 KB | `hero-mobile.svg` on home |
| `home-card-idea.svg`, `home-card-ask.svg`, `home-card-track.svg` | 1:1 | 56 px phone, 120 px desktop | ≤ 40 KB each | `card-idea`, `card-ask` on home |
| `cat-roads.svg` … `cat-other.svg` (12) | 1:1 | 64–96 px | ≤ 25 KB each | same names, so the report wizard's `CategoryPicker` gets the new set too |
| `foot-leaves.svg` | 1:1 | 160 px footer corner | ≤ 12 KB | new |

That is 18 images. At about 4 credits per image and about 3 tries each, plan for **about 220 to 260 credits**, plus a few region edits. The Recraft account in the browser pane (Basic plan) showed **574 credits** on 17 Nov 2026, so there is room for the art plus a few mockup images. If the panorama will not stay under 140 KB as flat vector, the fallback is a WebP raster at 2000 × 700 (about 60 to 90 KB); that gives the richer sunrise look of ref E but loses the flat style and crisp scaling.

### 6.1b What was actually made (17 Nov 2026)

All 18 pieces were generated in Recraft V4.1 Vector (plus footer leaves in two versions) and reviewed against §6.5. Files are in `public/illustrations/home/`; nothing existing was overwritten and nothing is wired into a page yet. Review sheets: [tiles and cards](mockups/art-tiles-cards-v1.png), [heroes](mockups/art-heroes-v1.png).

**Format change: AVIF/WebP, not SVG.** Recraft's vector output is a trace of a picture: the panorama is 1.6 MB, the neighbours scene 0.7 MB, even a small card is 100 KB, and a tile 30 to 50 KB (compressed export). That is far over the 90 KB SVG limit in `tests/e2e/perf.spec.ts`. The same art as AVIF/WebP is 20 to 140 KB for heroes and 3 to 20 KB for everything else, with identical looks at display size. The SVG masters stay in the Recraft project ("Jonokotha homepage art"), not in the repo. Tiles, cards and leaves have their background removed (transparent), so the tile tint comes from CSS.

| File | Size | Notes |
|---|---|---|
| `hero-panorama-1600.avif` / `.webp`, `hero-panorama-2400.avif` / `.webp` | 39 / 83 KB, 63 / 136 KB | 2:1 (Recraft's widest ratio; crop to the band with `object-cover`). Sky is empty on the left for the headline. Use `<picture>` with AVIF first. |
| `hero-neighbours-800.avif` / `.webp`, `hero-neighbours-1200.avif` / `.webp` | 21 / 44 KB, 33 / 72 KB | Background recoloured to the page cream `#FBF6EC` so it sits seamlessly on the cream page (light theme only; dark theme needs a surface behind it). |
| `card-idea.webp`, `card-ask.webp`, `card-track.webp` | 16, 20, 16 KB | 320 px, transparent outside the round cream circle. |
| `cat-roads` … `cat-other` (12 `.webp`) | 3 to 6 KB each | 192 px. Named after the category ids, in a new folder so the report wizard's `cat-*.svg` are untouched. |
| `foot-leaves-a.webp`, `foot-leaves-b.webp` | 10 KB each | Two corner clusters, flat greens. |

Review notes against §6.5: the flags (school, Union Parishad office, panorama) are a green field with one red disc and nothing else; the clinic uses a green plus, not a red cross; the rickshaw has the puller in front and passengers behind; dress is saree, panjabi, tupi, lungi, gamchha, salwar kameez and hijab. Known imperfections: the safety tile is the least clear (lane, lamp and shield), and the Sangsad in the panorama is stylised (correct cut-outs, simplified massing). The first panorama round was rejected (sky cut in half by a hard seam, a boat-shaped parliament) and regenerated with the sky wording below.

Prompt changes that made the difference, for reuse: say "one continuous sky spanning the full width, no rectangular panels, no hard vertical edges"; list the palette as hex values inside the prompt (the Colors picker was not needed); end the avoid list with "white backgrounds, panels, split compositions". Recraft generates one job at a time; submit the next only after the previous finishes.

### 6.2 Recraft settings

1. Sign in to Recraft in the browser pane (the saved session has expired). Open project **"Jonokotha vectors"** and choose model **Recraft V4.1 Vector**.
2. Set the aspect ratio from the table above.
3. In **Colors**, set the palette: `#006A4E` `#3A9D5D` `#A8D5A2` `#FBF3E4` `#C65D3B` `#A8432A` `#F2A33A` `#9FD3E8` `#2E8B9A` `#2B2B2B`, plus skin tones `#E8B98A` `#C68642` `#8D5524`. Without the skin tones Recraft may colour faces with terracotta. If the palette slot count is limited, keep the greens, cream, terracotta, marigold, sky, charcoal and the skin tones.
4. Make the hero first. Once it is approved, and if your plan offers it, use Recraft's **Create style** with the hero (and later the first approved card) as reference, so the cards and the 12 tiles match it. If not, paste the same style block every time.
5. Fix single wrong details with a region edit (select the area and re-prompt) instead of regenerating the whole image.
6. Export: select the image, then **Export → SVG → Download**. Move the file from `~/Downloads` to a scratch folder and check that it has no `<script>`, `<foreignObject>`, `<image>` or external `href`. Delete the full-canvas background shape from the tile and footer icons (the tile tint comes from CSS), then copy the file to `public/illustrations/`. Never round path numbers to save size: relative path commands drift and shapes break.

### 6.3 Shared blocks (append to every prompt)

**STYLE**
```
Flat vector illustration, modern civic editorial style, clean geometric shapes with smooth curves, solid flat colours only, no gradients, no texture, no grain, no speckles, no outlines. Warm morning light, hopeful and friendly mood. People have complete friendly faces (eyes, eyebrows, small nose, smile), natural proportions, black hair, and warm brown Bengali South Asian skin tones from light wheat to deep brown. No text, letters, numbers, logos or watermark anywhere.
```

**AVOID**
```
Avoid: Indian yellow-and-black auto-rickshaws, Hindi or Urdu script, red double-decker buses, Western suburban houses, snow, political party symbols, party flags, election posters, portraits of real people, faceless or blank-faced figures, extra fingers, warped vehicles.
```

### 6.4 Prompts

#### H1. Home hero, desktop panorama (20:7)
```
Ultra-wide panoramic landscape of Bangladesh on a clear warm morning, one continuous scene that reads from left to right, seen from a low eye-level viewpoint.
Left third: only a quiet pale cream-and-peach sky made of three flat horizontal colour bands, one small low sun disc and two soft flat clouds. Nothing else in the top-left third; it is left empty on purpose for a headline.
Left of centre on the horizon: a Dhaka skyline of about ten simple modern towers in muted blue-grey and cream. In front of it the National Parliament House (Jatiya Sangsad): a wide, low, monumental building in pale grey concrete made of large cylindrical and box-shaped blocks, each face showing big geometric cut-outs (a triangle, a circle and a rectangle) outlined by white marble bands, standing on a stepped red-brick base, with a green lawn and a long straight reflecting pool in front. Beside it a tall flagpole flying the Bangladesh flag: a dark green rectangle with one solid red circle placed slightly towards the pole, and nothing else on it.
Centre: a wide calm river with a long steel railway truss bridge across it (about eight spans, dark grey-green). On the water two traditional wooden country boats (nouka) with curved hulls and a low arched cover; one has a small patched triangular sail; a fisherman stands at the back with a long pole, in a white vest and a blue checked lungi.
Right third: a green riverbank village with four small houses with rust-red and teal corrugated tin roofs and mud-brown walls, banana plants, two coconut palms, a large krishnachura tree with red-orange flowers, and a clothes line with a green saree and a yellow saree drying. A dirt road runs along the river; on it a cycle rickshaw, drawn correctly with one front wheel and two rear wheels, a folded colourful hood and a painted back panel, carries two passengers: a woman in a blue cotton saree with the anchal over her shoulder, and a schoolgirl in a white salwar kameez with a navy-blue orna scarf. The puller wears a red-and-white checked gamchha around his head, a white vest and a checked lungi. Behind them a young man in a white shirt and dark trousers walks beside his bicycle, and a farmer in a lungi and a wide conical palm-leaf hat (japi) carries a bundle of green stalks.
Foreground: a plain strip of green grass, no objects. The whole picture is full-bleed, no frame and no border.
```
Then append STYLE and AVOID, but replace "no outlines" with "no outlines except thin white marble bands on the parliament building".

#### H2. Home hero, phone: four neighbours (4:3)
```
Friendly neighbourhood scene in Bangladesh on a bright morning: four neighbours stand in a loose half-circle in conversation, full body, large, centred and at the same scale.
From left: a woman of about 35 in a green cotton saree with a marigold border, the anchal over her left shoulder, a smartphone in her right hand, gesturing as she talks; a young man of about 22 in a mustard-yellow shirt and dark-blue trousers with one open hand raised as if explaining; a man of about 45 in a blue knee-length panjabi over white pyjamas with a trimmed moustache, listening with a raised palm; an elderly man of about 70 with a short white beard, a white tupi cap, a white panjabi and a white-checked lungi, hands pressed together, smiling.
Behind them: a small single-storey house with a red-orange tin roof, mud-brown walls and a green wooden door on the left; a four-storey cream-and-terracotta apartment block with balcony grills and a black rooftop water tank on the right; two cycle rickshaws parked at the far right, each with one front wheel, two rear wheels and a colourful folded hood; two iron street lamps on black poles; two round green trees and one krishnachura tree with red-orange flowers. Warm sand-coloured ground that fades into a plain cream background, no frame.
```
Then append STYLE and AVOID.

#### C1. Card: আইডিয়া দিন (1:1)
```
Three neighbours sharing an idea on the wooden bench of a tea stall under a mango tree: a young woman in a maroon salwar kameez with a cream orna scarf writes in a notebook on her lap; an elderly man in a white panjabi and white tupi cap smiles and nods; a male college student in a green T-shirt and jeans points at the notebook. A simple marigold light-bulb shape floats above the notebook. Two small glasses of tea on the bench. Centred composition, figures large and clear, plain cream circular background.
```

#### C2. Card: এমপিকে প্রশ্ন করুন (1:1)
```
A neighbourhood courtyard meeting (uthan baithak) under a mango tree: a middle-aged woman in a blue cotton saree stands and raises her hand to ask a question; facing her, a public representative, a man in his fifties in a plain white panjabi with a beige shawl over one shoulder, listens attentively holding a small notebook. Two people sit on red plastic chairs and listen: a man in a checked lungi and a half-sleeve shirt, and a young woman in a lilac hijab and salwar kameez. No banners, no flags, no microphones, no party symbols. Centred composition, plain cream circular background.
```

#### C3. Card: অভিযোগের খোঁজ নিন (1:1)
```
An elderly man with a short white beard, white tupi cap, white panjabi and reading glasses holds a smartphone; on its screen is a simple progress line with three green circles, the last one with a white check mark, and no text. His teenage granddaughter in a white salwar kameez with a navy-blue orna leans in and points at the screen; both are smiling. Behind them, a short stretch of road with a fresh smooth dark patch where a pothole was repaired, and one orange traffic cone. Centred composition, plain cream circular background.
```

#### Category tiles (1:1): shared tile block
Append this to every tile prompt **instead of** the people part of STYLE (there are no people in tiles):
```
Single centred object illustration for a small app tile, bold simple shapes, 4 to 6 flat colours from the palette, slight three-quarter front view, strong clean silhouette that stays readable at 64 pixels, one flat ellipse shadow at most, plain white background, no text, no letters, no numbers, no gradients, no texture.
```

| # | File | Prompt |
|---|---|---|
| T1 | `cat-roads.svg` | `A short piece of cracked dark-grey asphalt road with a deep pothole holding brown rainwater, a few loose red bricks at its broken edge, and an orange-and-white striped traffic cone beside it.` |
| T2 | `cat-drainage.svg` | `An open concrete roadside drain (nala) clogged with plastic bottles, polythene bags and leaves, dark grey-green water overflowing its edge onto the footpath, one cracked concrete drain slab tilted on top.` |
| T3 | `cat-water.svg` | `A green cast-iron hand-pump tube-well on a small square cement platform, with a dented silver aluminium kolshi water pot under its spout and only two drops of water falling.` |
| T4 | `cat-electricity.svg` | `A grey concrete electric pole with a crossbar, a messy tangle of black overhead wires, a small grey transformer box and a street lamp that is switched off; one small marigold spark at a loose wire end.` |
| T5 | `cat-waste.svg` | `An overflowing dark-green municipal waste container with black garbage bags, banana peels and plastic bottles spilling onto the ground, and a black-and-grey house crow standing on its rim.` |
| T6 | `cat-flooding.svg` | `A small single-storey house with a blue corrugated tin roof and a cycle-rickshaw both standing in brown floodwater up to the wheel hubs, a grey-blue rain cloud above with straight rain lines.` |
| T7 | `cat-health.svg` | `A small single-storey rural community clinic with white walls, a deep-green band under the roof, a green door, and a round white plaque with a green plus sign above the door; a stethoscope lying in front. Do not use a red cross or a red crescent.` |
| T8 | `cat-education.svg` | `A single-storey Bangladeshi primary school with cream walls, a red-brick base, green window shutters and a tin roof, with a flagpole flying the national flag of Bangladesh: a dark green rectangle with one solid red circle placed slightly left of centre and nothing else on it; an open book in front.` |
| T9 | `cat-safety.svg` | `A narrow lane at dusk lit by one bright street lamp casting a warm pool of light on the ground, with a deep-green shield bearing a white check mark in the foreground.` |
| T10 | `cat-environment.svg` | `A healthy tree with a rounded green crown and a few red-orange krishnachura flowers, a small sapling and a blue watering can beside it, and a thin brick-kiln chimney with a faint grey smoke trail far behind on the horizon.` |
| T11 | `cat-facilities.svg` | `A two-storey Union Parishad office building, cream walls with a red-brick base and a row of arched verandas, green doors, a small flag of Bangladesh on a rooftop pole (dark green with one red circle slightly left of centre), and a wooden bench in front.` |
| T12 | `cat-other.svg` | `A large terracotta speech bubble with three cream dots inside, a smaller marigold speech bubble behind it, and one small green leaf accent.` |

#### F1. Footer leaves (1:1)
```
Decorative corner cluster of Bangladeshi foliage: two banana leaves, one coconut palm frond and a few small heart-shaped betel leaves, as flat silhouettes in only two greens, #1F5E43 and #2E7D57, on an empty background, no other objects, no text.
```

### 6.5 Review checklist (reject the image if any line fails)

**People and dress**
- Skin is in the warm Bengali brown range: no grey, green, orange or very pale European skin.
- Every face is complete. There are no extra fingers, and hands are simplified the same way across the set.
- The saree is draped Bengali-style with the anchal over the shoulder (not a lehenga). The lungi is checked and tied at the waist. The gamchha is checked. The panjabi is knee-length. The tupi is a plain white cap. Salwar kameez has an orna; the hijab looks natural.
- Ages and genders are mixed across the set, and dress is mixed (saree, salwar kameez, hijab, lungi, panjabi, shirt and trousers).

**Places and objects**
- The rickshaw has **three** wheels (one front, two rear), the puller sits in front and the passenger bench is behind. The CNG is green with a cage.
- The Bangladesh flag, where it appears, is a dark green field with one red disc slightly toward the pole and nothing else. If it is wrong, remove it with a region edit.
- Streets, tin roofs, water tanks, electric poles and tea stalls look Bangladeshi, not Indian, Pakistani or Western.
- The Jatiya Sangsad (panorama only) is a wide low grey building of cylinders and boxes with triangle, circle and rectangle cut-outs, white marble bands and a stepped base, not a dome, mosque, temple or Western parliament. Reject the image if it looks like any of those.

**Things that must not appear**
- Any letters, numbers or fake script (AI Bangla script is always garbled).
- Political or party symbols, posters, real people, or religious symbols in the foreground.

**Technical**
- Same style as the approved hero, colours from the palette.
- SVG within budget, with no `script`, `foreignObject`, `image` or external `href`.

## 7. Build order

1. **Art first** (§6): hero, then the three cards, the 12 tiles and the leaves. Review each image against §6.5 before exporting.
2. **Tokens, type and shell** (§3, header, footer, emergency strip, tab bar). Check that other pages still look right with the green brand: `/report`, `/issue/[ref]`, `/me`, `/office`.
3. **Home sections** (§4) in page order.
4. **Report deep link and track by reference** (§5).
5. **Tests and QA**:
   - unit: `contrast.test.ts`, `language.test.ts`
   - e2e: `smoke`, `a11y`, `audit`, `offline`, `release11` (their home selectors), `perf` (JS ≤ 150 KB gzip, SVG budget)
   - screenshots at 360, 375, 768, 1024, 1280 and 1440 px in Bangla and English, light and dark, and simple-language mode
   - Lighthouse mobile on `/`: LCP, CLS ≤ 0.05
6. **Docs**: `docs/design-system.md`, `docs/aibc/build-provenance.md`.

Branch: cut a new branch from `frontend` (not named `frontend/…`, which that branch blocks), e.g. `ui-home-redesign`.

## 8. Done when

- On a 375 × 812 phone, the H1, sub-line and the voice/photo button show without scrolling, and the category grid is reachable within 2 screens.
- No Bangla text under 15 px on `/`, and body text is 17 px or larger.
- Every text pair is ≥ 4.5:1, body text ≥ 7:1, checked in `contrast.test.ts`.
- Each of the 12 tiles opens `/report` with that category chosen, including after a sign-in detour.
- Home first-load JS is the same or smaller than today. Every SVG is within budget.
- All art passes §6.5, and a Bangladeshi reviewer would recognise every scene as home.
- Bangla and English are complete; dark mode and simple-language mode are readable.
- Privacy rules are unchanged: small counts stay hidden, sample labels stay, and the emergency and "not official" notes are on every page.

## 9. Build notes (17 Nov 2026)

Changes from the plan, made while building:
- **Track card wording.** The Bangla language test bans "অভিযোগ", and the glossary term for a reference number is "সমস্যা নম্বর". The card is "সমস্যার খোঁজ নিন" and the field is labelled "সমস্যা নম্বর".
- **Footer.** A shell unit test keeps the footer inside `<main>`, so the footer is a rounded deep green panel in the content column rather than a full-width band. The red 999 strip reuses the existing string "জরুরি বিপদে ৯৯৯-এ ফোন করুন।" as a `tel:999` link.
- **"আরও দেখুন" stays on home** as chips. On phones it is the only route to projects, Ask your MP and Find your MP.
- **Same section order on phones and desktop** (hero, cards, status, problem types, how it works, news), so reading and tab order match what people see. On phones the area status starts after the three compact card rows.
- **Category preselect** stays on step 1 of the wizard, which also holds the voice/text box, instead of skipping ahead.
- **Dark theme:** the phone hero art has the cream page colour baked in, so in the dark theme it shows as a rounded light card.

Checked: typecheck and lint (no new warnings); 803 unit tests (new: contrast pairs, issue reference, category preselect); axe on all 26 public pages at 375 and 1280 px; smoke, golden, audit and offline e2e; production build with the 150 KB first-load JS budget and the 90 KB SVG budget (both pass). Two e2e tests fail on this dev server with or without the redesign (the offline-queue submit and the keyboard audit landing on the Next.js dev overlay); they were not caused by this work.

Not checked: signed-in report wizard in a browser (covered by a unit test only), Lighthouse CLS after the font switch to `display: swap`, real phones, the `release11` and `release2` e2e suites (separate flag servers), and native-speaker review of the new Bangla strings.
