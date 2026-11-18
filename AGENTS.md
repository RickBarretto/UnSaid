# Working on UnSaid

## Product Context

This repo uses product.md. At the start of every session, read:
- `.product/STRATEGY.md` — vision, positioning, target user
- `.product/ROADMAP.md` — current quarter milestones
- `.product/CONTEXT.md` — architecture constraints, key decisions
- `.product/specs/` — feature specs (read any that are relevant to your task)

Always check the `status` frontmatter in specs before implementing.

## Work incrementally

- Go step by step. Deliver a small working milestone before expanding the
  system; do not try to implement the entire issue at once.
- Prioritize something the user can run and inspect promptly.
- Open focused GitHub issues when useful for deferred work or blockers.
- Follow the user's latest corrections and scope decisions throughout the task.

## Tools and dependencies

- The user has **mise**. Inspect the existing mise settings before declaring something is missing. 
- Don't try to use additional stuff, 3rd-parties. The supply chain should be lean to avoid malware, surface risks and other many issues that comes with large supply chain surface. 
- Don't install anything at global workspace unless requested by the user.

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
