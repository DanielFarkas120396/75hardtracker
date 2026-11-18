# Coherence pass

Date: 2026-11-18 · Status: **merged** into `main` on 2026-11-18 (PRs #103–#106); phone check pending. Agreed with the owner on 2026-11-18: every recommended pick, and the bedtime question in onboarding for the first evening.

## Why

The dummy-proof run (report: https://claude.ai/artifact/71v8ttDxKBo8i6JJAHBGGK) found nothing broken after PR #102, but twelve places where the app says or does the same thing in different ways. Those make it feel less finished to someone new.

## What changes

### A: wording and units

1. **Workouts tile, one pattern.** "done of required · what's next": `0 of 2 · 45 min, 1 outdoors`, `1 of 2 · next outdoors`, `1 of 2 · 45 min`. "Too short · 45 min needed" stays (PR #102). "One must be outdoors" stays.
2. **One duration format**, the "5h40" style already used by the duck: `55 min`, `1h`, `1h05`, `53h15`. One formatter for workouts, Stats, Victory and the duck.
3. **Weigh-in hint follows the clock.** "Before breakfast is best." in the morning; "Any time today works." from noon.
4. **Small copy.**
   - The social sheet says "Social night", like its button.
   - The PIN screen mentions Face ID only when Face ID is on.
   - The Stats shelf label is 12 px, not 9 px.
   - The restart screen shows the missed days before "You said: …", like the joker screen.
   - Rules gets its own icon in Settings.

### B: motion

5. **"Day done" once a day.** The full-screen celebration plays the first time the day is won. Unticking and re-ticking the same day gets only the duck's nod.
6. **The duck's line waits for the gauge.** It never asks for a task that's already ticked.
7. **"Plan my evening" stays in place.** While the duck hunts it's greyed out, with a short reason, instead of disappearing.

### C: first run

8. **Bedtime question in onboarding.** One step: "When do you go to bed?" (default 23:00), saved where Settings already keeps the bedtime. The first evening's countdown runs on the player's real bedtime.
9. **"Sign below ↓"** on the deal screen while the pad is out of view.

### D: layout and patterns

10. **Urgent beats optional.** "Day N isn't finished" gets the urgent outline; "Weigh in" gets the quiet one.
11. **Victory.** The lone last stat tile spans both columns; "Start a new challenge" clears the nav.
12. **Patterns.**
    - Editing a weigh-in opens a bottom sheet, like the rest of the app.
    - Gallery gets the "Attempt #N" and streak header.
    - Water gets "Other amount", in 50 ml steps.
    - The four-step give-up flow stays as the owner wanted it.

## Not changing

Badge toasts stay at the top (see the journal's open items).
