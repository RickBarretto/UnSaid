# Content-First, Adaptive Island UI

> A reusable design direction for creative tools, productivity apps, editors, viewers, technical workspaces, and other applications where the user's work matters more than the interface.
>
> **Design principle: Content first. Tools on demand. Complexity by choice.**

## 1. Intent

Design an application that feels like an **instrument**, not a dashboard. The working surface is the product; the interface exists to help users act on it, then get out of the way.

The application should be:

- **Immersive:** the main content occupies the viewport instead of living inside a small central card.
- **Calm:** limited visual noise, clear hierarchy, generous spacing, and no decorative chrome.
- **Explorable:** useful tools are easy to discover, while advanced options reveal themselves progressively.
- **Contextual:** controls appear near the content, selection, or task they affect.
- **Adaptive:** desktop, tablet, and mobile are first-class experiences, not scaled copies of one layout.
- **Precise:** suitable for mouse, trackpad, touch, stylus, and keyboard without compromising precision.
- **Personal:** users can dismiss, expand, pin, or restore panels where appropriate.

**North star:** users should see their work immediately, understand their next action, and never have to fight the interface for space.

## 2. Spatial Architecture

### 2.1 Full-viewport workspace

The primary workspace is an edge-to-edge **canvas layer** occupying the available window or screen. It might contain a model, document, image, video, timeline, map, diagram, slide, code artifact, or other content.

- Let the content occupy **100% of the usable application viewport**; place interface chrome **over** the workspace rather than reserving permanent layout columns.
- Respect operating-system safe areas, notches, window controls, virtual keyboards, and fold/hinge regions.
- Fit, pan, zoom, scroll, and navigate according to the content's own behavior. Do not stretch content to fill the screen or distort its natural aspect ratio.
- Give the actual object of work visual priority. If the app's main value is a timeline, canvas, document, or board, **that surface** gets priority over preview panes or toolbars.
- Preserve spatial context during actions; opening a tool should not unexpectedly replace or reset the user's view.
- Offer a distraction-free or focus mode that dismisses nonessential interface elements.

A canvas-first layout is **not** a mandate to make everything draggable. Let the content model determine what moves; keep controls stable and predictable.

### 2.2 Floating islands

Organize UI into a small family of independent, purpose-specific **tool islands**: compact floating surfaces hovering above the workspace.

| Island | Responsibility | Default presentation |
| --- | --- | --- |
| App / session | Identity, file actions, save/sync state, settings | Small corner cluster or compact menu |
| Primary actions | A handful of frequent tools or modes | Short floating toolbar near an accessible edge |
| Context actions | Actions relevant to a selection, gesture, or active mode | Adjacent to selection or in a nearby anchored island |
| Inspector | Detailed properties, parameters, metadata | Hidden by default; expanded on request |
| Structure / navigation | Layers, pages, outline, tracks, objects, or history | Collapsed rail/toggle; open as a floating panel |
| View controls | Zoom, orientation, fit, display options | Minimal corner cluster |
| Feedback | Progress, errors, confirmations, selection info | Small status indicator or transient toast |

These are **roles, not required components**. Only include islands that serve the actual application.

Island design rules:

1. **Start collapsed.** Show only controls that support the current task.
2. **One purpose per island.** Do not create one giant generic floating dashboard.
3. **Stable placement.** Prefer predictable anchors to freely draggable UI. Allow repositioning only when it clearly helps.
4. **No permanent obstruction.** Do not cover the highest-value portion of the workspace; avoid overlap with selections, active handles, content controls, and other islands.
5. **Expandable and dismissible.** Expansion should be reversible and should maintain context.
6. **Easy to recover.** Dismissed panels must be accessible through a clear menu, command, or shortcut.
7. **Responsive depth.** On constrained screens, combine, relocate, or temporarily replace islands with drawers/sheets.
8. **No duplicate controls by default.** Every always-visible action must earn its space.

**Floating does not mean constantly visible.** A tool island should appear because it is frequently needed, relevant now, or explicitly opened.

## 3. Progressive Disclosure and Exploration

Structure functionality in four levels:

1. **Immediate:** direct manipulation, primary work surface, and one or two obvious actions.
2. **Contextual:** selection-specific actions and short, focused menus.
3. **Expanded:** inspectors, lists, advanced tools, detailed settings, and customization.
4. **Expert:** shortcuts, command palette, batch operations, presets, automation, and precise numeric input.

Design exploration as a deliberate path:

- Use clear icons **with accessible names**; provide text labels for ambiguous or seldom-used actions.
- Make the currently selected tool, mode, and target explicit. Do not rely solely on color.
- Use lightweight tooltips on hover/focus; provide equivalent labels or help on touch devices.
- Use concise contextual onboarding, discoverable examples, and optional “show all tools” entry points rather than permanent tutorials.
- Group related tools into expandable families; reveal secondary actions through a menu, popover, or long press **with a visible alternative**.
- Keep common operations fast and expert options reachable without nesting users inside endless submenus.
- Persist user choices such as pinned inspectors, preferred tool locations, and workspace mode when useful.

The application must remain usable when all optional panels are hidden.

## 4. Responsive Behavior

**Adapt the interaction model, not just the component dimensions.** The same task should be achievable across screen sizes, but not necessarily through identical chrome.

| | Desktop / large windows | Tablet | Phone / narrow windows |
| --- | --- | --- | --- |
| Main surface | Full workspace with generous canvas room | Full workspace with touch-friendly controls | Full workspace with the highest-value content centered/fitted |
| Primary tools | Short floating toolbar near top/bottom | Edge-friendly island reachable by hand/stylus | Compact bottom action island or small mode switcher |
| Structure | Optional floating outline/layers panel | Collapsible side overlay or popover | Full-height temporary panel or bottom sheet |
| Inspector | Floating side panel, resizable where valuable | Popover, dockable overlay, or sheet | Bottom sheet with snap points; full-screen only for complex editing |
| Context actions | Near selection, cursor, or active item | Near selection but clear of fingers and pen | Above selection or in thumb-reachable bottom actions |
| Secondary actions | Menus, command palette, shortcut keys | Menus and long-press with visible fallback | Overflow menu, searchable tool picker, or sheet |
| Navigation | Mouse/keyboard, trackpad, scroll/zoom | Touch and stylus, optional keyboard | Touch gestures and direct, labeled controls |

### 4.1 Desktop

- Use whitespace and precise pointer interactions; support hover, right-click, keyboard shortcuts, multi-select, and context menus.
- Permit several islands to be open when they add value, without forcing a permanent multi-column layout.
- Keep related functions close; avoid long pointer travel between tool and target.
- Support resizing and arbitrary window widths, not only maximized 16:9 monitors.

### 4.2 Tablet

- Treat tablets as **primary creation devices**, not oversized phones.
- Respect portrait and landscape orientations and use the extra space for content before adding chrome.
- Make controls large enough for fingers while allowing precise stylus interactions.
- Avoid placing a crucial control under the user's drawing hand; consider handedness options when valuable.
- Support external keyboards, pointers, and split-screen / multitasking widths.
- Floating panels may become edge-anchored overlays, but should remain dismissible.

### 4.3 Mobile

- Show **one primary action cluster at a time**, plus a clear way to access the rest.
- Keep the main content visible while basic tools are used; use partially expanded bottom sheets when feasible.
- Place frequently used actions in thumb-reachable areas and honor safe-area insets.
- Collapse complex inspectors into staged forms or sheets; offer search for large tool collections.
- Do not require tiny handles, hover discovery, precise dragging, or gesture-only actions.
- The on-screen keyboard must not hide the active input or critical confirmation controls.

### 4.4 Breakpoints and constraints

Use **available space and capability**, not device labels alone. Breakpoints are starting hypotheses, not a rigid specification.

- Compact: approximately `< 600px` of usable width.
- Medium: approximately `600–1023px`.
- Expanded: approximately `>= 1024px`.
- Additionally adapt to viewport **height**, pointer type, hover capability, orientation, font scaling, zoom, and input modality.
- When the viewport shrinks, **remove or relocate chrome before shrinking the content**.
- Test browser zoom and system text scaling up to at least 200% without losing core actions.

## 5. Visual Language

Aim for a restrained, modern, almost architectural aesthetic. The sample reference suggests light neutral surfaces, dark green-teal accents, hairline outlines, geometric icons, and soft elevation. Treat those as an **optional palette**, not a brand requirement.

### 5.1 Composition and surfaces

- Keep the workspace visually distinct from floating controls through **subtle contrast**, not heavy boxes.
- Use warm-white or cool-white island surfaces, depending on the content and product identity.
- Make panel boundaries legible with thin borders and very soft, diffused shadows.
- Prefer consistent, generous radii; make floating islands feel cohesive, not like unrelated cards.
- Avoid gratuitous gradient fills, deep shadows, thick borders, repeated containers, or decorative glass effects.
- On complex backgrounds, increase panel opacity and contrast as needed. Legibility wins over transparency.
- Let accent color indicate actions, selection, focus, and state rather than filling the interface.

### 5.2 Suggested design tokens (customizable)

These are starting values, **not hard requirements**.

```css
:root {
  --workspace: #f3f6f5;
  --surface: #ffffff;
  --surface-muted: #edf2f0;
  --text: #173f38;
  --text-muted: #58716c;
  --accent: #207d70;
  --accent-soft: #dceee9;
  --border: rgba(20, 50, 45, 0.12);
  --shadow-island: 0 8px 28px rgba(16, 35, 31, 0.10);
  --radius-island: 16px;
  --radius-control: 10px;
  --island-gap: 12px;
  --island-padding: 10px;
  --desktop-edge-inset: 20px;
  --mobile-edge-inset: 12px;
  --control-target: 44px;
  --motion-fast: 140ms;
  --motion-normal: 220ms;
}
```

Provide dark-mode, high-contrast, and reduced-transparency equivalents where supported. Adjust tokens to the product's brand and content rather than forcing every app into one palette.

### 5.3 Typography and iconography

- Use a clean, highly legible system-oriented sans-serif typeface.
- Establish hierarchy with weight, spacing, and modest size differences, not oversized headings everywhere.
- Keep interface copy short, specific, and action-oriented.
- Use a cohesive outline icon family with consistent stroke weight and optical sizing.
- Avoid icon-only ambiguity. Expose action names via labels, tooltips, or accessible help.
- Reserve strong typography for the content or active task rather than constant decorative headings.

### 5.4 Motion and feedback

- Use subtle transitions to show where an island opened from, what it belongs to, and where it can be dismissed.
- Animate position/opacity lightly; avoid bouncy motion that shifts attention away from work.
- Show immediate feedback for selection, saved state, invalid actions, processing, and completion.
- Respect reduced-motion settings; no essential information should depend on animation.

## 6. Input and Interaction Principles

Support the user's actual input device rather than translating every action into a gesture.

- **Pointer:** precise hover/focus states, click, double-click only where conventional, contextual menus, drag affordances, and scroll/zoom.
- **Touch:** generous hit targets (at least **44 × 44 CSS px** where practical), touch-safe spacing, predictable tap/press feedback, and alternatives to drag.
- **Stylus:** precision selection, palm rejection where supported, and no panels that obscure the active pen tip.
- **Keyboard:** logical focus order, visible focus indicators, documented shortcuts, Escape to dismiss, Enter/Space to activate, and full navigation of floating panels.
- **Screen readers:** meaningful names, roles, states, headings, descriptions, and announcements for changes that matter.

Core actions must not depend exclusively on hovering, color, pinch gestures, long-press, drag-and-drop, or inaccessible canvas hit testing.

**State and safety:** retain undo/redo when actions support it; differentiate active tool, selected content, hover, and disabled state; confirm destructive operations appropriately; avoid surprise mode changes; keep selections and scroll positions stable when panels open.

## 7. Contextual UI Patterns

Use the smallest interaction that solves the job:

- **Popover:** quick choice, one-off command, color, option, or small property group.
- **Floating inspector:** repeated adjustment of a selected object or tool; may be pinned.
- **Sheet/drawer:** substantial settings, layers, searchable tools, or multi-step actions on smaller screens.
- **Command palette/tool search:** efficient access to rarely used or expert actions.
- **Transient toast:** confirmation or non-blocking feedback; not a substitute for persistent error recovery.
- **Inline editing:** direct changes on the content when that reduces context switching.
- **Dedicated mode/view:** only when the task genuinely needs to replace the workspace.

Whenever possible, leave the workspace **visible and recognizable** during secondary operations.

## 8. Accessibility and Inclusivity

Accessibility is a baseline requirement, not a separate visual mode.

- Meet **WCAG 2.2 AA** as the implementation target where applicable.
- Maintain sufficient foreground/background contrast in all panel states and over varied content.
- Ensure keyboard and assistive-technology access to all actions, including canvas-adjacent tools.
- Keep floating elements out of the way of focused content and magnification targets.
- Do not trap focus in a nonmodal popover; correctly manage focus in modal sheets and dialogs.
- Use visible focus rings, meaningful error messages, and clear saved/unsaved indicators.
- Support localization, long labels, dynamic text, RTL layouts when relevant, and platform accessibility preferences.
- Provide a simple alternative to complex gestures and precision-only manipulations.

## 9. Anti-Patterns to Avoid

**Do not:**

- Wrap the core content in a dashboard of cards or permanent navigation sidebars.
- Display every available tool all the time.
- Copy a desktop UI onto mobile at smaller scale.
- Hide essential actions behind gestures or unlabeled icons.
- Place multiple floating panels over the user's working area by default.
- Make every island draggable, translucent, or animated just because it can be.
- Substitute visual simplicity for functional discoverability.
- Use fixed positions that collide with safe areas, keyboards, or other panels.
- Force the user's main workflow into a tiny preview while unimportant controls dominate.
- Require several menus to perform a frequent action.

Minimalism is successful when the interface feels **unobtrusive without becoming mysterious**.

## 10. Design and Implementation Checklist

Before calling a screen complete, verify:

- [ ] The work surface dominates the viewport at desktop, tablet, and mobile sizes.
- [ ] Initial chrome is limited to essential, high-frequency controls.
- [ ] Every island has a clear purpose, anchor, dismissal path, and reopen path.
- [ ] Advanced actions remain discoverable through expansion, menus, help, or search.
- [ ] Important content and active handles are not covered by floating UI.
- [ ] Tablet landscape, tablet portrait, phone portrait, and narrow desktop windows work.
- [ ] Touch, pointer, stylus (if relevant), keyboard, and assistive technologies are considered.
- [ ] Targets, labels, focus, and contrast are accessible.
- [ ] Opening tools preserves content position, selection, and continuity.
- [ ] Focus mode and optional panel dismissal are available.
- [ ] Motion is restrained and respects reduced-motion preferences.
- [ ] Empty, loading, success, error, offline, and destructive-action states are designed.
- [ ] The UI still works at 200% zoom and with long localized labels.
- [ ] No visual element is present solely to make the interface look more complex.

## 11. Instructions for Designers and Coding Agents

When applying this document to a new application:

1. **Identify the core object of value.** What must remain visible and usable most of the time? Allocate space to that first.
2. **Map the top five tasks.** Put the high-frequency actions near the workspace; keep secondary actions accessible but collapsed.
3. **Choose only the necessary islands.** Do not implement the entire island catalog automatically.
4. **Define visibility rules.** For each island: when is it visible, where is it anchored, what expands it, what dismisses it, and how is it recovered?
5. **Design three layouts separately.** Desktop, tablet, and phone should share a visual language but may use different navigation and inspector presentations.
6. **Specify input behavior.** Define mouse, keyboard, touch, and stylus interactions explicitly instead of assuming equivalence.
7. **Design edge states early.** Account for no content, long content, small screens, virtual keyboard, loading, errors, undo, and offline behavior.
8. **Review by subtraction.** Remove any persistent control that does not help the user's present task.

**Final design test:** If every optional tool island disappears, does the user still see the thing they came to work on? If the answer is yes, the interface is moving in the right direction.
