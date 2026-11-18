---
status: draft
---

# Export

As a creator, I want to export the reviewed result so that I can share a clean
recording matching what I previewed.

## Acceptance

- I can review the edited result before rendering locally, without a service.
- The first slice exports Remove cuts as H.264/AAC MP4; later slices include
  each added treatment, cleaned audio-only output, and edit-plan JSON.
- Resolution and FPS are preserved where possible; quality settings and any
  required changes are explicit. Review playback speed never changes output speed.
- Output uses the same source-time decisions as preview, preserving A/V sync,
  retained pauses, and fades. Precise cuts may require re-encoding.
- Progress, cancellation, and actionable errors are visible; source files are
  never overwritten. Validate output by playback, boundary checks, and listening.
- EDL/XML interchange follows core export only after compatibility is validated.
