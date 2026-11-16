export type AudioAnalysis = { peaks: Float32Array; spectrum: Uint8Array; columns: number; bins: number };

const maxFileSize = 256 * 1024 * 1024;
const aborted = () => new DOMException('Analysis cancelled', 'AbortError');

export async function analyzeMedia(file: File, signal: AbortSignal): Promise<AudioAnalysis> {
  if (signal.aborted) throw aborted();
  if (file.size > maxFileSize) throw new Error('Audio analysis supports files up to 256 MiB. Playback is still available.');
  let context: AudioContext | undefined;
  try {
    const bytes = await file.arrayBuffer();
    if (signal.aborted) throw aborted();
    context = new AudioContext({ sampleRate: 16000 });
    const audio = await context.decodeAudioData(bytes);
    if (signal.aborted) throw aborted();
    if (!audio.numberOfChannels || !audio.length) throw new Error('No audio samples');
    const channels = Array.from({ length: audio.numberOfChannels }, (_, channel) =>
      new Float32Array(audio.getChannelData(channel)));
    if (signal.aborted) throw aborted();
    return await new Promise<AudioAnalysis>((resolve, reject) => {
      const worker = new Worker(new URL('./audio.worker.ts', import.meta.url), { type: 'module' });
      const finish = () => { signal.removeEventListener('abort', cancel); worker.terminate(); };
      const cancel = () => { finish(); reject(aborted()); };
      signal.addEventListener('abort', cancel, { once: true });
      worker.onmessage = (event: MessageEvent<AudioAnalysis>) => { finish(); resolve(event.data); };
      worker.onerror = () => { finish(); reject(new Error('Audio analysis failed. Playback is still available.')); };
      if (signal.aborted) { cancel(); return; }
      worker.postMessage({ channels, sampleRate: audio.sampleRate }, channels.map((channel) => channel.buffer));
    });
  } catch (error) {
    if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) throw aborted();
    if (error instanceof Error && error.message.includes('Playback is still available.')) throw error;
    throw new Error('Audio could not be analyzed. This video may have no audio or an unsupported codec. Playback is still available.');
  } finally {
    if (context && context.state !== 'closed') await context.close().catch(() => {});
  }
}

export async function makeThumbnails(url: string, duration: number, signal: AbortSignal): Promise<string[]> {
  if (signal.aborted) throw aborted();
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Video duration is unavailable.');
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  video.playsInline = true;
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 90;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Thumbnail rendering is unavailable.');

  function waitFor(event: string, action: () => void): Promise<void> {
    return new Promise((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout>;
      const clean = () => { clearTimeout(timer); video.removeEventListener(event, done); video.removeEventListener('error', fail); signal.removeEventListener('abort', cancel); };
      const done = () => { clean(); resolve(); };
      const fail = () => { clean(); reject(new Error('Could not read video frames.')); };
      const cancel = () => { clean(); reject(aborted()); };
      video.addEventListener(event, done, { once: true });
      video.addEventListener('error', fail, { once: true });
      signal.addEventListener('abort', cancel, { once: true });
      timer = setTimeout(() => { clean(); reject(new Error('Video frame extraction timed out.')); }, 10000);
      if (signal.aborted) { cancel(); return; }
      try { action(); } catch (error) { clean(); reject(error); }
    });
  }

  try {
    await waitFor('loadedmetadata', () => { video.src = url; video.load(); });
    const frames: string[] = [];
    for (let i = 0; i < 8; i++) {
      const target = duration * (i + 0.5) / 8;
      await waitFor('seeked', () => { video.currentTime = target; });
      context.fillStyle = '#000';
      context.fillRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
      const width = video.videoWidth * scale, height = video.videoHeight * scale;
      context.drawImage(video, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
      frames.push(canvas.toDataURL('image/jpeg', 0.75));
    }
    return frames;
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
}
