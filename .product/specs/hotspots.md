---
status: draft
---

# Review hotspots

As a creator, I want to review detected regions in context so that automation
reduces repetitive work while I control the final recording.

## Acceptance

- Each hotspot appears on the timeline and review panel with source bounds,
  category, label, confidence, suggested action, and pending/accepted/rejected state.
- Confidence is calibrated or labeled as a relative score. Overlapping detections
  are normalized/merged while preserving their origins; manual cuts stay distinct.
- I can move previous/next, replay with context, refine boundaries, choose an
  action, accept, reject, or protect a region before changing the edit plan.
- I can filter by category, sort by time/duration/confidence, search expressions,
  see accurate counts, and hide reviewed items.
- After individual review works, I can select multiple candidates and accept or
  reject them together. Protection and undo/redo apply to batch decisions too.
- I can inspect decision history, find similar confirmed expressions, and
  suppress repeatedly rejected expressions within this project.
