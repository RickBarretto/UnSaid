---
status: draft
---

# Acoustic cleanup

As a creator, I want unwanted sounds identified and treated so that I can clean
a recording while preserving speech and a consistent background.

## Acceptance

- A local acoustic-event classifier suggests coughs, sneezes, throat clearing,
  excessive breaths, sniffs, mouth sounds, and unwanted laughter where detectable.
- It also flags clicks, typing, knocks, microphone pops, and other impulses.
  VAD alone is not used to identify these event types.
- Point events suggest Remove, Reduce, or Soft mute through [Hotspots](hotspots.md).
  Continuous fan noise, hum, and interference use noise reduction without cutting video.
- Speech overlap is flagged for review; suggestions do not silently mute speech.
  I can compare the result, undo it, and adjust treatment strength.
- Listening and boundary checks evaluate false positives, preserved speech,
  room tone, and transition artifacts before a treatment is considered complete.
