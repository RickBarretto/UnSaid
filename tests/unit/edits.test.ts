import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { editedDuration, editedToSource, emptyEdits, keptRegions, nextPlayableTime, normalizeCuts, redoEdit, removeRegion, restoreRegion, sourceToEdited, undoEdit } from '../../src/lib/edits';

describe('source-time edits', () => {
  test('normalizes finite intervals by clamping, sorting and merging', () => {
    assert.deepEqual(normalizeCuts([{ start: 5, end: 8 }, { start: -2, end: 2 }, { start: 2, end: 5 }, { start: 7, end: 15 }, { start: 4, end: 4 }, { start: NaN, end: 9 }, { start: 8, end: Infinity }], 10), [{ start: 0, end: 10 }]);
    assert.deepEqual(normalizeCuts([{ start: 2, end: 1 }], 10), []);
    assert.deepEqual(normalizeCuts([{ start: 0, end: 1 }], NaN), []);
    assert.deepEqual(normalizeCuts([{ start: 2, end: 8 }, { start: 3, end: 4 }, { start: 8, end: 9 }, { start: 7, end: 8.5 }], 10), [{ start: 2, end: 9 }]);
  });

  test('undo and redo preserve immutable snapshots and new edits clear redo', () => {
    const initial = emptyEdits();
    const first = removeRegion(initial, { start: 2, end: 4 }, 10);
    const second = removeRegion(first, { start: 6, end: 8 }, 10);
    assert.deepEqual(initial.cuts, []);
    assert.deepEqual(first.cuts, [{ start: 2, end: 4 }]);
    assert.strictEqual(removeRegion(first, { start: 2.5, end: 3 }, 10), first);
    assert.strictEqual(removeRegion(first, { start: 5, end: 5 }, 10), first);
    const undone = undoEdit(second);
    assert.deepEqual(undone.cuts, first.cuts);
    assert.deepEqual(redoEdit(undone).cuts, second.cuts);
    assert.deepEqual(removeRegion(undone, { start: 8, end: 9 }, 10).future, []);
    assert.strictEqual(undoEdit(initial), initial);
    assert.strictEqual(redoEdit(initial), initial);
  });

  test('restores full, partial, split and overlapping cuts without changing adjacent cuts', () => {
    const state = removeRegion(removeRegion(emptyEdits(), { start: 1, end: 5 }, 10), { start: 7, end: 9 }, 10);
    assert.deepEqual(restoreRegion(state, { start: 1, end: 5 }, 10).cuts, [{ start: 7, end: 9 }]);
    assert.deepEqual(restoreRegion(state, { start: 0, end: 3 }, 10).cuts, [{ start: 3, end: 5 }, { start: 7, end: 9 }]);
    assert.deepEqual(restoreRegion(state, { start: 3, end: 4 }, 10).cuts, [{ start: 1, end: 3 }, { start: 4, end: 5 }, { start: 7, end: 9 }]);
    assert.deepEqual(restoreRegion(state, { start: 4, end: 8 }, 10).cuts, [{ start: 1, end: 4 }, { start: 8, end: 9 }]);
    assert.deepEqual(restoreRegion(state, { start: -10, end: 20 }, 10).cuts, []);
    assert.deepEqual(state.cuts, [{ start: 1, end: 5 }, { start: 7, end: 9 }]);
    for (const region of [{ start: 5, end: 7 }, { start: 2, end: 2 }, { start: 5, end: 1 }, { start: NaN, end: 4 }, { start: 0, end: Infinity }]) {
      assert.strictEqual(restoreRegion(state, region, 10), state);
    }
    assert.strictEqual(restoreRegion(state, { start: 1, end: 4 }, 0), state);
  });

  test('restore participates in undo, redo and branching history', () => {
    const cut = removeRegion(emptyEdits(), { start: 1, end: 9 }, 10);
    const restored = restoreRegion(cut, { start: 3, end: 5 }, 10);
    assert.deepEqual(undoEdit(restored).cuts, cut.cuts);
    assert.deepEqual(redoEdit(undoEdit(restored)).cuts, restored.cuts);
    const branched = restoreRegion(undoEdit(restored), { start: 6, end: 7 }, 10);
    assert.deepEqual(branched.future, []);
    assert.deepEqual(branched.cuts, [{ start: 1, end: 6 }, { start: 7, end: 9 }]);
  });

  test('maps leading, interior and trailing cut boundaries to the next kept source position', () => {
    const cuts = [{ start: 0, end: 1 }, { start: 3, end: 5 }, { start: 9, end: 10 }];
    assert.deepEqual(keptRegions(cuts, 10), [{ start: 1, end: 3 }, { start: 5, end: 9 }]);
    assert.equal(editedDuration(cuts, 10), 6);
    assert.equal(sourceToEdited(0.5, cuts, 10), 0);
    assert.equal(sourceToEdited(4, cuts, 10), 2);
    assert.equal(sourceToEdited(9.5, cuts, 10), 6);
    assert.equal(editedToSource(0, cuts, 10), 1);
    assert.equal(editedToSource(2, cuts, 10), 5);
    assert.equal(editedToSource(6, cuts, 10), 10);
    assert.equal(nextPlayableTime(0, cuts, 10), 1);
    assert.equal(nextPlayableTime(3, cuts, 10), 5);
    assert.equal(nextPlayableTime(5, cuts, 10), 5);
    assert.equal(nextPlayableTime(9, cuts, 10), null);
    for (const time of [1, 1.5, 2.9, 5, 7, 8.9]) {
      assert.ok(Math.abs(editedToSource(sourceToEdited(time, cuts, 10), cuts, 10) - time) < 1e-9);
    }
  });

  test('fully removed media has no playable position', () => {
    const cuts = [{ start: -1, end: 11 }];
    assert.deepEqual(keptRegions(cuts, 10), []);
    assert.equal(editedDuration(cuts, 10), 0);
    assert.equal(sourceToEdited(7, cuts, 10), 0);
    assert.equal(editedToSource(0, cuts, 10), 10);
    assert.equal(nextPlayableTime(0, cuts, 10), null);
    assert.equal(nextPlayableTime(10, [], 10), null);
  });
});
