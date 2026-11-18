# Product Roadmap

Based on [ideas#24](https://github.com/RickBarretto/ideas/issues/24), reconciled
with [current scope](../README.md) and [implementation tasks](../TODO.md).
Future quarters are provisional; finish each usable slice before expanding.

## Now — Q4 2026: finish the manual workflow

- [ ] Validate native save, reopen, recovery, and relinking — [Projects](specs/projects.md).
- [ ] Complete precise review and reversible region treatments — [Manual editing](specs/manual-editing.md).
- [ ] Export a reviewed MP4 matching the preview — [Export](specs/export.md).

Already implemented: local playback, selection, Remove/Keep, undo/redo,
three preview modes, waveform/spectrum, and browser project persistence.
Native project code exists; native runtime verification remains pending.

## Next — Q1 2027: reviewable silence suggestions

- [ ] Detect pauses conservatively — [Silence](specs/silence.md).
- [ ] Audition, adjust, accept, or reject hotspots individually, then in batches — [Hotspots](specs/hotspots.md).

## Later

- [ ] Local pt-BR/English transcription and contextual filler detection — [Speech](specs/speech.md).
- [ ] Acoustic events and continuous noise reduction — [Audio cleanup](specs/audio-cleanup.md).
- [ ] Validate Windows/Linux/macOS installers and offline model setup.
- [ ] Add reusable analysis caches and profiles; evaluate batch processing, GPU
  acceleration, CLI, and EDL/XML interchange when core workflows are reliable.
