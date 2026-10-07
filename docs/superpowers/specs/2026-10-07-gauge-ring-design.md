# Gauge ring (design)

Status: **built** on `feat/gauge-ring` (2026-10-07), waiting for the owner's check on the phone.

The owner wanted a new completion ring. Two inspiration pictures became two previews in chat (a dial, a bar gauge); the owner picked the gauge, took the crown from the dial, and tuned the motion over many rounds of previews.

## Look
- An arch of 41 bars over 240°, lit from the left in a gradient from the world colour to yellow; unlit bars grey at 25%.
- "today's tasks" above a big count, "/5" right against it, a crown in the arch's gap.

## Motion: one timeline per change
- One front crosses the bars in 700 ms, with one sine ease (`cubic-bezier(.37,0,.63,1)`). Doing a task, it runs from the first bar and lights the new ones as it reaches them; undoing one, it runs back from the old end and dims them.
- A wave rides the front: each bar grows thicker and longer, outward more than inward (task done: width 4.1, +5 out, +3 in; 5/5: 4.6, +8, +4; undo: 3.5, +3, +1.5).
- Short of 5/5, the grey bars ahead absorb the wave all the way to the end, much more softly, fading and slowing.
- The number ticks once per task, the new value at once with a 600 ms pulse (up: grows; down: a soft step back).
- The crown fills with gold from left to right, but only to 70% before 5/5. The label fills from left to right in the world's ink, deepened toward the text colour (always at least world-ink's contrast), and a white glow sweeps through it with the front.
- At 5/5: the crown fills, pops and throws 12 sparkles; the label pops. While the "Day complete!" overlay is up the gauge holds, and plays this when it closes.
- Reduce motion: the end state at once.

## Where
- `src/components/ui/GaugeRing.tsx` replaces `ProgressRing` on Today and before Day 1.
