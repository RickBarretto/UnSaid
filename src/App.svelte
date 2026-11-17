<script lang="ts">
  import { onMount, onDestroy, untrack, tick } from 'svelte';
  import SelectionTimeline from './lib/SelectionTimeline.svelte';
  import CleanupPanel from './lib/CleanupPanel.svelte';
  import { analyzeMedia, makeThumbnails, type AudioAnalysis } from './lib/mediaAnalysis';
  import { emptyEdits, removeRegion, restoreRegion, undoEdit, redoEdit, editedDuration, sourceToEdited, editedToSource, nextPlayableTime, keptRegions, type Region } from './lib/edits';

  import { parseProject, serializeProject, type Project } from './lib/project';
  import { storage, desktop, nativeListeners, browserMode } from './lib/projectStorage';
  import { cacheMedia } from './lib/browserProject';
  import { onDesktopDrop, onDesktopClose, type NativeMedia } from './lib/nativeProject';

  let source = $state<NativeMedia | null>(null);
  let projectPath = $state<string | null>(null);
  let saveStatus = $state('Unsaved');
  let savedContent = '';
  let pendingProject = $state<Project | null>(null);
  let pendingPath: string | null = null;
  let restoring = false;
  let recovered = false;
  let openingLocalAutosave = false;
  let writeQueue = Promise.resolve();
  let autosaveTimer: ReturnType<typeof setTimeout> | undefined;
  let prompt = $state<{ message: string; choices: string[] } | null>(null);
  let answer: ((value: string) => void) | undefined;
  let projectBusy = $state(false);
  const ask = (message: string, choices: string[]) => new Promise<string>((resolve) => {
    prompt = { message, choices }; answer = resolve;
  });
  function respond(value: string) { prompt = null; answer?.(value); answer = undefined; }
  const describe = (cause: unknown) => cause instanceof Error ? cause.message : String(cause);

  function snapshot(): Project | null {
    if (!source || !duration || !ready) return null;
    return { version: 1, source: { path: source.path, name: source.name, size: source.size, duration },
      edits: $state.snapshot(edits), position: Math.min(duration, position),
      mode: mode === 'edited' ? 'edited' : 'original', speed, updatedAt: Date.now() };
  }
  function signature(project: Project) { return JSON.stringify({ source: project.source, edits: project.edits, speed: project.speed, mode: project.mode }); }
  function portable(project: Project, path: string): Project {
    const parent = path.slice(0, Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1);
    const sourcePath = project.source.path;
    return { ...project, source: { ...project.source, absolutePath: sourcePath,
      path: parent && sourcePath.startsWith(parent) ? sourcePath.slice(parent.length) : sourcePath } };
  }
  async function persist(saveAs = false, automatic = false): Promise<boolean> {
    if (!snapshot()) return false;
    let path = projectPath;
    try {
      if (!path || saveAs) path = await storage.chooseProjectPath(path ?? `${source!.name}.unsaid.json`);
      if (!path) return false;
      const project = snapshot();
      if (!project) return false;
      clearTimeout(autosaveTimer);
      const target = path;
      const content = signature(project);
      saveStatus = 'Saving';
      const task = writeQueue.then(async () => {
        await storage.writeRecovery(target, serializeProject(project));
        await storage.writeProject(target, serializeProject(portable(project, target)));
        projectPath = target;
        savedContent = content;
        saveStatus = snapshot() && signature(snapshot()!) === content ? (browserMode ? (automatic ? 'Autosaved locally' : 'Saved locally') : 'Saved') : 'Unsaved';
        if (!automatic) storage.downloadProject?.(target, serializeProject(project));
      });
      writeQueue = task.catch(() => {});
      await task;
      return true;
    } catch (cause) { saveStatus = 'Save failed'; error = `Project could not be saved: ${describe(cause)}`; return false; }
  }
  async function leaveSession(): Promise<boolean> {
    clearTimeout(autosaveTimer);
    await writeQueue;
    const current = snapshot();
    if (!current || signature(current) === savedContent) return true;
    if (projectPath && await persist(false, true)) return true;
    const choice = await ask('Save your project before leaving this session?', ['Save', 'Discard', 'Cancel']);
    if (choice === 'Save') return persist();
    if (choice === 'Discard') { await storage.clearRecovery(); return true; }
    return false;
  }
  async function probe(media: NativeMedia): Promise<number> {
    return new Promise((resolve, reject) => {
      const element = document.createElement('video');
      const timer = setTimeout(() => finish(new Error('Source metadata timed out.')), 10000);
      function finish(cause?: Error) {
        clearTimeout(timer);
        const value = element.duration;
        element.onloadedmetadata = null; element.onerror = null;
        element.removeAttribute('src'); element.load();
        if (cause || !Number.isFinite(value) || value <= 0) reject(cause ?? new Error('Invalid source duration.'));
        else resolve(value);
      }
      element.onloadedmetadata = () => finish();
      element.onerror = () => finish(new Error('Source media cannot be decoded. Locate a supported source.'));
      element.src = media.url;
    });
  }
  async function attachProject(project: Project, media: NativeMedia, path: string | null) {
    const measured = await probe(media);
    if (media.size !== project.source.size || Math.abs(measured - project.source.duration) > 0.1) {
      if (await ask('This source differs in size or duration. Use it with the saved cut timings?', ['Use source', 'Cancel']) !== 'Use source') return false;
      if (measured < project.source.duration) throw new Error('Replacement is shorter than the saved source. Choose the original media to preserve cut timings.');
    }
    recovered ||= media.path !== (project.source.absolutePath ?? project.source.path) || media.size !== project.source.size || Math.abs(measured - project.source.duration) > 0.1;
    restoring = true;
    openFile(undefined, media);
    projectPath = path;
    pendingProject = project;
    pendingPath = path;
    return true;
  }
  async function openProject() {
    if (projectBusy) return;
    projectBusy = true;
    try {
      const picked = await storage.pickProject();
      if (!picked) return;
      const project = parseProject(picked.text);
      if (!await leaveSession()) return;
      let media: NativeMedia;
      try {
        const path = storage.resolveSource ? await storage.resolveSource(picked.path, project.source.path) : project.source.path;
        try { media = await storage.loadMedia(path); }
        catch (cause) { if (!project.source.absolutePath) throw cause; media = await storage.loadMedia(project.source.absolutePath); }
      } catch {
        pendingProject = project; pendingPath = picked.path;
        error = 'Project source is missing. Use Locate source to relink it.';
        return;
      }
      openingLocalAutosave = !!picked.localAutosave;
      await attachProject(project, media, picked.path);
    } catch (cause) { error = `Project could not be opened: ${describe(cause)}`; }
    finally { projectBusy = false; }
  }
  async function locateSource() {
    if (!pendingProject || projectBusy) return;
    projectBusy = true;
    try { const media = await storage.pickMedia(); if (media) await attachProject(pendingProject, media, pendingPath); }
    catch (cause) { error = describe(cause); }
    finally { projectBusy = false; }
  }
  async function importMedia(path?: string) {
    if (projectBusy) return;
    projectBusy = true;
    try {
      const media = path ? await storage.loadMedia(path) : await storage.pickMedia();
      if (media && await leaveSession()) { pendingProject = null; projectPath = null; savedContent = ''; openFile(undefined, media); }
    } catch (cause) { error = describe(cause); }
    finally { projectBusy = false; }
  }
  $effect(() => {
    const dependencies = [source, duration, ready, edits, speed, mode];
    void dependencies;
    const current = untrack(snapshot);
    if (restoring || pendingProject || !current) return;
    // Track edit and review preferences, not the continuously advancing playhead.
    const content = signature(current);
    clearTimeout(autosaveTimer);
    if (content === savedContent) return;
    saveStatus = 'Unsaved';
    autosaveTimer = setTimeout(() => {
      if (projectPath) void persist(false, true);
      else {
        const text = serializeProject(snapshot()!);
        const content = signature(snapshot()!);
        const task = writeQueue.then(async () => {
          await storage.writeRecovery(null, text);
          const current = snapshot();
          if (current && signature(current) === content) saveStatus = browserMode ? 'Autosaved locally' : 'Recovery saved';
        });
        writeQueue = task.catch((cause) => { error = `Recovery could not be saved: ${describe(cause)}`; });
      }
    }, 750);
  });
  onMount(() => {
    const cleanups: (() => void)[] = [];
    let mounted = true;
    const register = (cleanup: () => void) => mounted ? cleanups.push(cleanup) : cleanup();
    if (nativeListeners) {
      void onDesktopDrop((path) => void importMedia(path)).then(register);
      void onDesktopClose(leaveSession).then(register);
    }
    void (async () => {
      try {
        const recovery = await storage.readRecovery();
        if (!recovery || !mounted) return;
        const project = parseProject(recovery.text);
        if (await ask('An interrupted editing session is available.', ['Recover', 'Discard']) === 'Discard') { await storage.clearRecovery(); return; }
        try {
          const media = await storage.loadMedia(project.source.path);
          recovered = true;
          await attachProject(project, media, recovery.path);
          savedContent = ''; // Recovered edits must be written to the project.
        } catch { pendingProject = project; pendingPath = recovery.path; error = 'Recovery source is missing. Use Locate source.'; }
      } catch (cause) { error = `Recovery unavailable: ${describe(cause)}`; }
    })();
    return () => { mounted = false; clearTimeout(autosaveTimer); cleanups.forEach((cleanup) => cleanup()); };
  });

  let video = $state<HTMLVideoElement>();
  let picker: HTMLInputElement;
  let url = $state('');
  let ownedUrl: string | undefined;
  let filename = $state('');
  let playing = $state(false);
  let loading = $state(false);
  let dragging = $state(false);
  let duration = $state(0);
  let position = $state(0);
  let speed = $state(1);
  let error = $state('');
  let ready = $state(false);
  let disposed = false;
  let selection = $state<Region | null>(null);
  let edits = $state(emptyEdits());
  let mode = $state<'original' | 'edited' | 'selection'>('original');
  let loopSelection = $state(false);
  let frame: number | undefined;
  let analysis = $state<AudioAnalysis | null>(null);
  let thumbnails = $state<string[]>([]);
  let analysisStatus = $state('');
  let analysisController: AbortController | undefined;
  let thumbnailStarted = false;
  let pendingSeek: { target: number; resume: boolean } | null = null;
  let queuedSeek: { target: number; resume: boolean } | null = null;
  let landingGuard: number | null = null;
  let playGeneration = 0;
  const landingTolerance = 0.05;
  const outputDuration = $derived(editedDuration(edits.cuts, duration));
  const displayDuration = $derived(mode === 'edited' ? outputDuration : duration);
  const displayPosition = $derived(mode === 'edited' ? sourceToEdited(position, edits.cuts, duration) : position);
  const canPlay = $derived(ready && (mode !== 'edited' || outputDuration > 0) && (mode !== 'selection' || !!selection));
  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const canRestoreSelection = $derived(!!selection && edits.cuts.some((cut) => cut.start < selection!.end && cut.end > selection!.start));

  async function readAnalysisFile(media: NativeMedia, signal: AbortSignal): Promise<File> {
    if (storage.readMedia) {
      try {
        const bytes = await storage.readMedia(media.path);
        if (signal.aborted) throw new DOMException('Analysis cancelled', 'AbortError');
        if (bytes.byteLength !== media.size) throw new Error('Incomplete native media read');
        return new File([bytes.slice().buffer], media.name);
      } catch (cause) {
        if (signal.aborted) throw cause;
        // A running desktop binary can predate a frontend hot reload. Keep
        // asset reads available when the newer native command is unavailable.
      }
    }
    const response = await fetch(media.url, { signal });
    if (!response.ok) throw new Error('Source bytes could not be read for audio analysis. Playback is still available.');
    const blob = await response.blob();
    if (blob.size !== media.size) throw new Error('Source read was incomplete. Audio analysis is unavailable; playback is still available.');
    return new File([blob], media.name);
  }

  function openFile(file?: File, native?: NativeMedia) {
    if (!file && !native) return;
    const originalFile = file;
    source = native ?? null;
    if (native && !file) file = new File([], native.name, { type: 'video/mp4' });
    file = file!;
    if (file.type && !file.type.startsWith('video/') && !/\.(mp4|m4v|mov|webm|mkv|avi|ogv|ogg)$/i.test(file.name)) {
      error = 'Choose a video file, such as MP4, WebM, or MOV.';
      return;
    }
    invalidateSeek();
    analysisController?.abort();
    video?.pause();
    cancelFrame();
    if (ownedUrl) URL.revokeObjectURL(ownedUrl);
    const reloadSource = !!native && url === native.url;
    url = native?.url ?? URL.createObjectURL(file);
    ownedUrl = browserMode || !native ? url : undefined;
    filename = file.name;
    playing = false;
    loading = true;
    ready = false;
    duration = 0;
    position = 0;
    speed = 1;
    error = '';
    selection = null;
    edits = emptyEdits();
    mode = 'original';
    loopSelection = false;
    analysis = null;
    thumbnails = [];
    thumbnailStarted = false;
    analysisStatus = 'Preparing waveform and spectrum…';
    const controller = new AbortController();
    analysisController = controller;
    if (reloadSource) void tick().then(() => { if (!controller.signal.aborted) video?.load(); });
    void (native && !originalFile ? (native.size > 256 * 1024 * 1024 ? Promise.reject(new Error('Audio analysis supports files up to 256 MiB. Playback is still available.')) : readAnalysisFile(native, controller.signal).then((file) => analyzeMedia(file, controller.signal))) : analyzeMedia(file, controller.signal)).then((result) => {
      if (!controller.signal.aborted) { analysis = result; analysisStatus = ''; }
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) analysisStatus = cause instanceof Error ? cause.message : 'Audio visualization unavailable.';
    });
  }

  let importGeneration = 0;
  async function importBrowserFile(file?: File) {
    if (!file) return;
    if (file.type && !file.type.startsWith('video/') && !/\.(mp4|m4v|mov|webm|mkv|avi|ogv|ogg)$/i.test(file.name)) {
      error = 'Choose a video file, such as MP4, WebM, or MOV.'; return;
    }
    const generation = ++importGeneration;
    const previousReady = ready;
    checkpointBrowser();
    ready = false; loading = true;
    clearTimeout(autosaveTimer);
    try {
      const media = await cacheMedia(file);
      if (generation !== importGeneration || disposed) { URL.revokeObjectURL(media.url); return; }
      clearTimeout(autosaveTimer);
      await writeQueue;
      pendingProject = null; projectPath = null; savedContent = ''; recovered = false; restoring = false;
      openFile(file, media);
    } catch (cause) { if (generation === importGeneration) { ready = previousReady; loading = false; error = `Video could not be stored locally: ${describe(cause)}`; } }
  }
  function checkpointBrowser() {
    if (!browserMode || restoring || pendingProject) return;
    const current = snapshot();
    if (!current) return;
    const path = projectPath;
    const text = serializeProject(current);
    const task = writeQueue.then(() => storage.writeRecovery(path, text));
    writeQueue = task.catch((cause) => { error = `Recovery could not be saved: ${describe(cause)}`; });
  }
  $effect(() => {
    const progress = Math.floor(position * 2) / 2;
    const currentReady = ready;
    const decisions = [edits, speed, mode];
    void progress; void currentReady; void decisions;
    if (browserMode) untrack(checkpointBrowser);
  });
  function selected(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    if (browserMode) void importBrowserFile(input.files?.[0]);
    else openFile(input.files?.[0]);
    input.value = '';
  }

  function drop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    dragging = false;
    if (browserMode) void importBrowserFile(event.dataTransfer?.files[0]);
  }

  function invalidateSeek() {
    playGeneration++;
    pendingSeek = null;
    queuedSeek = null;
    landingGuard = null;
  }

  // Only one seek is in flight. Slider changes replace the queued target.
  function requestSeek(target: number, resume = false) {
    const element = video;
    if (!element || !ready || !Number.isFinite(target)) return;
    const request = { target: Math.max(0, Math.min(duration, target)), resume };
    if (pendingSeek || element.seeking) {
      queuedSeek = request;
      return;
    }
    if (Math.abs(element.currentTime - request.target) < 0.001) {
      position = element.currentTime;
      if (resume) void playCurrent();
      return;
    }
    pendingSeek = request;
    landingGuard = request.target;
    position = request.target;
    element.currentTime = request.target;
  }

  function finishSeek(element: HTMLVideoElement) {
    const completed = pendingSeek;
    pendingSeek = null;
    position = element.currentTime;
    loading = false;
    if (queuedSeek) {
      const next = queuedSeek;
      queuedSeek = null;
      requestSeek(next.target, next.resume);
    } else if (completed?.resume) {
      void playCurrent();
    } else {
      enforceBoundary();
    }
  }

  async function togglePlayback() {
    if (!video || !canPlay) return;
    if (!video.paused || pendingSeek?.resume || queuedSeek?.resume) {
      playGeneration++;
      if (pendingSeek) pendingSeek.resume = false;
      if (queuedSeek) queuedSeek.resume = false;
      video.pause();
      return;
    }
    if (mode === 'selection' && selection && (pendingSeek || video.seeking || video.currentTime < selection.start - landingTolerance || video.currentTime >= selection.end)) {
      requestSeek(selection.start, true);
    } else if (mode === 'edited') {
      const next = nextPlayableTime(video.currentTime, edits.cuts, duration)
        ?? keptRegions(edits.cuts, duration)[0]?.start ?? 0;
      requestSeek(next, true);
    } else if (video.ended) requestSeek(0, true);
    else requestSeek(queuedSeek?.target ?? pendingSeek?.target ?? video.currentTime, true);
  }

  async function playCurrent() {
    if (!video || !canPlay) return;
    const element = video;
    const source = url;
    const generation = ++playGeneration;
    try {
      await element.play();
      if (source !== url || element !== video || disposed) element.pause();
    } catch (cause) {
      if (generation !== playGeneration || disposed || source !== url || element !== video ||
        (cause instanceof DOMException && cause.name === 'AbortError')) return;
      loading = false;
      playing = false;
      error = 'This video could not start. Try another file or a different browser-supported format.';
    }
  }

  function cancelFrame() {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
  }

  // rAF catches boundaries during visible playback; timeupdate is a fallback
  // in background windows. Browser seeks are previews, not gapless rendering.
  function enforceBoundary() {
    const element = video;
    if (!element || !ready || element.seeking || pendingSeek || queuedSeek) return;
    const now = element.currentTime;
    // Some decoders land slightly before the requested boundary. Let playback
    // cross it instead of repeatedly issuing the same seek.
    if (landingGuard !== null) {
      if (now < landingGuard && now >= landingGuard - landingTolerance) return;
      landingGuard = null;
    }
    if (mode === 'selection' && selection && (now < selection.start - landingTolerance || now >= selection.end)) {
      if (loopSelection && !element.paused) {
        requestSeek(selection.start, true);
      } else {
        element.pause();
        requestSeek(now < selection.start ? selection.start : selection.end);
      }
    } else if (mode === 'edited') {
      const next = nextPlayableTime(now, edits.cuts, duration);
      if (next === null) {
        element.pause();
        if (now !== duration) requestSeek(duration);
        else position = duration;
      } else if (next !== now) {
        requestSeek(next);
      }
    }
  }

  function watchPlayback() {
    cancelFrame();
    const tick = () => {
      frame = undefined;
      if (!video || video.paused || disposed) return;
      enforceBoundary();
      position = video.currentTime;
      if (!video.paused) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  }

  function setSelection(region: Region) {
    const start = Math.max(0, Math.min(duration, region.start));
    const end = Math.max(0, Math.min(duration, region.end));
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      selection = { start, end };
      if (mode === 'selection' && video) {
        video.pause();
        invalidateSeek();
        requestSeek(start);
      }
    }
  }

  function setMode(next: typeof mode) {
    if (next === 'selection' && !selection) return;
    invalidateSeek();
    mode = next;
    if (mode !== 'selection') loopSelection = false;
    if (!video || !ready) return;
    if (mode === 'selection' && selection) {
      if (position < selection.start || position >= selection.end) {
        requestSeek(selection.start);
      }
    } else if (mode === 'edited') enforceBoundary();
  }

  function replaySelection() {
    if (!video || !ready || !selection) return;
    mode = 'selection';
    requestSeek(selection.start, true);
  }

  function removeSelection() {
    if (!selection || !ready) return;
    invalidateSeek();
    video?.pause();
    edits = removeRegion(edits, selection, duration);
    mode = 'edited';
    loopSelection = false;
    enforceBoundary();
  }

  function history(action: 'undo' | 'redo') {
    const before = edits.cuts;
    const next = action === 'undo' ? undoEdit(edits) : redoEdit(edits);
    if (next === edits) return;
    invalidateSeek();
    video?.pause();
    edits = next;
    if (mode === 'edited' && video) {
      // Move to the earliest changed source boundary so the restored or newly
      // removed material is visible for review.
      const changed = [...before, ...next.cuts].filter((region) =>
        !before.some((other) => other.start === region.start && other.end === region.end) ||
        !next.cuts.some((other) => other.start === region.start && other.end === region.end));
      const boundary = changed.length ? Math.min(...changed.map((region) => region.start)) : position;
      requestSeek(nextPlayableTime(boundary, next.cuts, duration) ?? duration);
    }
  }

  function restoreCut(region: Region) {
    const next = restoreRegion(edits, region, duration);
    if (next === edits) return;
    invalidateSeek();
    video?.pause();
    edits = next;
    loopSelection = false;
    if (mode === 'selection') mode = 'original';
    requestSeek(mode === 'edited' ? nextPlayableTime(region.start, edits.cuts, duration) ?? duration : region.start);
  }

  function mediaEvent(event: Event) {
    const element = event.currentTarget as HTMLVideoElement;
    // Ignore queued events from a file that has since been replaced.
    if (disposed || element !== video || element.getAttribute('src') !== url) return;
    switch (event.type) {
      case 'loadedmetadata':
        duration = Number.isFinite(element.duration) ? element.duration : 0;
        element.playbackRate = speed;
        ready = true;
        loading = false;
        error = '';
        if (restoring && pendingProject) {
          const project = pendingProject;
          edits = project.edits; speed = project.speed; mode = project.mode;
          element.playbackRate = speed;
          requestSeek(Math.min(duration, project.position));
          savedContent = recovered ? '' : signature({ ...project, source: { path: source!.path, name: source!.name, size: source!.size, duration } });
          pendingProject = null; restoring = false; saveStatus = recovered ? 'Unsaved' : browserMode ? (openingLocalAutosave ? 'Autosaved locally' : 'Saved locally') : 'Saved'; recovered = false; openingLocalAutosave = false;
        }
        if (!thumbnailStarted && analysisController && duration > 0) {
          thumbnailStarted = true;
          const controller = analysisController;
          void makeThumbnails(url, duration, controller.signal).then((frames) => {
            if (!controller.signal.aborted) thumbnails = frames;
          }).catch(() => { /* A missing filmstrip must not prevent playback. */ });
        }
        break;
      case 'durationchange':
        duration = Number.isFinite(element.duration) ? element.duration : 0;
        break;
      case 'timeupdate':
        position = element.currentTime || 0;
        if (!element.paused) enforceBoundary();
        break;
      case 'seeked':
        finishSeek(element);
        break;
      case 'loadeddata':
      case 'canplay':
        loading = false;
        break;
      case 'waiting':
        if (ready && !element.error && !element.paused) loading = true;
        break;
      case 'playing':
        loading = false;
        error = '';
        playing = true;
        break;
      case 'play':
        playing = true;
        watchPlayback();
        break;
      case 'pause':
        playing = false;
        loading = false;
        cancelFrame();
        break;
      case 'ended':
        playing = false;
        loading = false;
        cancelFrame();
        if (mode === 'selection' && loopSelection && selection) {
          requestSeek(selection.start, true);
        }
        break;
      case 'error':
        loading = false;
        playing = false;
        ready = false;
        cancelFrame();
        error = element.error?.code === 3
          ? 'This video could not be decoded. Try an MP4 with H.264 video and AAC audio, or WebM.'
          : 'This video format or codec is not supported here. Try an MP4 with H.264 video and AAC audio, or WebM.';
        break;
    }
  }

  function seek(event: Event) {
    if (video && ready) {
      let next = Number((event.currentTarget as HTMLInputElement).value);
      if (mode === 'edited') next = editedToSource(next, edits.cuts, duration);
      if (mode === 'selection' && selection) next = Math.max(selection.start, Math.min(selection.end, next));
      requestSeek(next, !video.paused || !!pendingSeek?.resume || !!queuedSeek?.resume);
    }
  }

  function changeSpeed(event: Event) {
    speed = Number((event.currentTarget as HTMLSelectElement).value);
    if (video) video.playbackRate = speed;
  }

  function keydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (event.repeat || event.altKey) return;
    if ((event.ctrlKey || event.metaKey) && ['s', 'o'].includes(event.key.toLowerCase())) {
      event.preventDefault();
      if (event.key.toLowerCase() === 'o') void openProject(); else void persist(event.shiftKey);
      return;
    }
    if (target?.closest('input, select, textarea, button, [contenteditable="true"]')) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      history(event.shiftKey ? 'redo' : 'undo');
      return;
    }
    if (event.ctrlKey || event.metaKey || !ready) return;
    if (event.code === 'Space') {
      event.preventDefault();
      void togglePlayback();
    } else if (event.key.toLowerCase() === 'i') {
      setSelection({ start: position, end: selection && selection.end > position ? selection.end : duration });
    } else if (event.key.toLowerCase() === 'o') {
      setSelection({ start: selection && selection.start < position ? selection.start : 0, end: position });
    } else if (event.key.toLowerCase() === 'r') {
      replaySelection();
    } else if (event.key.toLowerCase() === 'l' && selection) {
      loopSelection = !loopSelection;
      if (loopSelection) setMode('selection');
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      removeSelection();
    }
  }

  function time(seconds: number) {
    const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
    const minutes = Math.floor(value / 60);
    return value >= 3600
      ? `${Math.floor(value / 3600)}:${String(minutes % 60).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
      : `${String(minutes).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  }

  function focusTimeline() {
    document.querySelector('.editor')?.scrollIntoView({ block: 'nearest' });
  }

  function reviewCuts() {
    const cut = edits.cuts[0];
    if (!cut) return;
    setMode('original');
    setSelection(cut);
    requestSeek(cut.start);
    focusTimeline();
  }

  function fullscreen() {
    void document.querySelector('.preview-stage')?.requestFullscreen?.().catch(() => {
      error = 'Fullscreen is unavailable in this window.';
    });
  }

  onDestroy(() => {
    disposed = true;
    analysisController?.abort();
    invalidateSeek();
    cancelFrame();
    video?.pause();
    if (ownedUrl) URL.revokeObjectURL(ownedUrl);
  });
</script>

<svelte:window onpagehide={checkpointBrowser} onkeydown={keydown} ondragover={(event) => event.preventDefault()} ondrop={drop} />

{#if prompt}
  <div class="prompt-backdrop"><div role="dialog" tabindex="-1" aria-modal="true" aria-label="Project confirmation" class="project-prompt">
    <p>{prompt.message}</p><div>{#each prompt.choices as choice}<button onclick={() => respond(choice)}>{choice}</button>{/each}</div>
  </div></div>
{/if}
<main class="workspace">
  <header class="app-header">
    <div class="brand">
      <img class="brand-icon" src="/icons/wave-sine.svg" alt="" />
      UnSaid
    </div>
    <span class="filename" title={filename}>{filename || 'Your local video workspace'}</span>
    <span class="mode-badge">{mode === 'edited' ? 'Edited' : mode === 'selection' ? 'Selection' : 'Original'}</span>
    <input class="file-input" tabindex="-1" bind:this={picker} type="file" accept="video/*,.mkv,.mov,.avi,.m4v" onchange={selected} aria-label="Choose a local video" />
    <div class="header-actions">
        <button aria-label="Save project" disabled={!ready || !source || projectBusy} onclick={() => void persist()}>Save</button>
        <span role="status" class="save-status">{saveStatus}</span>
        <details class="project-menu"><summary>Project</summary><div>
          <button disabled={projectBusy} onclick={() => void openProject()}>Open project</button>
          <button disabled={!ready || !source || projectBusy} onclick={() => void persist(true)}>Save project as</button>
          {#if pendingProject}<button onclick={() => void locateSource()}>Locate source</button>{/if}
        </div></details>
      <div class="history-buttons">
        <button aria-label="Undo" title="Undo (Ctrl/Cmd+Z)" disabled={!edits.past.length} onclick={() => history('undo')}><img src="/icons/arrow-back-up.svg" alt="" /></button>
        <button aria-label="Redo" title="Redo (Shift+Ctrl/Cmd+Z)" disabled={!edits.future.length} onclick={() => history('redo')}><img src="/icons/arrow-forward-up.svg" alt="" /></button>
      </div>
      <button class="icon-button open-button" aria-label={url ? 'Replace video' : 'Open video'} title={url ? 'Replace video' : 'Open video'} onclick={() => desktop ? void importMedia() : picker.click()}><img src="/icons/folder-open.svg" alt="" /></button>
      <button class="primary" disabled title="Export is not implemented yet"><img src="/icons/upload.svg" alt="" /> Export…</button>
    </div>
  </header>

  <div class="workbench">
    <nav class="tool-rail" aria-label="Editing tools">
      <button class="active" aria-label="Select regions" title="Select regions" onclick={focusTimeline}><img src="/icons/pointer.svg" alt="" /></button>
      <button aria-label="Cut selected region" title="Remove selected region" disabled={!ready || !selection} onclick={removeSelection}><img src="/icons/cut.svg" alt="" /></button>
      <button aria-label="Fullscreen preview" title="Fullscreen preview" disabled={!ready} onclick={fullscreen}><img src="/icons/maximize.svg" alt="" /></button>
      <button aria-label="Audio timeline" title="Audio timeline" onclick={focusTimeline}><img src="/icons/wave-sine.svg" alt="" /></button>
      <button aria-label="Processing settings" title="Processing settings are not implemented yet" disabled><img src="/icons/adjustments-horizontal.svg" alt="" /></button>
    </nav>
    <div class="preview-stage">
  <section class:dragging class:has-video={!!url} class="preview" aria-label="Video preview"
    ondragenter={(event) => { event.preventDefault(); dragging = true; }}
    ondragover={(event) => { event.preventDefault(); dragging = true; }}
    ondragleave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) dragging = false; }}
    ondrop={drop}>
    {#if url}
      {#key url}
        <!-- svelte-ignore a11y_media_has_caption (Local files do not supply caption tracks.) -->
        <video bind:this={video} src={url} preload="auto" playsinline
          onloadedmetadata={mediaEvent} onloadeddata={mediaEvent} oncanplay={mediaEvent} onseeked={mediaEvent}
          onwaiting={mediaEvent} onplaying={mediaEvent}
          onplay={mediaEvent} onpause={mediaEvent}
          onended={mediaEvent} onerror={mediaEvent}
          ontimeupdate={mediaEvent} ondurationchange={mediaEvent}>
        </video>
      {/key}
      {#if loading}<div class="loading" role="status">Loading video…</div>{/if}
    {:else}
      <div class="empty-state">
        <div class="video-icon" aria-hidden="true"><img src="/icons/device-tv.svg" alt="" /></div>
        <h1>{dragging ? 'Drop to open your video' : 'A space for your video'}</h1>
        <p>Drop a video here, or choose one from your computer.</p>
        <button class="primary" onclick={() => desktop ? void importMedia() : picker.click()}>Open video</button>
        <span class="privacy">Local playback. No uploads.</span>
      </div>
    {/if}
    {#if dragging && url}<div class="drop-overlay">Drop to replace your video</div>{/if}
  </section>

  <section class="transport" aria-label="Playback controls">
    <div class="control-row">
      <button class="primary play-button" disabled={!canPlay} onclick={togglePlayback} aria-label={playing ? 'Pause video' : 'Play video'}>
        <img src={playing ? '/icons/player-pause.svg' : '/icons/player-play.svg'} alt="" />
      </button>
      <span class="time" aria-label={`Elapsed ${time(displayPosition)}, total ${time(displayDuration)}`}>{time(displayPosition)} <span>/</span> {time(displayDuration)}</span>
      <input class="seek" type="range" min="0" max={displayDuration || 1} step="0.01" value={displayPosition} oninput={seek} disabled={!canPlay || !displayDuration} aria-label="Seek video" aria-valuetext={`${time(displayPosition)} of ${time(displayDuration)}`} style={`--progress: ${displayDuration ? displayPosition / displayDuration * 100 : 0}%`} />
      <label class="speed"><span>Speed</span><select aria-label="Playback speed" value={speed} onchange={changeSpeed} disabled={!ready}>{#each speeds as value}<option value={value}>{value}×</option>{/each}</select></label>
    </div>
    <div class="control-footer"><span>{url ? 'Your original file stays untouched.' : 'Open a video to get started.'}</span><span class="keyboard-hint">Space to play / pause</span></div>
  </section>
    </div>
    <CleanupPanel cuts={edits.cuts} {duration} onreview={reviewCuts} onrestore={restoreCut} />
  </div>

  <section class="editor" aria-label="Region editing">
    {#if error}<div class="error" role="alert"><span>{error}</span><button onclick={() => desktop ? void importMedia() : picker.click()}>Choose another video</button></div>{/if}
    {#key url}
    <SelectionTimeline {duration} {position} {selection} {analysis} {thumbnails} {analysisStatus} cuts={edits.cuts} disabled={!ready || !duration} onselect={setSelection}>
    {#snippet controls()}
      <div class="mode-buttons" role="group" aria-label="Preview mode">
        <button class:active={mode === 'original'} aria-pressed={mode === 'original'} disabled={!ready} onclick={() => setMode('original')}>Original</button>
        <button class:active={mode === 'edited'} aria-pressed={mode === 'edited'} disabled={!ready} onclick={() => setMode('edited')}>Edited</button>
        <button class:active={mode === 'selection'} aria-pressed={mode === 'selection'} disabled={!ready || !selection} onclick={() => setMode('selection')}>Selection</button>
      </div>
      <div class="selection-actions">
        <button disabled={!ready || !selection} onclick={replaySelection}>Replay selection</button>
        <label class="loop-control"><input type="checkbox" checked={loopSelection} disabled={!ready || !selection} onchange={(event) => { loopSelection = event.currentTarget.checked; if (loopSelection) setMode('selection'); }} /> Loop selection</label>
        <button disabled={!selection} title="Clear the active selection without changing cuts" onclick={() => { selection = null; loopSelection = false; if (mode === 'selection') setMode('original'); }}>Deselect</button>
      </div>
    {/snippet}
    </SelectionTimeline>
    {/key}
    <div class="region-actionbar" role="group" aria-label="Region actions">
      <button class="remove-button" aria-label="Remove selection" disabled={!ready || !selection} onclick={removeSelection}><img src="/icons/cut.svg" alt="" />Remove</button>
      <button disabled title="Pause shortening is not implemented yet"><img src="/icons/arrows-diagonal.svg" alt="" />Shorten</button>
      <button disabled title="Soft mute with fades is not implemented yet"><img src="/icons/volume-off.svg" alt="" />Soft mute</button>
      <button disabled title="Gain reduction is not implemented yet"><img src="/icons/volume.svg" alt="" />Reduce volume</button>
      <button disabled={!ready || !canRestoreSelection} title="Restore removed content within the selected region" onclick={() => { if (selection) restoreCut(selection); }}><img src="/icons/check.svg" alt="" />Keep</button>
    </div>
    <p class="edit-summary" role="status" aria-label="Edit summary">{edits.cuts.length} removed {edits.cuts.length === 1 ? 'region' : 'regions'} · Edited length {outputDuration.toFixed(3)} s · Purple: selection. Red: cut. Use Restore to keep removed content.</p>
    {#if ready && mode === 'edited' && outputDuration === 0}<p class="edit-empty">All video is removed. Undo a cut or switch to Original to keep reviewing.</p>{/if}
  </section>
</main>

<style>
  .save-status { font-size: 11px; white-space: nowrap; }
  .project-menu { position: relative; font-size: 12px; }
  .project-menu summary { cursor: pointer; padding: 8px; }
  .project-menu > div { position: absolute; right: 0; top: 100%; z-index: 20; background: #fff; padding: 8px; border-radius: 12px; box-shadow: 0 4px 20px #33225533; width: 160px; display: grid; gap: 6px; }
  .prompt-backdrop { position: fixed; inset: 0; background: #21153d66; z-index: 100; display: grid; place-items: center; }
  .project-prompt { max-width: 440px; background: #fff; padding: 24px; border-radius: 16px; }
  .project-prompt div { display: flex; justify-content: flex-end; gap: 12px; }
</style>
