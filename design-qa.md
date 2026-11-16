# Reference layout verification

## Comparison target and evidence

- Source: `reference.png`, supplied by the user; 1600 × 900 px.
- Implementation: `test-results/reference-layout.png`; Chromium viewport
  1600 × 900 CSS px, device scale 1. Both full views were opened together in
  the same comparison input; no resizing or density normalization was needed.
- State: a loaded local video, Edited mode, a small selected source region,
  visible playhead, waveform, spectrum, thumbnails and action palette.
- Focused evidence: `test-results/timeline-detail.png` and
  `test-results/cleanup-detail.png`, captured from the same page. The timeline
  crop was also opened with the source/full render for label and handle review.
- Responsive evidence: the 390 × 844 viewport test and screenshot verify no
  horizontal overflow. Mobile stacks the workspace instead of squeezing the
  desktop grid into a narrow viewport.

The source depicts interview media and populated automatic detections. The
implementation uses an actual browser-generated test video/audio file and
zero manual cuts. Its constant-amplitude tone correctly produces a uniform
peak envelope. Different video content, waveform shape and detection counts
are intentional data differences, not substituted artwork. No screenshot
interview frame or fabricated detection was inserted into the application.

## Comparison history and fixes

The previous paused-session review identified a stacked workspace, duplicate
timeline tool rows, undersized labels, an oversized rail, incorrect palette
position and uncolored active icons. Its screenshots have since been replaced
by test runs; the findings are preserved in the handoff/conversation history.

The current render verifies the following corrections:

- Preview and Cleanup panel sit beside the tool rail, above a full-width
  timeline. Video controls overlay the preview instead of taking another card.
- Preview modes and selection controls share the timeline header through a
  Svelte snippet. The extra toolbar row has been removed.
- The waveform lane is 100 px high; genuine spectrum and video frames sit below.
- The tool rail is approximately the reference height. Cleanup is capped at
  400 px on desktop, with scrollable content when manual cuts need more space.
- Purple active tool accents, larger transport/category labels, and the
  centered floating action palette replace the earlier mismatched styling.
- Analysis and frame lanes reserve their geometry while decoding, preventing
  layout changes during selection drags. Disabled future actions stay disabled.

At 1600 × 900, the preview starts approximately at x184/y78, close to the
reference's x187/y81. The bottom workspace starts near y526 versus y520 in the
reference. These small grid differences do not hide or overlap controls.

## Required fidelity surfaces

- **Fonts/typography:** system sans-serif hierarchy matches the reference's
  functional style; loaded filenames truncate, controls remain readable and
  numeric time uses tabular digits. Exact native font rendering varies by OS.
- **Spacing/layout:** header, left rail, preview, right panel, and compact
  bottom timeline match the reference structure. The desktop viewport-fit test
  passes; the focused timeline image confirms handles and actions are visible.
- **Colors/tokens:** lavender workspace, white translucent panels, purple
  controls/selection and muted category colors follow the reference. Disabled
  features intentionally have lower contrast than active controls.
- **Image quality/assets:** displayed video frames and analysis come from the
  loaded file. Icons are checked-in MIT-licensed Tabler assets. The browser
  check confirms every displayed image is loaded with nonzero natural width.
- **Copy/content:** actual manual-cut counts replace the reference's fictional
  populated detection state. Pending analysis/export/edit actions are labeled
  unavailable; the interface does not imply those features work.

## Interaction and console verification

- 24 Chromium tests pass, including native local audio/video decoding,
  selection/looping, cut jumps, modes, history, replacement and responsive fit.
- Delayed-seek regressions cover selection resume, switching to Original while
  seeking, rounded decoder landing, paused selection-end seeks and history
  changes during outstanding seeks. These deterministic cases complement
  actual browser playback; they are not evidence about a particular user file.
- The reference screenshot case reports zero page errors or console errors.
- Svelte/TypeScript checks report zero errors/warnings; production build and
  all ten unit tests pass.

The deselection follow-up renames Clear selection to Deselect, explicitly
labels red cut regions, and adds per-cut Restore and partial-selection Keep.
Regression checks verify restoration, preservation of surrounding cuts, and
undo/redo. The reference screenshot case and responsive checks still pass.

## Accepted differences and remaining verification

- Native macOS-style window buttons are not faked inside the browser content;
  Tauri provides the platform window chrome.
- The application retains its own name/icon and functional mode/selection
  controls. Exact brand glyphs and font rasterization are minor polish gaps.
- Detection, attenuation, soft mute, pause shortening, project saving and
  export are future work, tracked in `TODO.md`; this is a reviewed manual-cut
  milestone rather than a claim to implement the entire source mockup.
- The user's affected video/native webview must still be retested for the
  reported loading, cut-skip and history failures. Browser seeks may buffer
  and do not guarantee gapless/sample-accurate transitions.

No actionable P0/P1/P2 visual findings remain for the implemented milestone.

final result: passed
