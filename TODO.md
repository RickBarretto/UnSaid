# Product roadmap

The [source specification](https://github.com/RickBarretto/ideas/issues/24)
describes the full product. These phases keep implementation incremental.
Checked items mean implemented in the current code, not verified on every
platform. All future media backends or dependencies need a concrete requirement
and agreement; Tauri/Svelte and browser-native media remain the chosen stack.

## Completed manual review and cut slice

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
- [x] User reviewed the reported Selection loading, Edited skip, and Undo/Redo flows and confirmed they work.
- [x] Review the reference-based layout at desktop and narrow widths.

The completed slice is not the full manual-editing phase: gain, soft mute,
shorten, protection, and export remain open; native persistence validation is pending. Keep restores
manual cuts; automatic suggestion rejection and protection are future work.
Audio visualization depends on a browser-supported audio codec and accepts files
up to 256 MiB. It averages channels to mono at 16 kHz and displays a bounded
512-sample STFT (up to 1,600 columns); it is not a full spectral editor. Video
playback and thumbnail codec support also depend on the platform webview.

## Next priorities

1. Validate native project save/reopen, autosave, recovery and missing-source handling.
2. Complete manual operations and their reversible preview behavior.
3. Implement and validate export using the same edit semantics.
4. Add reviewable detection only after the manual workflow is reliable.

## Project persistence and shared edit semantics

- [x] Versioned project JSON storing supported cuts and undo/redo in original source time; additional operation types remain future work.
- [x] Native save/reopen, autosave and recovery implemented; native runtime validation remains pending. Browser save/download, IndexedDB media persistence, reload recovery and shortcuts are also implemented.
- [ ] Cache analysis/model results without rerunning models after each edit.
- [ ] Undo/redo for every supported operation and review decision.
- [ ] Use the same cut/operation semantics for preview and export.
- [x] Missing-source relinking and replacement checks implemented without modifying original files; native runtime validation remains pending.

## Manual operations and precision review (partial phase 1)

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

## Export

- [ ] Final review before rendering.
- [ ] H.264/AAC MP4 preserving source resolution/FPS, with quality settings.
- [ ] Cleaned audio-only output and EDL JSON.
- [ ] Define precise cut rendering; re-encoding may be required.
- [ ] Validate preview/export boundaries, fades, room tone and A/V synchronization.
- [ ] Investigate EDL/XML compatibility with external editors after core export works.

## Silence detection

- [ ] Adaptive RMS/noise floor plus local voice activity detection.
- [ ] Threshold, minimum speech/silence, padding, retained pause and sensitivity controls.
- [ ] Natural/Balanced/Aggressive profiles with conservative defaults.
- [ ] Preview and accept/reject suggestions before changing the edit plan.
- [ ] Synthetic and real speech fixtures covering quiet speech, background noise and false positives.

## Speech, fillers, and transcript

- [ ] Offline ASR with word timestamps for pt-BR and English.
- [ ] Hesitations/discourse markers, repetitions, false starts and reformulations.
- [ ] Contextual grammar/prosody checks and high/medium/low confidence.
- [ ] Custom dictionaries and exclusions; never remove ambiguous words blindly.
- [ ] Transcript timestamps, search, filler highlights and click-word seeking.
- [ ] Word selection to create regions and phrase-with-context playback.
- [ ] Text corrections independent of audio edits.
- [ ] Forced alignment after the basic transcript workflow is reliable.

## Acoustic events and noise

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

## Distribution and performance

- [ ] Configurable profiles and local model setup/cache management.
- [ ] Optional GPU processing after measuring actual model requirements.
- [ ] Batch processing after single-project review/export is reliable.
- [ ] Evaluate a reusable Rust engine/CLI when required by implemented features.
- [ ] Windows, macOS and Linux installers and offline setup documentation.
- [ ] Long-recording memory/cancellation tests and responsive analysis progress.

## Acceptance and platform verification

- [ ] Verify playback, visualization and cut boundaries on Windows, macOS and Linux webviews.
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
