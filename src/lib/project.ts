import { normalizeCuts, type EditState, type Region } from './edits';

export type Project = {
  version: 1;
  source: { path: string; absolutePath?: string; name: string; size: number; duration: number };
  edits: EditState;
  position: number;
  mode: 'original' | 'edited';
  speed: number;
  updatedAt: number;
};

const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];

function object(value: unknown, keys: string[], optionalKeys: string[] = []): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid project');
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some((key) => !keys.includes(key) && !optionalKeys.includes(key)) || keys.some((key) => !Object.hasOwn(result, key))) throw new Error('Invalid project fields');
  return result;
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function regions(value: unknown, duration: number): Region[] {
  if (!Array.isArray(value)) throw new Error('Invalid project cuts');
  const cuts = value.map((item) => {
    const cut = object(item, ['start', 'end']);
    if (!finite(cut.start) || !finite(cut.end)) throw new Error('Invalid project cut');
    return { start: cut.start, end: cut.end };
  });
  const normalized = normalizeCuts(cuts, duration);
  if (normalized.length !== cuts.length || normalized.some((cut, index) => cut.start !== cuts[index].start || cut.end !== cuts[index].end)) {
    throw new Error('Project cuts must be canonical');
  }
  return cuts;
}

function validate(value: unknown): Project {
  const project = object(value, ['version', 'source', 'edits', 'position', 'mode', 'speed', 'updatedAt']);
  if (project.version !== 1) throw new Error('Unsupported project version');
  const source = object(project.source, ['path', 'name', 'size', 'duration'], ['absolutePath']);
  if (typeof source.path !== 'string' || !source.path.trim() ||
      (Object.hasOwn(source, 'absolutePath') && (typeof source.absolutePath !== 'string' || !source.absolutePath.trim())) || typeof source.name !== 'string' || !source.name.trim() ||
      !finite(source.size) || !Number.isSafeInteger(source.size) || source.size < 0 ||
      !finite(source.duration) || source.duration <= 0) throw new Error('Invalid project source');
  const duration = source.duration;
  const edits = object(project.edits, ['cuts', 'past', 'future']);
  if (!Array.isArray(edits.past) || !Array.isArray(edits.future)) throw new Error('Invalid project history');
  if (!finite(project.position) || project.position < 0 || project.position > source.duration ||
      (project.mode !== 'original' && project.mode !== 'edited') ||
      !finite(project.speed) || !speeds.includes(project.speed) || !finite(project.updatedAt)) throw new Error('Invalid project playback state');
  return {
    version: 1,
    source: { path: source.path, ...(typeof source.absolutePath === 'string' ? { absolutePath: source.absolutePath } : {}), name: source.name, size: source.size, duration: source.duration },
    edits: { cuts: regions(edits.cuts, duration), past: edits.past.map((cuts) => regions(cuts, duration)), future: edits.future.map((cuts) => regions(cuts, duration)) },
    position: project.position, mode: project.mode, speed: project.speed, updatedAt: project.updatedAt,
  };
}

export function parseProject(text: string): Project {
  return validate(JSON.parse(text));
}

export function serializeProject(project: Project): string {
  return JSON.stringify(validate(project), null, 2);
}
