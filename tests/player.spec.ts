import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window {
    revoked: string[];
    rejectPlayback: (reason: Error) => void;
    selectionLoops: number;
    cutJumps: number;
    seekHarness: {
      targets: number[];
      plays: number;
      settle: (landing?: number) => void;
      moveTo: (time: number) => void;
    };
  }
}

let clip: Buffer;

// Generate an actual video/audio file using the browser's own encoders.
// Tests need no downloaded fixture, FFmpeg executable, or media binding.
test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto('/');
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;
    const drawing = canvas.getContext('2d')!;
    const audio = new AudioContext();
    await audio.resume();
    const oscillator = audio.createOscillator();
    const destination = audio.createMediaStreamDestination();
    oscillator.frequency.value = 220;
    oscillator.connect(destination);
    oscillator.start();
    const stream = canvas.captureStream(20);
    destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    const finished = new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
    });
    let frame = 0;
    const paint = setInterval(() => {
      drawing.fillStyle = frame++ % 2 ? '#5c3be8' : '#c2b2fa';
      drawing.fillRect(0, 0, 320, 180);
      drawing.fillStyle = 'white';
      drawing.font = '24px sans-serif';
      drawing.fillText('UnSaid playback test', 32, 96);
    }, 50);
    recorder.start();
    await new Promise((resolve) => setTimeout(resolve, 2500));
    recorder.stop();
    const blob = await finished;
    clearInterval(paint);
    stream.getTracks().forEach((track) => track.stop());
    oscillator.stop();
    await audio.close();
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  clip = Buffer.from(bytes);
  await page.close();
});

async function openClip(page: Page, name = 'vídeo with spaces.webm') {
  await page.locator('input[type=file]').setInputFiles({
    name, mimeType: 'video/webm', buffer: clip,
  });
  await expect(page.getByRole('button', { name: 'Play video', exact: true })).toBeEnabled();
}

async function seek(page: Page, position: number) {
  await page.getByRole('slider', { name: 'Seek video' }).evaluate((element, value) => {
    const input = element as HTMLInputElement;
    input.value = String(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, position);
}

test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('empty state has usable import and disabled transport', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'A space for your video' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play video', exact: true })).toBeDisabled();
  await expect(page.getByRole('slider', { name: 'Seek video' })).toBeDisabled();
  await page.screenshot({ path: 'test-results/empty-state.png' });
});

test('local audio/video plays, pauses, seeks and changes speed without uploads', async ({ page }) => {
  const uploads: string[] = [];
  page.on('request', (request) => {
    if (['POST', 'PUT', 'PATCH'].includes(request.method())) uploads.push(request.url());
  });
  await openClip(page);
  await expect(page.locator('.filename')).toHaveText('vídeo with spaces.webm');
  await expect.poll(() => page.locator('video').evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
  await page.getByRole('button', { name: 'Play video', exact: true }).click();
  await expect.poll(() => page.locator('video').evaluate((video: HTMLVideoElement) => video.currentTime)).toBeGreaterThan(0.15);
  await expect.poll(() => page.locator('video').evaluate((video: HTMLVideoElement) =>
    (video as HTMLVideoElement & { webkitAudioDecodedByteCount: number }).webkitAudioDecodedByteCount,
  )).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Pause video', exact: true }).click();
  await seek(page, 1.2);
  await expect.poll(() => page.locator('video').evaluate((video: HTMLVideoElement) => video.currentTime)).toBeCloseTo(1.2, 1);
  expect(await page.locator('video').evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
  await page.getByLabel('Playback speed').selectOption('1.5');
  expect(await page.locator('video').evaluate((video: HTMLVideoElement) => video.playbackRate)).toBe(1.5);
  expect(uploads).toEqual([]);
  await page.screenshot({ path: 'test-results/loaded-player.png' });
});

test('Space toggles playback but leaves form controls alone', async ({ page }) => {
  await openClip(page);
  await page.locator('main').click({ position: { x: 10, y: 10 } });
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Pause video', exact: true })).toBeEnabled();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Play video', exact: true })).toBeEnabled();
  await page.getByLabel('Playback speed').focus();
  await page.keyboard.press('Space');
  expect(await page.locator('video').evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
});

test('replacing a source revokes its URL and resets playback state', async ({ page }) => {
  await page.evaluate(() => {
    const revoke = URL.revokeObjectURL.bind(URL);
    window.revoked = [];
    URL.revokeObjectURL = (url) => {
      window.revoked.push(url);
      revoke(url);
    };
  });
  await openClip(page, 'first.webm');
  const old = await page.locator('video').getAttribute('src');
  await page.getByLabel('Playback speed').selectOption('2');
  await openClip(page, 'second.webm');
  await expect(page.locator('.filename')).toHaveText('second.webm');
  expect(await page.evaluate(() => window.revoked)).toContain(old);
  expect(await page.locator('video').evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
  expect(await page.locator('video').evaluate((video: HTMLVideoElement) => video.playbackRate)).toBe(1);
  expect(await page.locator('input[type=file]').inputValue()).toBe('');
});

test('invalid files and decoder errors recover after choosing a valid source', async ({ page }) => {
  await page.locator('input[type=file]').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('notes') });
  await expect(page.getByRole('alert')).toContainText('Choose a video file');
  await page.locator('input[type=file]').setInputFiles({ name: 'broken.webm', mimeType: 'video/webm', buffer: Buffer.from('not a video') });
  await expect(page.getByRole('alert')).toContainText('not supported');
  await expect(page.getByRole('button', { name: 'Play video', exact: true })).toBeDisabled();
  await openClip(page);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('a failed play request from an old file cannot corrupt its replacement', async ({ page }) => {
  await openClip(page, 'first.webm');
  await page.locator('video').evaluate((video: HTMLVideoElement) => {
    video.play = () => new Promise<void>((_, reject) => { window.rejectPlayback = reject; });
  });
  await page.getByRole('button', { name: 'Play video', exact: true }).click();
  await openClip(page, 'replacement.webm');
  await page.evaluate(() => window.rejectPlayback(new Error('Old source rejected')));
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.filename')).toHaveText('replacement.webm');
  await expect(page.getByRole('button', { name: 'Play video', exact: true })).toBeEnabled();
});

test('drag-and-drop imports a local file without navigating away', async ({ page }) => {
  const data = await page.evaluateHandle((bytes) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(bytes)], 'dropped.webm', { type: 'video/webm' }));
    return transfer;
  }, Array.from(clip));
  await page.locator('.preview').dispatchEvent('drop', { dataTransfer: data });
  await expect(page.locator('.filename')).toHaveText('dropped.webm');
  await expect(page.getByRole('button', { name: 'Play video', exact: true })).toBeEnabled();
  expect(page.url()).toBe('http://127.0.0.1:1420/');
  await data.dispose();
});

test('Play restarts an ended source', async ({ page }) => {
  await openClip(page);
  const duration = await page.locator('video').evaluate((video: HTMLVideoElement) => video.duration);
  await seek(page, duration - 0.15);
  await page.getByRole('button', { name: 'Play video', exact: true }).click();
  await expect.poll(() => page.locator('video').evaluate((video: HTMLVideoElement) => video.ended)).toBe(true);
  await page.getByRole('button', { name: 'Play video', exact: true }).click();
  await expect.poll(() => page.locator('video').evaluate((video: HTMLVideoElement) => video.currentTime)).toBeLessThan(1);
  await expect(page.getByRole('button', { name: 'Pause video', exact: true })).toBeEnabled();
});

test('layout fits a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openClip(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: 'Play video', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/narrow-player.png' });
});

async function selectRegion(page: Page, start: number, end: number) {
  const rail = page.getByRole('group', { name: 'Drag across source timeline to select a region' });
  await rail.scrollIntoViewIfNeeded();
  const bounds = (await rail.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width * 0.1, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.9, bounds.y + bounds.height / 2, { steps: 8 });
  await page.mouse.up();
  const endField = page.getByRole('spinbutton', { name: /^Selection end/ });
  const startField = page.getByRole('spinbutton', { name: /^Selection start/ });
  // Expand the draft first so every numeric change remains a valid interval.
  await startField.fill('0');
  await startField.press('Tab');
  await endField.fill(String(end));
  await endField.press('Tab');
  await startField.fill(String(start));
  await startField.press('Tab');
}

test('source regions support reverse drags, precise fields and keyboard handles', async ({ page }) => {
  await openClip(page);
  const rail = page.getByRole('group', { name: 'Drag across source timeline to select a region' });
  await rail.scrollIntoViewIfNeeded();
  const bounds = (await rail.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width * 0.8, bounds.y + 30);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.2, bounds.y + 30, { steps: 6 });
  await page.mouse.up();
  const start = page.getByRole('spinbutton', { name: /^Selection start/ });
  const end = page.getByRole('spinbutton', { name: /^Selection end/ });
  expect(Number(await start.inputValue())).toBeLessThan(Number(await end.inputValue()));
  await selectRegion(page, 0.3, 1.3);
  const handle = page.getByRole('slider', { name: 'Selection start', exact: true });
  await handle.focus();
  await page.keyboard.press('ArrowRight');
  expect(Number(await start.inputValue())).toBeCloseTo(0.31, 2);
  await page.keyboard.press('Shift+ArrowRight');
  expect(Number(await start.inputValue())).toBeCloseTo(0.41, 2);
  await start.fill('2');
  await start.press('Tab');
  expect(Number(await start.inputValue())).toBeCloseTo(0.41, 2);
  expect(Number(await end.inputValue())).toBeCloseTo(1.3, 2);
});

test('selection replay stops at its end and loops without escaping the region', async ({ page }) => {
  await openClip(page);
  await selectRegion(page, 0.25, 0.65);
  await page.getByRole('button', { name: 'Replay selection', exact: true }).click();
  await expect.poll(() => page.locator('video').evaluate((video: HTMLVideoElement) => video.currentTime)).toBeGreaterThan(0.3);
  await expect.poll(() => page.locator('video').evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
  expect(await page.locator('video').evaluate((video: HTMLVideoElement) => video.currentTime)).toBeCloseTo(0.65, 1);
  await page.evaluate(() => {
    window.selectionLoops = 0;
    document.querySelector('video')!.addEventListener('seeking', () => {
      if (document.querySelector('video')!.currentTime < 0.3) window.selectionLoops++;
    });
  });
  await page.getByLabel('Loop selection', { exact: true }).check();
  await page.getByRole('button', { name: 'Replay selection', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.selectionLoops)).toBeGreaterThanOrEqual(3);
  expect(await page.locator('video').evaluate((video: HTMLVideoElement) => video.paused)).toBe(false);
  await page.getByRole('button', { name: 'Pause video', exact: true }).click();
});

test('cuts shorten edited time, skip removed media and support original comparison', async ({ page }) => {
  await openClip(page);
  const originalDuration = await page.locator('video').evaluate((video: HTMLVideoElement) => video.duration);
  const sourceUrl = await page.locator('video').getAttribute('src');
  await selectRegion(page, 0.4, 1.4);
  await page.getByRole('button', { name: 'Remove selection', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edited', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(Number(await page.getByRole('slider', { name: 'Seek video', exact: true }).getAttribute('max'))).toBeCloseTo(originalDuration - 1, 2);
  await expect(page.getByRole('list', { name: 'Removed regions' })).toContainText('0.400–1.400');
  await seek(page, 0.35);
  await page.evaluate(() => {
    window.cutJumps = 0;
    document.querySelector('video')!.addEventListener('seeking', () => {
      const sourceTime = document.querySelector('video')!.currentTime;
      if (sourceTime >= 1.4 && sourceTime < 1.45) window.cutJumps++;
    });
  });
  await page.getByRole('button', { name: 'Play video', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.cutJumps)).toBeGreaterThan(0);
  await expect.poll(() => page.locator('video').evaluate((video: HTMLVideoElement) => video.currentTime)).toBeGreaterThanOrEqual(1.4);
  await page.getByRole('button', { name: 'Pause video', exact: true }).click();
  await seek(page, 0.5);
  await expect.poll(() => page.locator('video').evaluate((video: HTMLVideoElement) => video.currentTime)).toBeCloseTo(1.5, 1);
  await page.getByRole('button', { name: 'Original', exact: true }).click();
  await seek(page, 0.8);
  await expect.poll(() => page.locator('video').evaluate((video: HTMLVideoElement) => video.currentTime)).toBeCloseTo(0.8, 1);
  expect(await page.locator('video').getAttribute('src')).toBe(sourceUrl);
  expect(await page.locator('video').evaluate((video: HTMLVideoElement) => video.duration)).toBeCloseTo(originalDuration, 2);
  await page.screenshot({ path: 'test-results/region-editor.png', fullPage: true });
});

test('undo and redo restore cuts, branching clears redo, and replacement resets the session', async ({ page }) => {
  await openClip(page);
  await selectRegion(page, 0.3, 0.8);
  await page.getByRole('button', { name: 'Remove selection', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Removed regions' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Removed regions' })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await selectRegion(page, 1.2, 1.6);
  await page.getByRole('button', { name: 'Remove selection', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeDisabled();
  await openClip(page, 'new-project.webm');
  await expect(page.getByRole('list', { name: 'Removed regions' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Selection', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Original', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('removing the full source disables edited play while undo restores it', async ({ page }) => {
  await openClip(page);
  const duration = await page.locator('video').evaluate((video: HTMLVideoElement) => video.duration);
  await selectRegion(page, 0, duration);
  await page.getByRole('button', { name: 'Remove selection', exact: true }).click();
  await expect(page.getByText('All video is removed.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play video', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Original', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play video', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Edited', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play video', exact: true })).toBeEnabled();
});

test('selection looping also restarts when its end equals the source end', async ({ page }) => {
  await openClip(page);
  const duration = await page.locator('video').evaluate((video: HTMLVideoElement) => video.duration);
  const start = duration - 0.4;
  await selectRegion(page, start, duration);
  await page.evaluate((boundary) => {
    window.selectionLoops = 0;
    document.querySelector('video')!.addEventListener('seeking', () => {
      if (document.querySelector('video')!.currentTime <= boundary + 0.01) window.selectionLoops++;
    });
  }, start);
  await page.getByLabel('Loop selection', { exact: true }).check();
  await page.getByRole('button', { name: 'Replay selection', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.selectionLoops)).toBeGreaterThanOrEqual(3);
  await page.getByRole('button', { name: 'Pause video', exact: true }).click();
});

test('I/O and undo/redo shortcuts operate on the source timeline', async ({ page }) => {
  await openClip(page);
  await seek(page, 0.3);
  await page.locator('main').click({ position: { x: 10, y: 10 } });
  await page.keyboard.press('i');
  await seek(page, 1.1);
  await page.locator('main').click({ position: { x: 10, y: 10 } });
  await page.keyboard.press('o');
  expect(Number(await page.getByRole('spinbutton', { name: /^Selection start/ }).inputValue())).toBeCloseTo(0.3, 2);
  expect(Number(await page.getByRole('spinbutton', { name: /^Selection end/ }).inputValue())).toBeCloseTo(1.1, 2);
  await page.keyboard.press('Delete');
  await expect(page.getByRole('list', { name: 'Removed regions' })).toBeVisible();
  await page.keyboard.press('Control+z');
  await expect(page.getByRole('list', { name: 'Removed regions' })).toHaveCount(0);
  await page.keyboard.press('Control+Shift+z');
  await expect(page.getByRole('list', { name: 'Removed regions' })).toBeVisible();
});

// Deterministic decoder timing for states a short real WebM cannot reliably
// provoke: delayed seek completion and a rounded seek landing. Other tests
// continue to exercise native video/audio decoding and actual playback.
async function installSeekHarness(page: Page) {
  await page.locator('video').evaluate((video: HTMLVideoElement) => {
    let current = video.currentTime;
    let seeking = false;
    let paused = true;
    const harness: Window['seekHarness'] = window.seekHarness = {
      targets: [] as number[], plays: 0,
      settle(landing?: number) {
        current = landing ?? harness.targets[harness.targets.length - 1] ?? current;
        seeking = false;
        video.dispatchEvent(new Event('seeked'));
      },
      moveTo(time: number) { current = time; video.dispatchEvent(new Event('timeupdate')); },
    };
    Object.defineProperties(video, {
      currentTime: {
        configurable: true, get: () => current,
        set: (target: number) => {
          current = target;
          seeking = true;
          harness.targets.push(target);
          video.dispatchEvent(new Event('waiting'));
        },
      },
      seeking: { configurable: true, get: () => seeking },
      paused: { configurable: true, get: () => paused },
    });
    video.play = async () => {
      harness.plays++;
      if (seeking) throw new DOMException('Seek has not completed', 'AbortError');
      paused = false;
      video.dispatchEvent(new Event('play'));
      video.dispatchEvent(new Event('playing'));
    };
    video.pause = () => { paused = true; video.dispatchEvent(new Event('pause')); };
  });
}

test('selection Play waits for its pending seek and does not leave a loading overlay', async ({ page }) => {
  await openClip(page);
  await selectRegion(page, 0.4, 1.4);
  await installSeekHarness(page);
  await page.getByRole('button', { name: 'Selection', exact: true }).click();
  await page.getByRole('button', { name: 'Play video', exact: true }).click();
  expect(await page.evaluate(() => window.seekHarness.plays)).toBe(0);
  expect(await page.evaluate(() => window.seekHarness.targets)).toEqual([0.4]);
  await page.evaluate(() => window.seekHarness.settle());
  await expect(page.getByRole('button', { name: 'Pause video', exact: true })).toBeVisible();
  await expect(page.getByText('Loading video…', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => window.seekHarness.plays)).toBe(1);
});

test('Original Play waits for an in-flight seek after switching out of Selection', async ({ page }) => {
  await openClip(page);
  await selectRegion(page, 0.4, 1.4);
  await installSeekHarness(page);
  await page.getByRole('button', { name: 'Selection', exact: true }).click();
  await page.getByRole('button', { name: 'Original', exact: true }).click();
  await page.getByRole('button', { name: 'Play video', exact: true }).click();
  expect(await page.evaluate(() => window.seekHarness.plays)).toBe(0);
  await page.evaluate(() => window.seekHarness.settle());
  await expect(page.getByRole('button', { name: 'Pause video', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.seekHarness.plays)).toBe(1);
});

test('seeking to selection end while paused with Loop enabled does not start playback', async ({ page }) => {
  await openClip(page);
  await selectRegion(page, 0.4, 1.4);
  await page.getByLabel('Loop selection', { exact: true }).check();
  await expect.poll(() => page.locator('video').evaluate((video: HTMLVideoElement) => video.seeking)).toBe(false);
  await installSeekHarness(page);
  await seek(page, 1.4);
  await page.evaluate(() => window.seekHarness.settle());
  expect(await page.evaluate(() => window.seekHarness.plays)).toBe(0);
  expect(await page.evaluate(() => window.seekHarness.targets)).toEqual([1.4]);
  expect(await page.locator('video').evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
});

test('edited play avoids no-op seeks and does not repeatedly seek a rounded cut landing', async ({ page }) => {
  await openClip(page);
  await selectRegion(page, 0.4, 1.4);
  await page.getByRole('button', { name: 'Remove selection', exact: true }).click();
  await installSeekHarness(page);
  await page.getByRole('button', { name: 'Play video', exact: true }).click();
  expect(await page.evaluate(() => window.seekHarness.targets)).toEqual([]);
  expect(await page.evaluate(() => window.seekHarness.plays)).toBe(1);
  await page.evaluate(() => window.seekHarness.moveTo(0.5));
  expect(await page.evaluate(() => window.seekHarness.targets)).toEqual([1.4]);
  await page.evaluate(() => window.seekHarness.settle(1.39));
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  expect(await page.evaluate(() => window.seekHarness.targets)).toEqual([1.4]);
  await expect(page.getByText('Loading video…', { exact: true })).toHaveCount(0);
});

test('undo and redo during a pending seek restore the preview and cancel stale playback intent', async ({ page }) => {
  await openClip(page);
  await selectRegion(page, 0.4, 1.4);
  await installSeekHarness(page);
  await page.evaluate(() => window.seekHarness.moveTo(0.6));
  await page.getByRole('button', { name: 'Remove selection', exact: true }).click();
  expect(await page.evaluate(() => window.seekHarness.targets)).toEqual([1.4]);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.evaluate(() => window.seekHarness.settle());
  await page.evaluate(() => window.seekHarness.settle());
  expect(await page.locator('video').evaluate((video: HTMLVideoElement) => video.currentTime)).toBeCloseTo(0.4, 2);
  await expect(page.getByRole('list', { name: 'Removed regions' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.evaluate(() => window.seekHarness.settle());
  expect(await page.locator('video').evaluate((video: HTMLVideoElement) => video.currentTime)).toBeCloseTo(1.4, 2);
  await expect(page.getByRole('list', { name: 'Removed regions' })).toBeVisible();
  expect(await page.evaluate(() => window.seekHarness.plays)).toBe(0);
  await expect(page.getByText('Loading video…', { exact: true })).toHaveCount(0);
});

test('Deselect clears the active highlight; Restore removes a cut reversibly', async ({ page }) => {
  await openClip(page);
  await selectRegion(page, 0.4, 1.4);
  await expect(page.locator('.rail .selected')).toHaveCount(1);
  await page.getByRole('button', { name: 'Deselect', exact: true }).click();
  await expect(page.locator('.rail .selected')).toHaveCount(0);
  await expect(page.locator('.rail .cut')).toHaveCount(0);
  await expect(page.getByRole('spinbutton', { name: /^Selection start/ })).toBeDisabled();
  await selectRegion(page, 0.4, 1.4);
  await page.getByRole('button', { name: 'Remove selection', exact: true }).click();
  await page.getByRole('button', { name: 'Deselect', exact: true }).click();
  await expect(page.locator('.rail .selected')).toHaveCount(0);
  await expect(page.locator('.rail .cut')).toHaveCount(1);
  await expect(page.getByRole('status', { name: 'Edit summary' })).toContainText('Red: cut');
  await page.getByRole('button', { name: 'Restore cut 0.400–1.400 seconds', exact: true }).click();
  await expect(page.locator('.rail .cut')).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'Removed regions' })).toHaveCount(0);
  await expect.poll(() => page.locator('video').evaluate((video: HTMLVideoElement) => video.currentTime)).toBeCloseTo(0.4, 2);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.rail .cut')).toHaveCount(1);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.locator('.rail .cut')).toHaveCount(0);
});

test('Keep restores only the selected portion and preserves surrounding cuts', async ({ page }) => {
  await openClip(page);
  await selectRegion(page, 0.3, 1.5);
  await page.getByRole('button', { name: 'Remove selection', exact: true }).click();
  await selectRegion(page, 0.6, 0.9);
  await page.getByRole('button', { name: 'Keep', exact: true }).click();
  await expect(page.locator('.rail .cut')).toHaveCount(2);
  const list = page.getByRole('list', { name: 'Removed regions' });
  await expect(list).toContainText('0.300–0.600');
  await expect(list).toContainText('0.900–1.500');
  await expect(page.getByRole('button', { name: 'Keep', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(list).toContainText('0.300–1.500');
  await expect(page.locator('.rail .cut')).toHaveCount(1);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.locator('.rail .cut')).toHaveCount(2);
});

test('local waveform, spectrum and filmstrip use decoded media and the reference layout fits', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 1600, height: 900 });
  await openClip(page);
  await expect(page.locator('canvas[aria-label="Audio waveform"]')).toBeVisible();
  await expect(page.locator('canvas[aria-label="Audio frequency spectrum"]')).toBeVisible();
  await expect(page.locator('[aria-label="Video thumbnails"] img')).toHaveCount(8);
  const pixels = await page.locator('canvas[aria-label="Audio waveform"]').evaluate((canvas: HTMLCanvasElement) => {
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    return data.some((channel, i) => i % 4 === 3 && channel > 0);
  });
  expect(pixels).toBe(true);
  const midpoint = await page.locator('video').evaluate((video: HTMLVideoElement) => video.duration / 2);
  await selectRegion(page, midpoint - 0.05, midpoint + 0.05);
  await page.getByRole('button', { name: 'Edited', exact: true }).click();
  await seek(page, midpoint);
  await expect.poll(() => page.locator('video').evaluate((video: HTMLVideoElement) => video.seeking)).toBe(false);
  expect(await page.locator('img').evaluateAll((images: HTMLImageElement[]) => images.every((image) => image.complete && image.naturalWidth > 0))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  expect(errors).toEqual([]);
  await page.locator('.editor').screenshot({ path: 'test-results/timeline-detail.png' });
  await page.getByRole('complementary', { name: 'Cleanup' }).screenshot({ path: 'test-results/cleanup-detail.png' });
  await page.screenshot({ path: 'test-results/reference-layout.png' });
});
