---
$id: http://github.com/RickBarretto/UnSaid/blob/main/PRODUCT.md
$type: Product
$context: https://schema.org.ai
productmd: 1
register: product
---

# UnSaid

An open-source, local-first desktop editor for cleaning spoken video while
preserving meaning, natural pacing, and the original recording.

## Register

product

## Users

Solo educators, presenters, interviewers, and podcasters cleaning recorded video
before sharing it. They work on Windows, Linux, or macOS and value simplicity,
privacy, and an efficient workflow. Repetitive cuts take too much time, but they
still want to refine the result manually.

Initial planned speech support covers Brazilian Portuguese and English.

## Problem

Spoken recordings contain excessive pauses, hesitations, false starts, and
unwanted recording noises. Removing them is repetitive, while careless cuts
can remove meaningful speech or damage natural pacing. Creators need to inspect
and audition changes precisely while keeping control of the final recording.

## Product Purpose

Help creators clean spoken recordings quickly, review the result, and export a
shareable recording without changing their source media. Processing stays local;
the intended workflow works offline after any required model setup.

Success is recordings reviewed and successfully exported per active creator per
week. This is a proposed product measure; telemetry is neither implemented nor
required.

## Positioning

UnSaid combines reviewable cleanup suggestions with precise waveform and
spectrogram editing in an open-source desktop application. Automation suggests;
the creator decides. Reliable manual editing comes first, followed by
conservative, reviewable local detection.

## Operating Context

The core workflow is import → inspect or analyze → review → edit → preview →
export. Creators open local video, inspect source-time regions, audition changes,
and compare Original, Edited, and Selection previews before committing to the
result. Saving, recovery, and source relinking support resuming interrupted work.

The product targets desktop use. A browser frontend also supports development
and browser project persistence; browser validation does not establish native
desktop correctness. No hosted service is required.

## Capabilities and Constraints

The product is in development. The following boundaries come from the current
[Roadmap](.product/ROADMAP.md) and feature specs:

| Area | Spec status | Current boundary |
| --- | --- | --- |
| [Manual editing](.product/specs/manual-editing.md) | `in-progress` | Playback, selection refinement, horizontal zoom, Remove/Keep, preview modes, and undo/redo exist. Other treatments, advanced inspection, contextual audition, and native precision/listening checks remain open. |
| [Save and resume](.product/specs/projects.md) | `in-progress` | Desktop/browser save, autosave, recovery, and relinking are implemented. Native dialogs/filesystem flows remain unverified; analysis is regenerated on reopen. |
| [Export](.product/specs/export.md) | `draft` | Planned local export matching preview decisions; the first slice targets Remove cuts in H.264/AAC MP4. Rendered export remains pending. |
| [Silence suggestions](.product/specs/silence.md) | `draft` | Planned conservative pause candidates for review, rather than automatically applied edits. |
| [Review hotspots](.product/specs/hotspots.md) | `draft` | Planned audition, adjustment, acceptance, rejection, and protection of suggestions; batch review follows individual review. |
| [Speech and fillers](.product/specs/speech.md) | `draft` | Planned offline transcription and contextual filler detection for pt-BR and English after explicit local model setup. |
| [Acoustic cleanup](.product/specs/audio-cleanup.md) | `draft` | Planned acoustic-event suggestions and continuous noise reduction that preserve speech. |

Media MUST stay on-device. Source files MUST remain unchanged, and edits MUST be
reversible. Edit decisions use original source time; preview and export MUST
share those semantics, and review speed MUST NOT change export speed.

Preserve the accepted Tauri/Svelte and browser-native media decision. Keep the
supply chain lean; introduce another media backend only for a concrete unmet
requirement. Tauri still requires platform webview/build libraries, and codec
support varies by platform. Current analysis is bounded and mono, with a 256 MiB
audio-analysis guard; sample-accurate, gapless cut preview remains unverified.

Model/backend choices remain open. Speech recognition may miss hesitations;
voice activity detection cannot classify coughs. Uncertain detections must remain
reviewable suggestions.

## Product Principles

1. Preserve meaning and natural pacing, including intentional pauses and quiet
   speech.
2. Keep the creator in control: suggest, audition, refine, accept or reject;
   retain undo/redo.
3. Protect privacy and source integrity through local processing and reversible
   edits.
4. Deliver reliable manual workflows incrementally before expanding automation.
5. Keep the timeline central, reveal tools on demand, and preserve selection
   and position when panels open.

## Accessibility & Inclusion

Core actions require keyboard access and touch alternatives, visible labels,
and visible focus. Narrow layouts and 200% zoom must retain core actions. The
timeline must remain usable with optional panels hidden. These are acceptance
requirements, not a claim of completed accessibility validation;

## Boundaries

The initial scope excludes multitrack composition, visual effects, color grading,
motion graphics, stylized captions, and social publishing. Frequency-specific
editing is also outside scope.

Analysis caches, profiles, batch processing, GPU acceleration, CLI access, and
EDL/XML interchange follow reliable core workflows; they are future work to
evaluate, not current capabilities. 

## Stack

- [AGENTS.md](AGENTS.md): repository working conventions and verification rules.
- [DESIGN.md](DESIGN.md): target design and interaction principles.
- [Architecture Context](.product/CONTEXT.md): technical stack, constraints, and
  verification limits.
- [Stack decision](.product/decisions/): accepted media
  architecture and dependency rationale.
- [Roadmap](.product/ROADMAP.md): delivery order and milestones.
- [Feature specs](.product/specs/): detailed scope, acceptance criteria, and status.
