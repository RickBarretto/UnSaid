import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProject, serializeProject, type Project } from '../../src/lib/project';

const project = (): Project => ({
  version: 1,
  source: { path: '/media/clip.mp4', name: 'clip.mp4', size: 123, duration: 10 },
  edits: { cuts: [{ start: 1, end: 2 }], past: [[], [{ start: 3, end: 4 }]], future: [[{ start: 5, end: 6 }]] },
  position: 8, mode: 'edited', speed: 1.25, updatedAt: 123456,
});

describe('project codec', () => {
  test('round trips source, decisions, history and playback state', () => {
    const original = project();
    assert.deepEqual(parseProject(serializeProject(original)), original);
  });

  test('round trips an optional absolute source fallback', () => {
    const original = project();
    original.source.path = 'clip.mp4';
    original.source.absolutePath = '/media/clip.mp4';
    assert.deepEqual(parseProject(serializeProject(original)), original);
    assert.throws(() => serializeProject({ ...original, source: { ...original.source, absolutePath: ' ' } }));
    assert.throws(() => parseProject(JSON.stringify({ ...original, source: { ...original.source, absolutePath: 42 } })));
  });

  test('rejects malformed JSON, unsupported versions and unknown fields', () => {
    assert.throws(() => parseProject('{'));
    assert.throws(() => parseProject(JSON.stringify({ ...project(), version: 2 })));
    assert.throws(() => parseProject(JSON.stringify({ ...project(), futureDecision: true })));
  });

  test('rejects invalid source and playback values before serialization', () => {
    for (const invalid of [
      { source: { ...project().source, path: ' ' } },
      { source: { ...project().source, name: '' } },
      { source: { ...project().source, size: -1 } },
      { source: { ...project().source, size: 1.5 } },
      { source: { ...project().source, duration: 0 } },
      { position: 11 }, { position: -1 }, { position: NaN },
      { mode: 'selection' }, { speed: 1.1 }, { updatedAt: Infinity },
    ]) assert.throws(() => serializeProject({ ...project(), ...invalid } as Project));
  });

  test('rejects cuts or history that normalization would alter', () => {
    const invalidSets = [
      [{ start: -1, end: 1 }], [{ start: 9, end: 11 }],
      [{ start: 2, end: 2 }], [{ start: 3, end: 2 }],
      [{ start: 3, end: 4 }, { start: 1, end: 2 }],
      [{ start: 1, end: 3 }, { start: 2, end: 4 }],
      [{ start: 1, end: 2 }, { start: 2, end: 3 }],
    ];
    for (const cuts of invalidSets) {
      for (const edits of [
        { ...project().edits, cuts },
        { ...project().edits, past: [cuts] },
        { ...project().edits, future: [cuts] },
      ]) assert.throws(() => parseProject(JSON.stringify({ ...project(), edits })));
    }
  });
});
