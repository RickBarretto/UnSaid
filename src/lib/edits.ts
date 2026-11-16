/** Times are source seconds; cut intervals are half-open: [start, end). */
export type Region = { start: number; end: number };
export type EditState = { cuts: Region[]; past: Region[][]; future: Region[][] };

const copy = (regions: Region[]): Region[] => regions.map(({ start, end }) => ({ start, end }));
const validDuration = (duration: number): number => Number.isFinite(duration) && duration > 0 ? duration : 0;
const clampTime = (time: number, end: number): number => Number.isNaN(time) ? 0 : Math.min(end, Math.max(0, time));

export function emptyEdits(): EditState {
  return { cuts: [], past: [], future: [] };
}

export function normalizeCuts(cuts: Region[], duration: number): Region[] {
  const end = validDuration(duration);
  const sorted = cuts
    .filter((cut) => Number.isFinite(cut.start) && Number.isFinite(cut.end) && cut.end > cut.start)
    .map((cut) => ({ start: clampTime(cut.start, end), end: clampTime(cut.end, end) }))
    .filter((cut) => cut.end > cut.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Region[] = [];
  for (const cut of sorted) {
    const last = merged[merged.length - 1];
    if (last && cut.start <= last.end) last.end = Math.max(last.end, cut.end);
    else merged.push({ ...cut });
  }
  return merged;
}

export function removeRegion(state: EditState, region: Region, duration: number): EditState {
  const cuts = normalizeCuts([...state.cuts, region], duration);
  if (cuts.length === state.cuts.length && cuts.every((cut, i) => cut.start === state.cuts[i].start && cut.end === state.cuts[i].end)) return state;
  return { cuts, past: [...state.past.map(copy), copy(state.cuts)], future: [] };
}

/** Restore the overlap with a source-time region, preserving cuts on either side. */
export function restoreRegion(state: EditState, region: Region, duration: number): EditState {
  const [restored] = normalizeCuts([region], duration);
  if (!restored) return state;
  const existing = normalizeCuts(state.cuts, duration);
  if (!existing.some((cut) => restored.start < cut.end && restored.end > cut.start)) return state;
  const cuts: Region[] = [];
  for (const cut of existing) {
    if (cut.end <= restored.start || cut.start >= restored.end) {
      cuts.push({ ...cut });
    } else {
      if (cut.start < restored.start) cuts.push({ start: cut.start, end: restored.start });
      if (cut.end > restored.end) cuts.push({ start: restored.end, end: cut.end });
    }
  }
  return { cuts, past: [...state.past.map(copy), copy(state.cuts)], future: [] };
}

export function undoEdit(state: EditState): EditState {
  if (!state.past.length) return state;
  return { cuts: copy(state.past[state.past.length - 1]), past: state.past.slice(0, -1).map(copy), future: [...state.future.map(copy), copy(state.cuts)] };
}

export function redoEdit(state: EditState): EditState {
  if (!state.future.length) return state;
  return { cuts: copy(state.future[state.future.length - 1]), past: [...state.past.map(copy), copy(state.cuts)], future: state.future.slice(0, -1).map(copy) };
}

export function keptRegions(cuts: Region[], duration: number): Region[] {
  const end = validDuration(duration);
  const kept: Region[] = [];
  let cursor = 0;
  for (const cut of normalizeCuts(cuts, end)) {
    if (cut.start > cursor) kept.push({ start: cursor, end: cut.start });
    cursor = cut.end;
  }
  if (cursor < end) kept.push({ start: cursor, end });
  return kept;
}

export function editedDuration(cuts: Region[], duration: number): number {
  return keptRegions(cuts, duration).reduce((total, region) => total + region.end - region.start, 0);
}

export function sourceToEdited(time: number, cuts: Region[], duration: number): number {
  const position = clampTime(time, validDuration(duration));
  let removed = 0;
  for (const cut of normalizeCuts(cuts, duration)) {
    if (position <= cut.start) break;
    removed += Math.min(position, cut.end) - cut.start;
    if (position < cut.end) break;
  }
  return position - removed;
}

/** At a cut boundary, map to the next kept segment; the edited end maps to source end. */
export function editedToSource(time: number, cuts: Region[], duration: number): number {
  const end = validDuration(duration);
  const kept = keptRegions(cuts, end);
  let remaining = clampTime(time, kept.reduce((total, region) => total + region.end - region.start, 0));
  for (const region of kept) {
    const length = region.end - region.start;
    if (remaining < length) return region.start + remaining;
    remaining -= length;
  }
  return end;
}

export function nextPlayableTime(time: number, cuts: Region[], duration: number): number | null {
  const end = validDuration(duration);
  const position = clampTime(time, end);
  for (const region of keptRegions(cuts, end)) {
    if (position < region.end) return Math.max(position, region.start);
  }
  return null;
}
