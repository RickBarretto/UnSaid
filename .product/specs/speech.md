---
status: draft
---

# Speech and fillers

As a creator recording in Brazilian Portuguese or English, I want searchable
speech and contextual filler suggestions so that I can find distractions without
removing meaningful words.

## Acceptance

- After explicit local model setup, transcription runs offline with word timestamps.
- I can click words to seek, select words to create regions, search phrases,
  view highlighted fillers, and replay phrases with context.
- Correcting transcript text does not change audio. I can refine inaccurate
  timestamps on waveform/spectrogram; forced alignment is a later refinement.
- Suggestions cover vocal hesitations, recurring discourse markers, repetitions,
  false starts, reformulations, and interrupted/restarted speech.
- Detection considers grammar, neighboring words, pauses, position, recurrence,
  confidence, and available prosody. It preserves meaningful uses such as
  “tipo de arquivo” and “I like Rust” rather than blindly matching a word list.
- I can customize expressions, rules, and exclusions. High/medium/low confidence
  guides [review](hotspots.md); ambiguous candidates are never removed by default.
- Recognition may omit short hesitations; detection does not rely solely on text.
  Evaluate both languages with real and synthetic speech, including false positives.
