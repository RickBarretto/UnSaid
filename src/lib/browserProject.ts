import type { NativeMedia } from './nativeProject';

const databaseName = 'unsaid-browser';
const storeName = 'files';
const recoveryKey = 'recovery';

type Recovery = { path: string | null; text: string };

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function get<T>(key: string): Promise<T | undefined> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const request = transaction.objectStore(storeName).get(key);
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(request.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}

async function change(key: string, value?: unknown): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      if (value === undefined) store.delete(key);
      else store.put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}

function chooseFile(accept: string, label: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.setAttribute('aria-label', label);
    input.style.display = 'none';
    document.body.appendChild(input);
    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onFocus);
      input.remove();
      resolve(file);
    };
    // Some browsers do not fire the input's cancel event. Focus returns when
    // the dialog closes; defer to allow a pending change event to arrive.
    const onFocus = () => window.setTimeout(() => finish(input.files?.[0] ?? null), 300);
    input.addEventListener('change', () => finish(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => finish(null), { once: true });
    window.addEventListener('focus', onFocus, { once: true });
    input.click();
  });
}

export async function cacheMedia(file: File): Promise<NativeMedia> {
  const path = `browser:${crypto.randomUUID()}`;
  await change(path, file);
  return { path, name: file.name, size: file.size, url: URL.createObjectURL(file) };
}

export async function pickMedia(): Promise<NativeMedia | null> {
  const file = await chooseFile('video/*', 'Choose media file');
  return file ? cacheMedia(file) : null;
}

async function mediaFile(path: string): Promise<File> {
  const file = await get<File>(path);
  if (!file) throw new Error(`Media not found in browser storage: ${path}`);
  return file;
}

export async function loadMedia(path: string): Promise<NativeMedia> {
  const file = await mediaFile(path);
  return { path, name: file.name, size: file.size, url: URL.createObjectURL(file) };
}

export async function readMedia(path: string): Promise<Uint8Array> {
  return new Uint8Array(await (await mediaFile(path)).arrayBuffer());
}

export async function pickProject(): Promise<{ path: string; text: string } | null> {
  const file = await chooseFile('.json,application/json', 'Choose project file');
  if (!file) return null;
  const text = await file.text();
  await writeProject(file.name, text);
  return { path: file.name, text };
}

export async function chooseProjectPath(defaultPath?: string): Promise<string | null> {
  const path = window.prompt('Project filename', defaultPath || 'project.unsaid.json');
  return path?.trim() || null;
}

export async function writeProject(path: string, text: string): Promise<void> {
  await change(`project:${path}`, text);
}

export function downloadProject(path: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = path;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readRecovery(): Promise<Recovery | null> {
  return (await get<Recovery>(recoveryKey)) ?? null;
}
export async function writeRecovery(path: string | null, text: string): Promise<void> {
  await change(recoveryKey, { path, text });
}
export async function clearRecovery(): Promise<void> { await change(recoveryKey); }
export async function resolveSource(_projectPath: string, sourcePath: string): Promise<string> {
  return sourcePath;
}

export const browserStorage = {
  pickMedia, cacheMedia, loadMedia, readMedia, pickProject, chooseProjectPath,
  writeProject, downloadProject, readRecovery, writeRecovery, clearRecovery, resolveSource,
};
