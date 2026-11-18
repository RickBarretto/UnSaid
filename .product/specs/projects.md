---
status: in-progress
---

# Save and resume

As a creator, I want to save and recover my project so that I can resume work
without losing decisions or changing the source recording.

## Acceptance

- I can save/open versioned project JSON containing source references, original-time
  edit decisions, undo/redo, and review preferences; reopening starts paused.
- Autosave and recovery retain my work after interruption. Save failures stay
  visible; replacing or closing a session offers Save, Discard, or Cancel when needed.
- I can relink moved media. Incompatible replacements require a clear warning
  or rejection; invalid projects leave the current session intact.
- Source media is never modified or embedded in project JSON. Browser downloads
  and local autosaves clearly show their different save states.
- Once analysis/models exist, reusable results are cached locally and invalidated
  when inputs/settings change, rather than rerunning models after every edit.

## Current boundary

Desktop/browser save, autosave, recovery, and relinking are implemented.
Native dialogs/filesystem flows remain unverified; analysis is regenerated on reopen.
