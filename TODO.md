# Product roadmap

The [source specification](https://github.com/RickBarretto/ideas/issues/24)
describes the full product. These phases keep implementation incremental.
Checked items mean implemented in the current code, not verified on every
platform. All future media backends or dependencies need a concrete requirement
and agreement; Tauri/Svelte and browser-native media remain the chosen stack.

## Current manual editing slice

- [x] Tauri shell, Svelte frontend, mise-managed tools and local Bun setup.
- [x] Local file picker/drop import, embedded synced A/V playback, replacement cleanup and codec errors.
- [x] Play/pause, seek, elapsed/total time, speed and keyboard shortcuts.
- [x] User confirmation of first-milestone playback and drag-and-drop.
- [x] Source-time drag selection, edge handles, precise fields, keyboard nudges and I/O marking.
- [x] Selection replay/loop and Original/Edited/Selection modes.
- [x] Non-destructive Remove, normalized/merged cuts, edited-time mapping and undo/redo snapshots.
- [x] Distinguish deselection from cut restoration; per-cut Restore and partial Keep with undo/redo.
- [x] Real mono waveform, windowed FFT/STFT view, horizontal zoom and eight source thumbnails.
- [x] Bounded local audio analysis in a worker; recoverable visualization errors without blocking playback.
- [x] Compact reference-based layout, actual manual-cut counts and disabled pending features.
- [x] Unit/browser regression coverage and screenshot checks; no fake media/detection data.
- [ ] Recheck latest Selection loading, Edited boundary skips and Undo/Redo in the affected native webview/source.
- [x] Compare the current reference layout at desktop and narrow widths; record differences in `design-qa.md`.
- [ ] Verify playback, visualization and cut boundaries on Windows, macOS and Linux webviews.

## Phase 1: precision review and manual operations

- [ ] Timeline click-to-seek, wheel/keyboard zoom, frame stepping and fine audio increments.
- [ ] Multichannel waveform and configurable waveform/spectrum/both display modes.
- [ ] Spectrogram vertical zoom, frequency range/dB scale and zoom-resolved analysis tiles for long recordings.
- [ ] Multiple hotspot/region selection and pending/approved/rejected states.
- [ ] Contextual audition with configurable pre/post context and optional replay after boundary changes.
- [ ] Low-latency A/B and consistent source/edited mappings across every supported operation.
- [ ] Validate pitch-preserving review speed on each platform.
- [ ] Gain presets and custom dB attenuation.
- [ ] Soft mute with configurable 20–100 ms fade envelopes.
- [ ] Shorten with a configurable retained pause rather than a full removal.
- [ ] Protect regions and integrate Keep with future automatic/batch suggestion review.
- [ ] Room-tone handling and click-free cut transitions.
- [ ] Warn about speech overlap and risky operation boundaries.

## Phase 2: silence detection

- [ ] Adaptive RMS/noise floor plus local voice activity detection.
- [ ] Threshold, minimum speech/silence, padding, retained pause and sensitivity controls.
- [ ] Natural/Balanced/Aggressive profiles with conservative defaults.
- [ ] Preview and accept/reject suggestions before changing the edit plan.
- [ ] Synthetic and real speech fixtures covering quiet speech, background noise and false positives.

## Phase 3: speech, fillers, and transcript

- [ ] Offline ASR with word timestamps for pt-BR and English.
- [ ] Hesitations/discourse markers, repetitions, false starts and reformulations.
- [ ] Contextual grammar/prosody checks and high/medium/low confidence.
- [ ] Custom dictionaries and exclusions; never remove ambiguous words blindly.
- [ ] Transcript timestamps, search, filler highlights and click-word seeking.
- [ ] Word selection to create regions and phrase-with-context playback.
- [ ] Text corrections independent of audio edits.
- [ ] Forced alignment after the basic transcript workflow is reliable.

## Phase 4: acoustic events and noise

- [ ] Separate event classifier for coughs, sneezes, throat clearing, breaths, sniffs and mouth sounds.
- [ ] Detect external impulses with reviewable provenance/confidence.
- [ ] Separate continuous noise reduction from event removal.
- [ ] Do not treat VAD as an acoustic-event classifier.
- [ ] Evaluate overlap with speech, false positives and transition artifacts.

## Hotspot review across detection phases

- [ ] Normalize/merge detections while retaining original provenance.
- [ ] Filter/sort by type, duration, time and confidence; search and accurate counts.
- [ ] Previous/next navigation and contextual audition.
- [ ] Individual/batch accept or reject, reviewed visibility and decision history.
- [ ] Find similar events and project-specific exclusions after repeated rejection.
- [ ] Keep manual cuts distinguishable from automatic suggestions.

## Project persistence and shared edit semantics

- [ ] Versioned project/EDL storing all operations in original source time.
- [ ] Save/reopen, autosave and recovery; current cuts/history are memory-only.
- [ ] Cache analysis/model results without rerunning models after each edit.
- [ ] Undo/redo for every supported operation and review decision.
- [ ] Use the same cut/operation semantics for preview and export.
- [ ] Handle replaced/missing source media without modifying original files.

## Export

- [ ] Final review before rendering.
- [ ] H.264/AAC MP4 preserving source resolution/FPS, with quality settings.
- [ ] Cleaned audio-only output and EDL JSON.
- [ ] Define precise cut rendering; re-encoding may be required.
- [ ] Validate preview/export boundaries, fades, room tone and A/V synchronization.
- [ ] Investigate EDL/XML compatibility with external editors after core export works.

## Distribution and performance

- [ ] Configurable profiles and local model setup/cache management.
- [ ] Optional GPU processing after measuring actual model requirements.
- [ ] Batch processing after single-project review/export is reliable.
- [ ] Evaluate a reusable Rust engine/CLI when required by implemented features.
- [ ] Windows, macOS and Linux installers and offline setup documentation.
- [ ] Long-recording memory/cancellation tests and responsive analysis progress.

## Acceptance and platform verification

- [ ] Verify original-file integrity through import, analysis, edits and export.
- [ ] Exercise offline import/analyze/export and reversible operations.
- [ ] Test quiet speech, ambiguous fillers and conservative semantic decisions.
- [ ] Measure temporal errors, smooth mute envelopes and click-free transitions.
- [ ] Test actual audio listening and lip synchronization in each native webview.
- [ ] Keep synthetic/real fixtures for decoder landing behavior, source replacement and boundary regressions.
- [ ] Confirm preview/export consistency and retained-pause behavior.

## Outside the initial scope

Complex multitrack composition, visual effects/color grading, motion graphics,
elaborate visual transitions, stylized captions and social publishing.
Frequency-specific editing is also outside the initial spectrum-view scope.
