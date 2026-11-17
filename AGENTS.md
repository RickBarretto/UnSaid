# Working on UnSaid

Read `README.md` for the current implementation, limitations and setup, and
`TODO.md` for remaining product scope and the next milestones.

## Product and current stack

- Read the specification in https://github.com/RickBarretto/ideas/issues/24.
  Its last comment contains the visual reference for the application.
- Build a desktop application with **Tauri and Svelte**. The previous Iced
  implementation was rejected; do not restore it or `iced_video_player`.
- For the current playback milestone, use the webview's built-in HTML video
  element. Do not add FFmpeg, ffplay, libmpv, GStreamer bindings, or a separate
  player process. Revisit media backends only when a concrete requirement calls
  for one and the user has agreed to the change.
- Keep media local and preserve original files. The eventual editor must use
  non-destructive edits.

## Work incrementally

- Go step by step. Deliver a small working milestone before expanding the
  system; do not try to implement the entire issue at once.
- Prioritize something the user can run and inspect promptly.
- Open focused GitHub issues when useful for deferred work or blockers.
- Follow the user's latest corrections and scope decisions throughout the task.

## Tools and dependencies

- **The user has mise.** Inspect the existing mise configuration and installed
  tools before declaring a compiler, package manager, or runtime missing.
- Use mise-managed tools. A tool missing from the agent's PATH does not prove
  that the user lacks it; check activation and installed toolchains first.
- Keep the dependency footprint small. Prefer browser/platform capabilities
  and the chosen framework's facilities over extra libraries and services.
- Use the existing mise-managed Bun for project JavaScript dependencies.
  Keep dependency manifests and lockfiles consistent.
- Do not install global/system packages, add another toolchain manager, or
  download standalone runtimes as a workaround for a failed build. Report the
  concrete prerequisite and its purpose instead of chasing more packages.
- Do not reintroduce dependencies from the abandoned implementation. Remove
  obsolete dependencies and generated artifacts as the stack changes.
- Cleanup must target additions made for this task; preserve unrelated tools,
  user files, and pre-existing dependencies.

## Delegation

- Delegate bounded implementation tasks to smaller agents, as requested by the
  user: **Terra with low or medium reasoning**, and **Sol with low reasoning**.
- Give agents separate file ownership and clear shared interfaces. Keep one
  agent responsible for integration and verification.
- Explain which agents are running and what they own when asked.

## Communication and verification

- Keep updates short, concrete, and candid. Explain why a dependency is needed
  before introducing it, rather than repeatedly requesting more installations.
- Distinguish code written, successful compilation, passing tests, a window
  actually launched, and media playback actually verified.
- Do not call the project ready or promise a working demo until the relevant
  user flow has been exercised. State any remaining verification limits.
- Do not claim that switching to a browser removes all native dependencies:
  Tauri still has platform webview prerequisites, and codecs vary by platform.
