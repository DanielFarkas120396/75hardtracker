# Daily weigh-in

Date: 2026-10-15 · Status: **merged** into `main` on 2026-10-16 (PR #87), after the owner tried it on the iPhone. Agreed with the owner on 2026-10-15, after a review round that changed the Today card, the starting weight, the end of the attempt and the average line.

## Why

The owner wants the weight to be logged every day of the challenge, and its evolution to show clearly on Stats. The Stats layout stays as it is.

Today, weight is easy to forget and hard to read:

- It can only be logged from Stats ("+ Log"). Nothing on Today asks for it.
- The Weight card starts folded, so the chart is one tap away.
- Weigh-ins aren't tied to the attempt. The chart and list show every weigh-in ever saved, and "−2.6 kg since…" counts from the very first one, not from Day 1.
- The axis shows dates, not challenge days, and can drop labels. With a weigh-in every day, the raw line would zigzag (weight moves 1–2 kg from day to day).

## Decisions

| Topic | Decision |
|---|---|
| How often | Every day, from Day 1 to Day 75. |
| If skipped | Today keeps asking until it's logged, but it **never fails the day**. The five tasks, the gauge, the streak and the day-complete moment don't change. The live attempt is safe. |
| Where it's asked | A card on Today, under the hero, like the "Day N isn't finished" card. Not a sixth tile: the board, its fills and its gauge stay as they are. |
| How it's typed | In the card itself: no sheet. iOS doesn't raise the keyboard for a field focused by code, but it always does for a field the player taps. |
| Stats layout | Unchanged. Only the Weight card's content changes. |
| Data | No new table, no Dexie change. Weigh-ins stay one per date, in `measurements`. |

## Today: the weigh-in card

- **When:** on Days 1 to 75, while today has no weigh-in. It appears under the hero, right after the late-day card when both show, and before the other banners.
- **Look:** a card like the late-day card, on two rows.
  - Row 1: the scale icon, "Weigh in", and a line under it. On Day 1 the line reads "Your starting weight." Other days: "Before breakfast is best."
  - Row 2: the weight field (decimal keypad, 16 px or more), "kg", and a "Save" button in the world colour. The field starts empty; its grey hint is the last weight logged, if there is one.
- **Saving:** the same check as the weigh-in sheet (a number between 20 and 300 kg, "82,5" works). An error shows under the field. The body measurements aren't on Today; they're logged from Stats ("+ Log").
- **After saving:** the card goes away and the board moves up at once, as it does when the late-day card goes. A typo is fixed from the list on Stats.
- **Not shown:** before Day 1, after Day 75, on the late-day screen (yesterday's weigh-in isn't asked afterwards), or once the attempt is over.
- **No way to skip it:** no "Not today", no setting. It goes at midnight. It stays after the day is complete.
- **No typo guard:** a weight far from the last one is saved as typed.
- **Motion:** none.
- The duck doesn't mention weight.

## Stats: the Weight card

Same place, same fold. The weigh-in sheet behind "+ Log" doesn't change. What changes inside the card:

- **Folded header:** the latest weight and the change from the starting weight: "85.8 kg · −2.6 kg".
- **This attempt only:** the chart, the change and the list cover the attempt, from its **starting weight** to Day 75 (or the day reached). Older and later weigh-ins stay saved and in backups, just not on this card.
- **Starting weight:** the last weigh-in from Day 1 or the 7 days before it (so a weigh-in the evening before counts). If there's none, the first weigh-in after Day 1. A weigh-in from months ago, in an earlier attempt, never counts.
- **Headline:** "85.8 kg" and "−2.6 kg since Day 1". When the starting weight comes after Day 1, it says so: "since Day 5". The headline uses the last weigh-in, not the average.
- **Axis in challenge days:** from Day 1 to the day reached, ticks every 10 days ("Day 1", "10", "20", …). A starting weigh-in from before Day 1 sits just before Day 1, and its tick reads "Start".
- **Average line:** each weigh-in is a small dot, and a thicker line shows the 7-day average: the mean of the weigh-ins in the 7 days ending that day. It starts on Day 7, and a day gets an average only when at least 4 of its 7 days have a weigh-in, so the line breaks across long gaps. Until the line has a point, the dots are joined by a plain line, as now.
- **Reading a point:** tap or slide along the chart: "85.8 kg", then "Day 40 · Thu 15 Oct", then the 7-day average when that day has one.
- **Missing days** leave a gap in the dots.
- **List:** unchanged (the last 5, then "Show all"), now limited to the attempt. The measurements show there as now.
- **Chart library:** recharts stays (the average is a second line). Swapping it for plain SVG to shrink the Stats chunk is a separate idea, below.

## Logic

Pure functions in `src/logic/measurements.ts`, with tests:

- `startingWeight(points, startDate)`: the last weigh-in from Day 1 or the 7 days before it, or else the first one after Day 1.
- `attemptWeights(points, startDate, lastDay)`: the starting weight plus every weigh-in after it up to `lastDay`, each with its day number (0 for a starting weigh-in from before Day 1).
- `weightTrend(points)`: the 7-day average for each weigh-in from Day 7, when at least 4 of its 7 days have one.
- `weightSummary` counts the change from the starting weight.

`measurementRepo` gets `getByDate(date)` (the `date` index already exists), for the Today card's live query.

## Dev

Time travel seeds a weigh-in for most days (a slow, noisy drop, a few days skipped, one the evening before Day 1) and none for today, so the chart, the average and the Today card all have something to show.

## Testing

- Logic: starting weight (evening before, 8 days before, none before, only after), the end at `lastDay`, day numbers, the average (starts on Day 7, needs 4 of 7 days, breaks across a gap), the change from the starting weight.
- Today: the card shows with no weigh-in today, hides after saving, says "Your starting weight" on Day 1, shows the last weight as its hint, shows an error for a bad number, isn't there before Day 1, after Day 75 or on the late-day screen, and doesn't change the gauge or completion.
- Stats: the folded header shows the change, "since Day N" when the start is late, the chart's axis is in days, earlier attempts' weigh-ins are left out, the average appears from Day 7.
- On the phone, light and dark: the card on Today (with and without the late-day card), the decimal keypad, the chart with a few weeks of data, reduce motion.

## Out of scope

- Making the weigh-in a task that can fail the day.
- Goal weight, BMI, pounds.
- Charts for the body measurements.

## Parked ideas (from the Stats review, not part of this design)

- The weight chart in plain SVG instead of recharts (recharts is only used there; most of the Stats chunk's 372 kB).
- A 75-day grid, books and badges on Stats, shorter workout cards: the owner keeps the current layout.
