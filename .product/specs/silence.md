---
status: draft
---

# Silence suggestions

As a creator, I want excessive pauses suggested for review so that I can speed
up cleanup while keeping intentional pauses and quiet speech.

## Acceptance

- Analysis runs locally and proposes hotspots without applying edits.
- Energy/RMS with an adaptive noise floor and local VAD provide complementary
  evidence; the first usable slice exposes pause candidates for manual review.
- I can adjust threshold, minimum pause/speech durations, speech padding,
  retained pause length, and sensitivity.
- Natural, Balanced, and Aggressive presets explain the pacing tradeoff;
  defaults favor preserving speech and breathing room.
- I can audition, adjust, accept, or reject each candidate through [Hotspots](hotspots.md).
- Synthetic and real quiet/noisy speech fixtures measure false positives and
  boundary errors before detection is described as reliable.
