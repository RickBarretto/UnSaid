---
status: accepted
date: 2026-11-18
---

# Use Tauri/Svelte with browser-native media

## Context

Earlier attempts with iced included trying GStreamer and FFmpeg. They ran into
substantial supply-chain and dependency issues, making the approach costly to maintain.

## Decision

Keep Tauri/Svelte and browser-native playback and audio analysis. Keep the supply
chain lean; revisit a separate media backend only for a concrete unmet requirement.

## Consequences

Avoid reintroducing those dependencies by default. Tauri still needs platform
webview/build libraries, and codec support varies. Precise export and advanced
processing may require a separately justified backend later.
