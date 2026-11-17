# First-glance and plain-language field test (F6.3)

Masterplan §19.9 and §3.3. Run before pilot go-live and again after every large wording change. The app cannot do this part: it needs people. This sheet is the protocol and the log.

## Who

At least 12 people per round, from at least three districts. Mix on purpose:

- ages under 25, 25 to 50 and over 50 (at least 3 over 50);
- education from primary school to degree (at least 3 with primary or less);
- at least 3 first-time smartphone users;
- at least 2 people who use a screen reader or large text, if they can be found.

Do not use office staff, developers or friends who have seen the app. Note the district, age band, education and phone, never names or numbers. Get spoken consent to record the answers; the answers are about the screen, not the person.

## How (per screen, about 5 minutes)

1. Hand over a phone showing the screen in Bangla. Do not explain it.
2. Ask: "What can you do here?" and "What would you do next?" Start timing.
3. Pass if the person says the next action in plain words within 5 seconds, with no hint. Record the seconds.
4. Ask which word or sentence was hard. Write it exactly as the person said it.
5. Task test: ask the person to do the thing (report a pothole, find your MP, read the status of a report). Record done, done with a hint, or not done.

## Screens, in this order

| # | Screen | Task |
|---|---|---|
| 1 | Home | "Where would you tap to tell about a broken road?" |
| 2 | Report (all steps) | Send a report with a photo or by voice |
| 3 | A report's page (status) | "Has the office seen it? What happens next?" |
| 4 | Find your MP | Find your own MP |
| 5 | Ask your MP | Send a question |
| 6 | Ideas | Support an idea |
| 7 | Help and Contact (`/help`, `/help/contact`) | Tell us something is wrong |
| 8 | Emergency help (`/help#emergency`) | "Who do you call if someone is in danger?" |

Run each screen in Bangla first; run a few in English with people who read it.

## Log (copy one row per person per screen)

`docs/aibc/language/first-glance-log.csv` with the header:

```
round,date,district,age_band,education,first_time_smartphone,screen,seconds_to_say_next_action,passed_5s,task_result,hard_words,notes
```

## Pass line and follow-up

- At least 80% of people pass the 5-second check on each screen, and at least 80% finish each task without a hint.
- Every hard word is entered in `strings-review.csv` (column `better_wording`) and fixed in `src/lib/strings/`; then the language tests and the accessibility checks run again.
- Write the round summary (people, pass rates per screen, words changed, what was not fixed and why) at the end of this file under "Rounds".

## Rounds

None run yet. Task-completion rate and the hard-word list are filled here after each round.
