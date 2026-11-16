# UnSaid

UnSaid is a local-first desktop video editor in development, built with Tauri 2
and Svelte 5. The current slice supports local playback, region selection,
reversible cuts, and media visualizations. It is not yet the complete editor in
the [product specification](https://github.com/RickBarretto/ideas/issues/24).
See [TODO.md](TODO.md) for the remaining roadmap.

## Try the current workflow

Open a local video with the file picker or drag it into the window. It starts
paused. Playback uses the webview's native HTML `<video>` element with synced
video/audio, play/pause, seeking, elapsed/total time, and review speed. Supported
containers and codecs depend on the browser or platform webview. Media stays
on-device; the app does not launch FFmpeg, ffplay, or another media process.

Drag across the source timeline in either direction to select a region. Adjust
its handles, enter start/end seconds, or use I/O to mark the current playhead.
Focused handles move by 10 ms with arrow keys, or 100 ms with Shift+arrow.
Replay selection auditions the region; Loop selection repeats it.

Remove records a source-time cut without rewriting the file. Original ignores
cuts; Edited skips removed regions and shows the shortened duration; Selection
plays the selected source region, including removed content. Undo/redo restores
cut decisions and moves the preview to the changed boundary. Overlapping and
touching cuts merge. Removing everything disables Edited playback until a cut
is undone or the preview mode changes.

Purple marks the active selection; red marks an applied cut. **Deselect** clears
the selection without changing cuts. Use **Restore** beside a cut in the Cleanup
panel to remove its red area, or select a portion and use **Keep** to restore only
that portion. Both restoration actions participate in undo/redo.

Shortcuts outside form controls: Space plays/pauses, I/O sets selection bounds,
R replays, L toggles selection looping, Delete removes, Ctrl/Cmd+Z undoes,
and Shift+Ctrl/Cmd+Z redoes.

Cuts and history are **in memory only**. Reloading or replacing the video resets
the session. Saving and export are not implemented. Browser cut previews use
seeks that may buffer; transitions are not guaranteed to be gapless or
sample-accurate. The original file stays unchanged.

## Waveform, spectrum, and thumbnails

For decodable local audio in files up to 256 MiB, Web Audio supplies samples for
a real waveform and a windowed FFT/STFT frequency view computed in a worker.
The current analysis averages channels to mono, produces roughly 100 waveform
peaks per second, and uses 64 logarithmic frequency bands. Horizontal zoom
centers the source view around the playhead. Analysis resolution is bounded;
zoom does not yet request more detailed tiles for long recordings.

Eight real video thumbnails are sampled with a separate muted video element;
this does not seek the main player. Audio decoding, absent audio tracks, or
codec limitations can prevent visualization while playback remains available.
The 256 MiB guard applies to audio analysis, not video import. Waveform,
spectrum, and thumbnails are derived from the selected file, not placeholders.
The Cleanup panel shows actual manual cuts; automatic detection and unsupported
operations remain disabled, with no fabricated detection counts.

## Development

Use the project's [mise](https://mise.jdx.dev/) configuration and Bun. Inspect
existing installed tools before adding prerequisites. With the pinned tools
available, install project JavaScript dependencies:

```sh
mise trust
mise exec -- bun install --frozen-lockfile
mise exec -- bun run dev
```

The frontend opens at `http://localhost:1420` and runs independently of a Rust
build. To run the desktop application:

```sh
mise exec -- bun run desktop
```

Stop a separately running frontend server first: Tauri starts the same server
on port 1420. Tauri still requires platform webview/build prerequisites. See
[the official prerequisite guide](https://v2.tauri.app/start/prerequisites/).
On Linux this includes WebKitGTK development libraries and a native build
toolchain; WSL also needs working graphics/audio, such as WSLg. Do not install
additional system packages or runtimes as an automatic build workaround.

## Verification

Current verification: zero Svelte/TypeScript errors or warnings, a successful
production build, ten passing unit tests, and 24 passing Chromium tests.
The two newest seek-race tests were also observed failing before their fixes.
See [design-qa.md](design-qa.md) for the reference comparison and its limits.

```sh
mise exec -- bun run check
mise exec -- bun run build
mise exec -- bun run test:unit
mise exec -- bun run test:browser
mise exec -- bun run desktop:build
```

`bun run test` combines the unit and browser suites. Unit tests cover cut
normalization, timeline mapping/history, and pure audio analysis. Playwright
browser tests generate short local video/audio fixtures using browser APIs,
then exercise playback, selection, cuts, undo/redo, delayed seek regressions,
replacement, drag-and-drop, errors, visualization, and viewport fit. They do
not require FFmpeg or downloaded media fixtures.

Use an existing compatible Chromium installation when needed:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chromium mise exec -- bun run test:browser
```

Otherwise Playwright uses its browser cache; the project does not automatically
download a browser. Screenshots and failure traces go under `test-results/`.
Test scripts describe coverage, not proof of native-webview behavior. The user
confirmed playback and drag-and-drop in the first milestone. The latest
selection/loading, edited seeking, and undo/redo fixes still need review with
the affected source file in the target desktop webview. Automated native launch
in the agent's Linux environment is blocked by missing WebKitGTK/RSVG build
prerequisites; no native packages were installed to bypass that limitation.

For native review, play/pause and seek while both paused and playing, change
speed, replay after the end, replace the file, and try drag-and-drop plus an
unsupported file. Then select/loop a short region, remove it, compare Original
and Edited, undo/redo, and check cut boundaries and A/V synchronization by
watching and listening. Browser tests do not replace this review.
