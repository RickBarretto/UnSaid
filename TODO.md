# TODO

Completed in the playback milestone:

- [x] Tauri shell, Svelte/Vite frontend, pinned mise tools and local Bun setup.
- [x] Local file picker and drag-and-drop import with embedded browser playback.
- [x] Play/pause, seeking, elapsed/total time, speed and Space shortcut.
- [x] Replacement cleanup, replay, codec error handling and responsive layout.
- [x] Production frontend build, type checking and real Chromium integration tests.

Remaining:

- Verify native Tauri launch and local audio/video playback on the target Linux system, including seeking, replay, replacement, drag and drop, and unsupported files.
- Check webview codec support and playback behavior on Windows and macOS.
- Add non-destructive manual editing with source-time selections and an edit decision list.
- Add waveform and spectrogram views, undo/redo, and project save/reopen.
- Add export of the edited result.
- Add reviewable silence and filler detection after the manual editing workflow works.
