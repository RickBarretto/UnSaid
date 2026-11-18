---
status: accepted
date: 2026-11-18
---

# Use the approved islands interface for the editor

## Context

I decided to use [/impeccable](https://impeccable.style/) to remove the slop UI this application had.

The application's UI/UX has not been rewritten yet, but a new concrete proposal has emmerged. The idea is very simple: video and timeline should be the center, the tooling should be well organized and available to work, but without taking our attention away from our central work.

First I asked it to create from scratch based on our documentation rather than on the previous work. I asked it to follow our new DESIGN principles. This was split into two rounds to generate this reference:
1. **Many different ideas**: I asked impeccable to generate 5 designs (html) based on our documentation.
2. **Unifying ideas**: I asked impeccable to take the best of each idea and unify them, having in mind this is an application and not a website. Generated a video preview with GPT Image generator to use in this design too.

## Decision

change the current UI proposal by a better UI/UX based on the principles I've been developing.

Retain the [approved HTML prototype](../../public/designs/unified.html), its
CSS and JavaScript, its entry point, and the original
[video-preview.png](../../public/designs/video-preview.png). Use that image as
its default preview frame. Retain only two rendered mockups:
[desktop light](../../public/designs/desktop-light.png) and
[desktop dark](../../public/designs/desktop-dark.png), both showing the supplied
frame.

## Consequences

This establishes the approved interface direction for future implementation.
The prototype remains separate from the main editor; approval does not mean the
production interface has been replaced.

Theme switching, selection positioning, and local video preview were exercised
in the browser. The prototype's waveform and spectrum remain illustrative;
saving and export are not implemented there. Native desktop behavior, media
analysis, and precise cut playback still require their own implementation and
verification under the feature specs.
