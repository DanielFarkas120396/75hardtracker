# Daily weigh-in

Date: 2026-10-15 · Status: **proposed**, waiting for the owner's OK. Nothing built yet.

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
| Stats layout | Unchanged. Only the Weight card's content changes. |
| Data | No new table, no Dexie change. Weigh-ins stay one per date, in `measurements`. |

## Today: the weigh-in card

- **When:** on Days 1 to 75, while today has no weigh-in. It appears under the hero, above the board (after the late-day card when both show).
- **Look:** like the late-day card: an icon (the scale), "Weigh in", a line under it, and a "Log weight" button in the world colour. On Day 1 the line reads "Your starting weight." Other days: "Before breakfast is best."
- **Tap:** opens the weigh-in sheet with today's date and the weight field focused (decimal keypad). The four body measurements fold under "Add measurements", so a daily weigh-in is one number and Save.
- **After saving:** the card goes away. The weight shows on Stats.
- **Not shown:** before Day 1, after Day 75, on a late day (yesterday's weigh-in isn't asked afterwards), or once the attempt is over.
- **Motion:** none. When the card leaves, the board moves up at once, as it does when the late-day card goes.
- The duck doesn't mention weight.

## Stats: the Weight card

Same place, same fold. What changes inside:

- **Folded header:** the latest weight and the change since Day 1: "85.8 kg · −2.6 kg".
- **This attempt only:** the chart, the change and the list start from the attempt's **starting weight**, which is the last weigh-in on or before Day 1 (so a weigh-in the evening before counts). Older weigh-ins stay saved and in backups, just not on this chart.
- **Headline:** "85.8 kg" and "−2.6 kg since Day 1".
- **Axis in challenge days:** Day 1 to the day reached, ticks every 10 days ("Day 1", "Day 10", …). A weigh-in from before Day 1 sits at the start, labelled "Start".
- **Trend line:** each day's weigh-in is a small dot; a thicker line shows the 7-day average, once there are 7 weigh-ins. Before that, the dots are joined by a plain line, as now.
- **Reading a point:** tap or slide along the chart: "85.8 kg · Day 40 · Thu 15 Oct", with the 7-day average under it.
- **Missing days** leave a gap in the dots; the average skips them.
- **List:** unchanged (the last 5, then "Show all"), now limited to the attempt. The measurements show there as now.
- **Chart library:** recharts stays (adding the trend is a second line). Swapping it for plain SVG to shrink the Stats chunk is a separate idea, below.

## Logic

Pure functions in `src/logic/measurements.ts`, with tests:

- `startingWeight(points, startDate)`: the last weigh-in on or before Day 1, or the first one after it.
- `attemptWeights(points, startDate)`: the starting weight plus every weigh-in after it, each with its day number.
- `weightTrend(points)`: the 7-day average for each weigh-in (the mean of the weigh-ins in the 7 calendar days ending that day).
- `weightSummary` counts the change from the starting weight.

`measurementRepo` gets `getByDate(date)` (the `date` index already exists), for the Today card's live query.

## Dev

Time travel seeds a weigh-in for most days (a slow, noisy drop, a few days skipped), so the chart and the trend have something to show. A scenario with no weigh-in today shows the card.

## Testing

- Logic: starting weight (evening before, none before, only after), day numbers, the 7-day average with gaps, the change since Day 1.
- Today: the card shows with no weigh-in today, hides after saving, says "Your starting weight" on Day 1, isn't there before Day 1, after Day 75 or on the late day, and doesn't change the gauge or completion.
- The weigh-in sheet: measurements folded by default, saving with only a weight works.
- Stats: the folded header shows the change, the chart's axis is in days, earlier attempts' weigh-ins are left out, the trend appears from 7 weigh-ins.
- On the phone, light and dark: the card on Today (with and without the late-day card), the decimal keypad, the chart with a few weeks of data, reduce motion.

## Out of scope

- Making the weigh-in a task that can fail the day.
- Goal weight, BMI, pounds.
- Charts for the body measurements.

## Parked ideas (from the Stats review, not part of this design)

- The weight chart in plain SVG instead of recharts (recharts is only used there; most of the Stats chunk's 372 kB).
- A 75-day grid, books and badges on Stats, shorter workout cards: the owner keeps the current layout.
