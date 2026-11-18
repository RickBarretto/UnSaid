---
status: in-progress
---

# Manual editing

As a creator, I want to inspect and treat precise regions so that I can clean
speech without losing meaning or natural pacing.

## Acceptance

- I can open/drop local video, seek, and review synced audio/video offline.
- I can select on waveform or spectrogram, refine handles or numeric bounds,
  zoom, step frames, and nudge audio boundaries in 10 ms increments.
- I can inspect mono/multichannel waveforms and switch waveform/spectrogram/both;
  spectrum controls offer time/frequency zoom, frequency range, and dB scale.
- I can replay/loop with configurable context, optionally replay after boundary
  changes, and compare Original/Edited/Selection at the corresponding position.
- I can review at 0.5×, 0.75×, 1×, 1.25×, 1.5×, or 2×; preserve pitch where supported.
- Remove closes the audio/video gap; Reduce applies configurable dB attenuation;
  Soft mute uses adjustable 20–100 ms fades; Shorten retains a chosen pause.
- Keep restores manual cuts or rejects a suggestion; Protect excludes a region
  from future automatic edits. Deselect only clears the selection.
- I can undo/redo every operation. Transitions avoid audible clicks, preserve
  room tone where practical, and flag known risks to adjacent/overlapping speech.
- The timeline remains usable with optional panels hidden. Core actions have
  keyboard access and touch alternatives; narrow layouts and 200% zoom retain them.

## Current boundary

Playback, selection refinement, horizontal zoom, Remove/Keep, preview modes,
and cut history exist. Other treatments, advanced inspection, contextual audition,
and native precision/listening checks remain open. Frequency-specific editing is out of scope.
