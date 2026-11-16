# UnSaid

UnSaid is a local-first desktop video editor in development. The current milestone opens one local video for playback and review; editing is planned for later. The product direction and visual reference are in the [project specification](https://github.com/RickBarretto/ideas/issues/24).

The interface is built with Svelte and Tauri. Video plays in the webview's HTML video element, using a local file selected through the file picker or dropped into the window. Playback controls include play, pause, seeking, and speed. Opening a file starts it paused; the original file is not modified. Supported formats depend on the platform webview and its available codecs. The app does not launch an FFmpeg or ffplay process.

## Development

Install the project tools and JavaScript dependencies with [mise](https://mise.jdx.dev/) and Bun:

```sh
mise trust
mise install
mise exec -- bun install --frozen-lockfile
```

Run the frontend in a browser at `http://localhost:1420`:

```sh
mise exec -- bun run dev
```

The browser frontend does not need a Rust build. To run the desktop application, install the platform prerequisites below and use:

```sh
mise exec -- bun run desktop
```

Stop a separately running browser dev server first; Tauri starts the frontend
server itself on the same port.

## Linux desktop prerequisites

Tauri uses WebKitGTK on Linux. On Debian or Ubuntu, its build needs a C toolchain, `pkg-config`, WebKitGTK and GTK development libraries, and related platform libraries. Consult the [official Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for the current distribution-specific package list. The baseline includes `build-essential`, `pkg-config`, `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, and `librsvg2-dev`. Install missing system packages independently before building the desktop app. WSL requires a working graphical and audio environment such as WSLg.

## Checks

```sh
mise exec -- bun run check
mise exec -- bun run build
mise exec -- bun run test
mise exec -- bun run desktop:build
```

The tests run in Chromium through Playwright. They generate a short video with
an audio track using browser APIs, then exercise actual decoding, play/pause,
seeking, speed, replay, file replacement, drag and drop, errors, and a narrow
viewport. No FFmpeg executable or downloaded media fixture is required.

Use an existing compatible Chromium installation by setting its executable path:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chromium mise exec -- bun run test
```

Without that variable, Playwright uses its own browser cache. The project does
not automatically download a browser. Tests save screenshots under
`test-results/` and retain traces on failure.

Type checking, the production frontend build, and nine Chromium tests pass in
this development environment. Desktop launch remains unverified: this Linux
environment lacks Tauri's WebKitGTK development prerequisites. No native
packages were installed as a workaround. Browser tests verify audio decoding;
they do not replace listening to audio or checking synchronization in the
target webview.

For desktop review, open a local video, play and pause it, seek while playing
and paused, change speed, reach the end and replay, then replace it with another
file. Also try drag and drop, a filename with spaces or Unicode, and an
unsupported file.
