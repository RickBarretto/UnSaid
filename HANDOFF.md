# UnSaid session handoff

## Latest verified resume update

This update supersedes the archived paused-session snapshot below.

### Commit status

The user confirmed the workflow works and requested sub-agent-written commit
messages for each logical change. Sol reviewed the diff and proposed four
whole-file groups, preserving coherent imports and state:

- `f9bbb2b` — Add reversible source-time cuts and restoration.
- `52fdd98` — Analyze local audio and extract source thumbnails.
- `91e1ed9` — Integrate region editing into the reference workspace.
- Documentation is the final group: Document the editing workflow and
  remaining product roadmap. Consult `git log` for its commit ID.

These commits have not been pushed. Earlier references to uncommitted work
below describe historical snapshots, not the current implementation state.

### Follow-up: deselection versus cut restoration

- User confirmed the previous fixes work, then reported that Clear selection
  left a red area. Red overlays represent applied cuts, not active selections.
- Renamed the control Deselect and added a legend distinguishing purple
  selections from red cuts. Deselect deliberately preserves cut decisions.
- Enabled Keep for restoring the selected overlap with cuts; added per-cut
  Restore buttons in Cleanup. Restoration can split a cut and is undoable.
- `restoreRegion` in edits.ts and unit/browser regressions cover these actions.
- Latest verification: **10 unit tests and 24 browser tests pass**, with zero
  type-check errors/warnings and successful production build. No dependencies
  added. The user subsequently confirmed the workflow and authorized commits.

- Resumed the pending layout changes and completed their verification.
- Current result: zero type-check errors/warnings, successful production build,
  **8 unit tests and 22 Chromium tests passing** at that point. A final focused screenshot
  test also passes with Edited mode and an active selection.
- Added two regressions which failed before fixing them: Original Play during
  an outstanding seek, and a paused seek to the selection end with Loop enabled.
  Original now queues playback through the seek coordinator; paused loops no
  longer implicitly start playing.
- The previously written Selection/loading, Edited cut-jump, and Undo/Redo
  fixes remain covered, including decoder-rounded and delayed-seek simulations.
- Compared `reference.png` with fresh 1600×900 browser output and focused
  timeline evidence. `design-qa.md` records a pass for the implemented manual
  editing milestone, accepted content differences, and native verification
  limits. Browser console/image-loading checks pass.
- README now reflects waveform/spectrum/thumbnail limits and current test
  coverage. TODO now covers the original issue's full roadmap, with future
  operations and incomplete features explicitly unchecked.
- Terra (medium) reviewed transport; Sol (low) updated README/TODO. Both have
  finished their assignments. No dependencies were added during this resume.
- The implementation changes after `b2321a6` have been committed as listed
  above, including the user's `reference.png`. The user confirmed the reported
  workflow is working; broader platform/codec coverage remains in TODO.
- Next: choose the next focused milestone from TODO. Do not push unless asked.
- Recheck the local preview process before reuse; test web servers may have
  stopped when their suites finished. Run `mise exec -- bun run dev` if needed.

## Archived snapshot from the prior pause

Saved 2026-11-16 at the user's request to return later. **Work is in progress;
the latest visual changes have not been verified.** Read `AGENTS.md` first.

## User intent and decisions

- Canonical specification: https://github.com/RickBarretto/ideas/issues/24.
  The full body and last image comment were reread during this session.
- The user wants incremental implementation with smaller agents: Terra at low
  or medium reasoning, Sol at low reasoning. Keep one integration owner.
- The user rejected Iced, iced_video_player, FFmpeg/ffplay subprocesses, and
  dependency-installation workarounds. Use **Tauri 2 + Svelte 5** and the
  webview's built-in video element. Use **mise** and the installed Bun.
- Do not install system packages, new global tools, or standalone runtimes to
  work around build errors. Do not restore abandoned media backends.
- Browser APIs supply playback, audio decoding, canvas rendering, and workers.
  No new npm dependencies were added for the editing or visualization work.
- Local media stays on-device; never modify the original file.
- Ask the user to review before committing a completed milestone. Do not push
  or commit current changes without a new instruction.

## Repository and commit state

- Working directory: `/home/rickd/projects/UnSaid`.
- Last commit: `b2321a6` — `Build Tauri and Svelte local video playback milestone`.
- Everything since that playback milestone is **uncommitted**: editing,
  playback fixes, redesigned layout, media analysis, tests, documentation,
  and checked-in SVG icon assets.
- `reference.png` is a user-provided, currently untracked reference image.
  Preserve it. It now exists, despite an earlier failed image lookup.
- An older copy is `/tmp/unsaid-reference.png`. The repo's `reference.png`
  is the current visual truth: 1600 × 900 pixels.
- Original abandoned Iced sources/build artifacts, downloaded Iced crate
  cache, and temporary FFmpeg files were removed. The mise-managed Rust
  compiler was retained for Tauri. No apt installations succeeded.

## User review and unresolved reports

The user confirmed the first milestone's playback and drag-and-drop work.
They then requested region selection/looping and non-destructive cuts.
Review of that work reported:

1. Selection mode shows “Loading video...” and does not play.
2. Edited playback takes too long to skip a removed region.
3. Undo and redo appear not to work.
4. The stacked layout drifted from the supplied GUI. Follow the reference.
5. Remember the original issue and its full feature set.

Fixes for these reports are written and browser regressions passed, but the
user has **not reviewed the fixes in the affected native webview/video**.
An optional question about the affected platform/container is still unanswered.

## Current implementation

### Editing model

- `src/lib/edits.ts`: pure source-time cut intervals, normalization/merging,
  retained intervals, original/edited timeline mappings, undo/redo snapshots.
- `src/lib/SelectionTimeline.svelte`: drag either direction, edge handles,
  precise numeric bounds, 10 ms keyboard nudges (100 ms with Shift), source
  playhead, cut overlays, waveform/spectrum display and horizontal zoom.
- `src/App.svelte`: Original / Edited / Selection modes, selection replay and
  looping, remove, undo/redo, keyboard shortcuts, shortened edited seek bar.
- Cuts/history remain **in memory**. Replacement/reload resets the session.
  Saving and export are not implemented.

### Playback fixes written

- One pending seek plus a coalesced latest queued target; resume intent waits
  for `seeked`. Avoid redundant `currentTime` assignments at playable positions.
- `seeked`/`loadeddata`/`canplay` settle loading; paused seeks do not leave a
  waiting overlay indefinitely.
- A bounded 50 ms landing guard prevents repeated seeks when a decoder reports
  a position slightly before the requested boundary. This is browser preview,
  **not a guarantee of gapless or sample-accurate cut rendering**.
- Mode/selection/history changes invalidate stale play intent.
- Undo/redo pauses and moves the preview to the earliest changed cut boundary
  (or next retained source position on redo), making the change reviewable.

### Reference-based UI

- Main shell now has a compact header, left tool rail, central video with
  overlaid transport, right Cleanup panel, and bottom timeline/action palette.
- Cleanup shows actual manual cut counts. Automatic categories, Analyze,
  Export, Shorten, Soft mute, Reduce volume, and Keep are disabled with honest
  pending-feature descriptions; no fabricated detection counts.
- `src/lib/CleanupPanel.svelte` owns the right panel.
- `public/icons/` holds MIT-licensed SVG assets copied from Tabler's official
  repository, plus its LICENSE. These are static assets, not a package/runtime.
- Waveform/spectrum/filmstrip lanes reserve space while decoding, preventing
  asynchronous layout shifts from breaking pointer selection.

### Actual media visualization

- `src/lib/mediaAnalysis.ts`: AudioContext decodes local audio at 16 kHz;
  abort-aware generation lifecycle; 256 MiB input guard. Unsupported/no-audio
  files receive a recoverable visualization message; playback still works.
- `src/lib/audioAnalysisCore.ts`: mono averaging, peaks around 100 Hz (capped
  at 200k), Hann-windowed 512-point FFT, 64 logarithmic bands, up to 1600 columns.
- `src/lib/audio.worker.ts`: thin worker wrapper; transfers computed buffers.
- Eight real video thumbnails are sampled using a separate muted/off-DOM
  video element. Thumbnail extraction must never seek the main player.
- Original URL ownership stays with App; worker/thumbnail work is aborted on
  replacement/destruction. No FFmpeg or other external media process.

## Verification completed, and its limits

- Before the **latest layout refinements**, all **20 Playwright browser tests**
  passed. These include actual generated local video/audio playback plus
  deterministic delayed/rounded seek simulations for the reported failures.
- Four edit-model unit tests passed.
- Four additional pure audio-analysis tests passed after extracting the worker
  core: silence, 220 Hz tone/frequency band, stereo cancellation, short/invalid
  input. Full combined suite has not yet run after that extraction.
- Earlier Svelte checks/build passed. One unused CSS warning was subsequently
  removed. **Rerun checks/build after the latest changes.**
- Screenshot artifacts under ignored `test-results/` include
  `reference-layout.png`, `loaded-player.png`, and `region-editor.png`.
  They predate the latest layout refinements; do not present them as current.
- Native playback/d&d were user-confirmed. Automated native Tauri launch remains
  unavailable in this agent's Linux environment: WebKitGTK/RSVG development
  prerequisites are absent. mise-managed Rust/Cargo themselves are installed.

## Latest edits that still require validation

After the last successful 20-browser-test run and visual QA, the following
changes were applied but **not yet checked or rendered**:

- Merged preview mode/replay/loop controls into SelectionTimeline's heading
  using a Svelte `controls` snippet; removed the extra stacked toolbar row.
- Increased waveform canvas and lane from 72 to 100 px.
- Increased cleanup summary/category and transport text sizes.
- Reduced desktop tool-rail button padding to match reference height.
- Capped desktop Cleanup panel at 400 px.
- Moved floating action palette from bottom:124px to bottom:100px.

Next check the snippet syntax, responsive wrapping, pointer targets, actionbar
placement and whether any new heading controls collide. Active icon tint and
remaining minor visual differences still need a final pass.

## Commands and installed tools

mise pins Rust 1.100.0, Node 25.6.1, Bun 1.3.12. Project config has been trusted.

```sh
mise exec -- bun run check
mise exec -- bun run build
mise exec -- bun run test:unit
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/home/rickd/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome mise exec -- bun run test:browser
mise exec -- bun run dev
```

The Chromium path is an **existing** browser, not one installed for this task.
No browser download is necessary here. Port 1420 may already have the preview
server running; Playwright reuses it. Stop the standalone Vite server before
`mise exec -- bun run desktop`, because Tauri starts the same frontend server.

`bun run test` runs both unit and browser suites. Playwright only discovers
`*.spec.ts`; unit tests live in `tests/unit` and use Node's built-in test/assert
APIs under Bun, avoiding an extra unit-test framework/type package.

## Resume in this order

1. Read this file and `AGENTS.md`; inspect git diff without discarding WIP.
2. Run type checks/build and all unit/browser tests after the latest changes.
3. Capture 1600×900 and narrow screenshots; compare `reference.png` and the new
   render together. Preserve real-media behavior; do not fake chart data,
   interview images or detection results to match screenshot content.
4. Finish visual QA and create `design-qa.md`. The image-to-code/design-QA
   skills were read/applied; no final QA report exists yet.
5. Reconcile README/TODO, which currently lag the new visualization work and
   test counts. Expand TODO against the **full original issue**, not just the
   first manual-cut slice (see feature checklist below).
6. Ask the user to retest Selection, Edited playback and Undo/Redo with the
   affected source file/webview; distinguish browser tests from native review.
7. Ask for review/commit permission once changes are concrete and verified.

## Original issue: remaining feature checklist to reconcile into TODO

This is a product roadmap, not authorization to add dependencies or implement
every phase at once. User's Tauri/Svelte/browser-media decision supersedes the
issue's candidate GPUI/Iced architecture.

- Precision timeline: click-to-seek, wheel/keyboard zoom, frame stepping,
  small audio increments, multichannel waveform, multi-hotspot selection,
  approved/rejected/pending states and contextual audition.
- Playback: configurable pre/post context, automatic replay after boundary
  adjustments, cross-platform pitch-preserving review speed, low-latency A/B,
  and consistent original/edited mapping.
- Region operations: gain presets/custom dB; soft mute with configurable
  20–100 ms fade envelopes; shorten with retained pause; Keep/Protect;
  room tone and click-free cut transitions; speech-overlap risk warnings.
- Silence: adaptive RMS/noise floor plus local VAD; threshold/minimum speech
  and silence/padding/retained pause/sensitivity; Natural/Balanced/Aggressive.
- Fillers: offline word-timestamp ASR, pt-BR and English hesitations/markers,
  repetitions/false starts/reformulations; contextual grammar/prosody and
  high/medium/low confidence; custom dictionaries/exclusions. Ambiguous words
  must not be removed blindly.
- Acoustic events: separate classifier for coughs/sneezes/throat clearing,
  breaths/sniffs/mouth sounds and external impulses; separate continuous
  noise reduction; avoid treating VAD as an event classifier.
- Hotspots: normalized/merged intervals with detection provenance; type,
  duration/time/confidence filters/sort; search/counts; previous/next;
  individual and batch accept/reject, reviewed visibility, decision history,
  Find similar and project-specific repeated-rejection exclusions.
- Transcript: click words to seek, select words for regions, timestamps,
  search, filler highlighting, text corrections independent of audio,
  phrase-with-context playback; forced alignment later.
- Spectrogram: horizontal/vertical zoom, waveform/spectrum/both modes,
  frequency range and dB scale controls, temporal region selection,
  zoom-resolved analysis tiles for long recordings. Frequency-specific
  editing is outside the initial scope.
- Persistence: versioned project/EDL for all actions in original source time,
  autosave, cache results without re-running models on every edit, undo/redo
  across all supported operations; share cut semantics between preview/export.
- Export: H.264/AAC MP4, source resolution/FPS, cleaned audio-only, EDL JSON,
  quality settings, final preview and A/V synchronization tests. Precise cuts
  may require re-encoding. Validate EDL/XML editor compatibility later.
- Distribution: configurable profiles, model cache/setup, optional GPU,
  batch processing, reusable Rust engine/CLI and installers for all three OSes.
- Acceptance: source integrity, offline import/analyze/export, reversible
  actions, smooth mute envelopes, conservative semantic decisions, preview vs
  export consistency, synthetic/real-fixture tests for false positives,
  temporal errors, transitions and A/V sync.
- Explicitly outside initial scope: complex multitrack composition, visual
  effects/color grading, motion graphics, elaborate visual transitions,
  stylized captions and social publishing.
