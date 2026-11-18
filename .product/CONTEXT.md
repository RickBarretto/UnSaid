# Architecture Context

## Current stack

- Tauri 2/Rust desktop shell; Svelte 5/TypeScript frontend; Vite and Bun.
- HTML video playback, Web Audio decoding, worker-based waveform/STFT analysis.
- Source-time cut/history model in `src/lib/edits.ts`; versioned JSON projects.
- Native filesystem persistence; browser IndexedDB media storage and recovery.
- Use the versions in [mise.toml](../mise.toml). No hosted service is required.

## Constraints and decisions

- Media stays on-device. Original files remain unchanged; edits are reversible.
- Keep timestamps in original source time. Preview and export must share edit
  semantics; review speed must not change export speed.
- Earlier attempts with iced, GStreamer, and FFmpeg ran into substantial
  supply-chain and dependency issues. This experience led to the current
  Tauri/Svelte stack with browser-native media. Preserve that decision;
  revisit media backends only for a concrete unmet requirement.
  See [the stack decision](decisions/001-desktop-media-stack.md).
- Keep dependencies lean. Justify additions against a concrete feature;
  do not install global tools or add a separate media runtime speculatively.
- Tauri requires native webview/build libraries. Codec support varies by
  platform; browser tests do not establish native playback or save correctness.
- Current analysis is bounded and mono, with a 256 MiB audio-analysis guard.
  Browser cut preview uses seeks; sample-accurate, gapless playback is unverified.
- ASR can miss hesitations; VAD cannot classify coughs. Uncertain detections
  remain reviewable suggestions. Model/backend choices remain open.

## Interface

Follow [DESIGN.md](../DESIGN.md): prioritize the timeline, reveal tools on
demand, and preserve selection and position when panels open. Adapt panels to
narrow windows; keep core actions keyboard/touch accessible with visible labels
and focus.

## Verification

Read spec `status` before implementation. `in-progress` means partial code;
`draft` means future scope. Neither means verified completion.
Report compilation, automated tests, native launch, and actual listening
separately. Validate A/V sync, cut boundaries, transitions, and source integrity
with synthetic and real recordings before marking the relevant workflow done.
