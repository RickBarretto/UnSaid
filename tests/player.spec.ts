import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window {
    revoked: string[];
    rejectPlayback: (reason: Error) => void;
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
