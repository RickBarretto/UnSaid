import { convertFileSrc, invoke, isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

export interface NativeMedia { path: string; name: string; size: number; url: string }
type MediaInfo = Omit<NativeMedia, 'url'>;
type Recovery = { path: string | null; text: string };
export const isDesktop = isTauri();
const withUrl = (media: MediaInfo): NativeMedia => ({ ...media, url: convertFileSrc(media.path) });

export async function pickMedia(): Promise<NativeMedia | null> {
  const media = await invoke<MediaInfo | null>('pick_media');
  return media ? withUrl(media) : null;
}
export async function loadMedia(path: string): Promise<NativeMedia> {
  return withUrl(await invoke<MediaInfo>('load_media', { path }));
}
export async function pickProject(): Promise<{ path: string; text: string } | null> {
  return invoke('pick_project');
}
export async function writeProject(path: string, text: string): Promise<void> {
  return invoke('write_project', { path, text });
}
export async function chooseProjectPath(defaultPath?: string): Promise<string | null> {
  return invoke('choose_project_path', { defaultPath });
}
export async function readRecovery(): Promise<Recovery | null> { return invoke('read_recovery'); }
export async function writeRecovery(path: string | null, text: string): Promise<void> {
  return invoke('write_recovery', { path, text });
}
export async function clearRecovery(): Promise<void> { return invoke('clear_recovery'); }
export async function resolveSource(projectPath: string, sourcePath: string): Promise<string> {
  return invoke('resolve_source', { projectPath, sourcePath });
}
export async function onDesktopDrop(callback: (path: string) => void): Promise<() => void> {
  return getCurrentWindow().onDragDropEvent((event) => {
    if (event.payload.type === 'drop' && event.payload.paths[0]) callback(event.payload.paths[0]);
  });
}
export async function onDesktopClose(callback: () => Promise<boolean>): Promise<() => void> {
  const window = getCurrentWindow();
  let closing = false;
  return window.onCloseRequested(async (event) => {
    event.preventDefault();
    if (closing) return;
    closing = true;
    try { if (await callback()) await window.destroy(); } finally { closing = false; }
  });
}

/** Read analysis bytes through IPC; the asset URL is reserved for media playback. */
export async function readMedia(path: string): Promise<Uint8Array> {
  const bytes = await invoke<ArrayBuffer>('read_media', { path });
  return new Uint8Array(bytes);
}
