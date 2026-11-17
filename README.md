# UnSaid

UnSaid is a local-first desktop video editor in development, built with Tauri 2
and Svelte 5. The current slice supports local playback, region selection,
reversible cuts, and media visualizations. It is not yet the complete editor in
the [product specification](https://github.com/RickBarretto/ideas/issues/24).
See [TODO.md](TODO.md) for the remaining roadmap.

## Current scope

| Area | Status | Implemented boundary |
| --- | --- | --- |
| Local playback | Implemented | Import/drop, synced A/V, seeking, speed and replacement; codec support varies by webview. |
| Manual cut editing | Implemented | Source-region selection, replay/loop, Remove, Restore/Keep, undo/redo and three preview modes. |
| Other region treatments | Not started | Gain reduction, soft mute, pause shortening and protection are not implemented. |
| Media visualization | Partial | Real mono waveform, spectrum, eight thumbnails and horizontal zoom; bounded analysis resolution. |
| Reference interface | Implemented | Compact header, tool rail, overlaid video controls, Cleanup panel and timeline; responsive layout. |
| Automatic cleanup | Not started | Silence/filler/acoustic-event detection, transcript and suggestion review are unavailable. |
| Saving and export | Partial | Desktop and browser project save/reopen, autosave, recovery and source relinking; rendered export remains pending. |
| Platform validation | Partial | Chromium regression coverage and user-confirmed workflow; broader OS/codec testing remains. |

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

Desktop and browser sessions support project persistence as described below.
Rendered video export is not implemented. Browser cut previews use
seeks that may buffer; transitions are not guaranteed to be gapless or
sample-accurate. The original file stays unchanged.

## Saving projects

Use **Save** to save a `.unsaid.json` project, and the **Project** menu
to open a project or save a copy. Ctrl/Cmd+O opens a project, Ctrl/Cmd+S saves, and
Shift+Ctrl/Cmd+S saves a copy. The project stores source-time cuts, undo/redo,
review speed, preview mode and playhead; it reopens paused. Media is referenced,
never embedded or modified. Sources inside the project directory use relative
paths with an absolute fallback; other sources use absolute paths.

After the first Save, edits and review preferences automatically update the
project after 750 ms of inactivity. The status shows whether the session is
saved or a write failed. Unsaved sessions also get a local recovery snapshot.
Recovery is offered at startup when it is newer than the saved project;
recovered sessions require Save As. Before replacing a session or closing,
pending writes settle and unsaved work offers Save, Discard, or Cancel.

If a source has moved, use **Locate source** in the Project menu. A size or
duration mismatch requires confirmation; shorter replacements are rejected to
preserve saved cut timings. Waveforms and thumbnails are regenerated on reopen.
Unsupported or malformed project files leave the current session intact.

### Browser storage

In the browser, Save downloads a small project JSON; Ctrl/Cmd+S also works while
controls have focus. Open project (Ctrl/Cmd+O) reads a saved JSON file. Autosave
updates a local browser copy after 750 ms without downloading another file.
Use Save again when you want an updated downloadable backup. Opening an older
download uses the newer local autosave when the project filename and source
match, preserving the current cuts and both Undo/Redo stacks. Discarding the
startup recovery prompt removes that recovery snapshot, not a named project's
saved local copy. The status changes to **Autosaved locally** only after the
write finishes. Rendered Export
remains disabled because video rendering is a later milestone.

Imported videos are copied into IndexedDB on this device so reopening a saved
project or recovering after reload can reconnect them. Edits and undo/redo,
review speed, preview mode and playhead are recovered through **Recover** after
reload. Playhead checkpoints occur about every half second, and on page exit.
Waveform, spectrum and thumbnails are regenerated from the local media.

Recovery requires the same browser profile and site address (including port).
Browser storage quotas or clearing site data can remove local media; the
project JSON does not embed the video. Use Locate source to reconnect the
original file when its cached copy is missing, including on another computer.
Cache/storage failures are shown rather than reported as successful saves.
Browser data stays local; nothing is uploaded. Cached videos remain in site
storage until that data is cleared, allowing older downloaded projects to reopen.

### Native verification

Native integration uses the Tauri dialog plugin, scoped asset URLs and Rust
filesystem commands. Browser regression tests exercise the same UI through an
injected storage adapter; they do not verify native dialogs or filesystem calls.
The recorded native compilation attempt was blocked by missing `pkg-config`,
required to locate native libraries; the release build first failed while probing
`dbus-1`. Linux GTK/webview development prerequisites must also be available. Native project
flows and Rust tests remain unverified until those prerequisites are available.

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

## Architecture and completed fixes

Tauri supplies the desktop shell and Svelte supplies the interface. Browser
`<video>` handles playback; Web Audio decodes audio, a worker computes analysis,
and canvas draws the results. A pure source-time edit model supplies interval
normalization, preview mappings and history. No separate media runtime or player
process is managed by the app; the native webview's platform libraries are still
prerequisites. No media is uploaded.

The current editing workflow also includes fixes for reported playback and
history failures:

- Selection seeks settle their loading state, including paused seeks.
- Seek requests are serialized, with the newest queued target replacing older
  ones; playable positions avoid redundant seeks.
- A bounded 50 ms decoder-landing tolerance prevents repeated seeks when a
  decoder lands slightly before a boundary. This does not promise precise rendering.
- Mode, selection, source and history changes invalidate pending playback
  intent; undo/redo pauses and exposes the changed boundary for review.
- Deselecting a purple selection leaves red cuts intact. Restore and Keep
  explicitly reverse cuts, including partial restoration, with undo/redo.

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
production build, 15 passing unit tests, and browser regressions covering playback, analysis,
project persistence through an injected native adapter, and real IndexedDB
save/reopen and reload recovery.
The two newest seek-race tests were also observed failing before their fixes.
The interface follows the visual reference in the linked product specification
and the checked-in `reference.png`.

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
The user confirmed the current workflow is working, following earlier playback
and drag-and-drop confirmation. That review and Chromium regressions do not
establish behavior across all operating systems, codecs or native webviews.
The recorded automated validation covers the frontend and Chromium. It does
not establish a passing native-build, installer or native-webview test matrix;
those checks remain in TODO. No system packages or standalone runtimes were
installed to work around validation failures.

For native review, play/pause and seek while both paused and playing, change
speed, replay after the end, replace the file, and try drag-and-drop plus an
unsupported file. Then select/loop a short region, remove it, compare Original
and Edited, undo/redo, and check cut boundaries and A/V synchronization by
watching and listening. Browser tests do not replace this review.

## Next milestones and maintenance

Next, validate desktop save/reopen and recovery with the native prerequisites. Complete
the remaining reversible manual operations and precision/contextual review,
then implement export using the same edit semantics. Reviewable local detection
follows as separate milestones. Native-webview and representative-media checks
should accompany each milestone. [TODO.md](TODO.md) records the full scope,
including ASR/transcript, acoustic events, hotspot review, distribution and
acceptance testing.

One-off session reports, unused icons and generated outputs were removed during
cleanup. Durable product status lives here and in TODO. Source, tests, licensed
assets, lockfiles and the user-provided [reference.png](reference.png) remain;
builds and test screenshots are regenerated by the documented commands.
