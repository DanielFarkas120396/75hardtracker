# Guidance under the gauge (design)

Date: 2026-10-11 · Status: **built** (branch fix/today-guidance). Item 2 of the second Today critique (26/40), approved by the owner with "run them all". The duck stays harsh, and "Plan my evening" stays hidden while he hunts (owner's rulings).

## The problem

Today said how much time was left, but rarely what to do:

- The duck's line, the only guidance, showed for 4 s in his bubble. The space under the gauge stayed empty unless a plan existed.
- At 19:30 the duck could be hunting while the hero said "3h30 to bedtime". Nothing showed how much the remaining tasks take.
- At 23:00 the counter jumped from "0 min to bedtime" back up to "1h00 to midnight", which read like a reprieve. After bedtime nothing said what was at stake, or that logging stays open until noon.

## The rule

The space under the gauge always says something. The first case that applies wins:

1. **The day is won:** "Day N won" and "How did it go?" (unchanged).
2. **Urgent, before bedtime:** "3h30 to bedtime" in red, and under it "~5h40 of tasks left". That's the sum of the duck's own estimates for the missing tasks (`minutesToFinish`: 45 min a workout, 60 min a litre, 2 min a page, 2 min for the diet or the photo). It's rounded to 10 minutes from an hour, and to 5 minutes under it.
3. **Urgent, after bedtime:** "Day 12 ends in 45 min" in red, and under it "Logging stays open till noon." The clock still counts to midnight, but it's framed as the day ending, not as a new countdown.
4. **A plan is coming:** "Reading at 21:00" (unchanged).
5. **Otherwise:** the duck's current line ("New day, Sam. I'm watching.", "Started. Not finished.", "Only the water left."). It stays put instead of vanishing after 4 s. VoiceOver hears it change.

While his line sits under the gauge, his bubble doesn't repeat it. The bubble still answers pokes, glares at an unticked task, confirms a saved plan and chats now and then. When the space is taken (cases 1 to 4), his line goes back to the bubble as before.

## Left as is

- The red tile edges, the duck's menace and the one-clock rule (`2026-10-11-evening-one-clock-design.md`).
- The plan sheet.
