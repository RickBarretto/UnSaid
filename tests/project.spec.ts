import { expect, test, type Page } from '@playwright/test';

let clip: number[];
let clipDuration: number;

// A browser-encoded local clip keeps these tests independent of media binaries.
test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto('/');
  clip = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 36;
    const context = canvas.getContext('2d')!;
    const audio = new AudioContext();
    await audio.resume();
    const oscillator = audio.createOscillator();
    const destination = audio.createMediaStreamDestination();
    oscillator.frequency.value = 220;
    oscillator.connect(destination);
    oscillator.start();
    const stream = canvas.captureStream(10);
    destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    const complete = new Promise<Blob>((resolve) => recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' })));
    const paint = setInterval(() => {
      context.fillStyle = context.fillStyle === '#8421aa' ? '#21aa84' : '#8421aa';
      context.fillRect(0, 0, 64, 36);
    }, 80);
    recorder.start();
    await new Promise((resolve) => setTimeout(resolve, 2200));
    recorder.stop();
    const blob = await complete;
    clearInterval(paint);
    stream.getTracks().forEach((track) => track.stop());
    oscillator.stop();
    await audio.close();
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  clipDuration = await page.evaluate(async (bytes) => {
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'video/webm' }));
    const video = document.createElement('video');
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Generated fixture did not decode'));
    });
    const duration = video.duration;
    URL.revokeObjectURL(url);
    return duration;
  }, clip);
  await page.close();
});

type Project = {
  version: 1;
  source: { path: string; name: string; size: number; duration: number };
  edits: { cuts: { start: number; end: number }[]; past: { start: number; end: number }[][]; future: { start: number; end: number }[][] };
  position: number;
  mode: 'original' | 'edited';
  speed: number;
  updatedAt: number;
};

const path = '/media/clip.webm';
const projectPath = '/projects/cut.unsaid';

function project(size: number): Project {
  return {
    version: 1,
    source: { path, name: 'clip.webm', size, duration: clipDuration },
    edits: { cuts: [{ start: 0.3, end: 0.7 }], past: [[]], future: [] },
    position: 1,
    mode: 'edited',
    speed: 1.5,
    updatedAt: Date.now(),
  };
}

async function setup(page: Page, options: { text?: string; missing?: boolean; recovery?: string; cancelSave?: boolean; failWrite?: boolean } = {}) {
  await page.addInitScript(({ bytes, sourcePath, documentPath, text, missing, recovery, cancelSave, failWrite }) => {
    const state = {
      writes: [] as { path: string; text: string }[],
      recoveries: [] as { path: string | null; text: string }[],
      cleared: 0,
      projectText: text,
      missing,
      cancelSave,
      failWrite,
      holdWrite: false,
      writeInFlight: false,
      mediaReads: [] as string[],
      releaseWrite: null as null | (() => void),
    };
    const mediaUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'video/webm' }));
    const media = { path: sourcePath, name: 'clip.webm', size: bytes.length, url: mediaUrl };
    const backend = {
      pickMedia: async () => media,
      loadMedia: async (requested: string) => {
        if (state.missing || requested !== sourcePath) throw new Error('Source file is missing');
        return media;
      },
      readMedia: async (requested: string) => {
        state.mediaReads.push(requested);
        if (state.missing || requested !== sourcePath) throw new Error('Source file is missing');
        return new Uint8Array(bytes);
      },
      pickProject: async () => state.projectText === undefined ? null : { path: documentPath, text: state.projectText },
      writeProject: async (requested: string, content: string) => {
        if (state.failWrite) throw new Error('Disk is full');
        if (state.holdWrite) {
          state.writeInFlight = true;
          await new Promise<void>((resolve) => { state.releaseWrite = resolve; });
          state.releaseWrite = null;
          state.writeInFlight = false;
        }
        state.writes.push({ path: requested, text: content });
      },
      chooseProjectPath: async () => state.cancelSave ? null : documentPath,
      readRecovery: async () => recovery === undefined ? null : { path: null, text: recovery },
      writeRecovery: async (requested: string | null, content: string) => { state.recoveries.push({ path: requested, text: content }); },
      clearRecovery: async () => { state.cleared++; },
      resolveSource: async (_project: string, requested: string) => requested,
    };
    Object.assign(window, { __UNSAID_STORAGE__: backend, __projectTest: state });
  }, { bytes: clip, sourcePath: path, documentPath: projectPath, text: options.text, missing: options.missing ?? false, recovery: options.recovery, cancelSave: options.cancelSave ?? false, failWrite: options.failWrite ?? false });
  await page.goto('/');
}

async function state(page: Page) {
  return page.evaluate(() => (window as unknown as { __projectTest: { writes: { path: string; text: string }[]; recoveries: { path: string | null; text: string }[]; mediaReads: string[]; cleared: number; projectText?: string; missing: boolean; cancelSave: boolean; failWrite: boolean } }).__projectTest);
}

async function expectMediaAnalysis(page: Page) {
  await expect(page.locator('canvas[aria-label="Audio waveform"]')).toBeVisible();
  await expect(page.locator('canvas[aria-label="Audio frequency spectrum"]')).toBeVisible();
  await expect(page.locator('[aria-label="Video thumbnails"] img')).toHaveCount(8);
  await expect.poll(async () => (await state(page)).mediaReads).toContain(path);
}

test('native media analysis renders after import and project reopen', async ({ page }) => {
  await setup(page, { text: JSON.stringify(project(clip.length)) });
  await page.locator('.open-button').click();
  await expectMediaAnalysis(page);
  await openProjectMenu(page);
  await page.getByRole('button', { name: 'Save project', exact: true }).click();
  await expect.poll(async () => (await state(page)).writes.length).toBe(1);
  await page.getByRole('button', { name: 'Open project', exact: true }).click();
  await expect.poll(async () => (await state(page)).mediaReads.length).toBe(2);
  await expect(page.getByRole('status', { name: 'Edit summary' })).toContainText('1 removed region');
  await expectMediaAnalysis(page);
});

async function openProjectMenu(page: Page) {
  await page.locator('details.project-menu summary').click();
}

test('opening a project restores cuts, undo history, preview mode, speed and position', async ({ page }) => {
  await setup(page, { text: JSON.stringify(project(clip.length)) });
  await openProjectMenu(page);
  await page.getByRole('button', { name: 'Open project', exact: true }).click();
  await expect(page.locator('.filename')).toHaveText('clip.webm');
  await expect(page.getByRole('status', { name: 'Edit summary' })).toContainText('1 removed region');
  await expect(page.getByRole('button', { name: 'Edited', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Playback speed')).toHaveValue('1.5');
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
  await expect.poll(() => page.locator('video').evaluate((video: HTMLVideoElement) => video.currentTime)).toBeCloseTo(1, 1);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Edit summary' })).toContainText('0 removed regions');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Edit summary' })).toContainText('1 removed region');
});

test('an invalid project does not replace the current session', async ({ page }) => {
  await setup(page, { text: '{"version":999}' });
  await page.locator('.open-button').click();
  await expect(page.locator('.filename')).toHaveText('clip.webm');
  await openProjectMenu(page);
  await page.getByRole('button', { name: 'Open project', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('.filename')).toHaveText('clip.webm');
  await expect(page.getByRole('button', { name: 'Play video', exact: true })).toBeEnabled();
  await expect(page.getByRole('status', { name: 'Edit summary' })).toContainText('0 removed regions');
});

test('save and autosave write the project and recovery snapshot', async ({ page }) => {
  await setup(page);
  await page.locator('.open-button').click();
  await expect(page.locator('.filename')).toHaveText('clip.webm');
  await openProjectMenu(page);
  await page.getByRole('button', { name: 'Save project', exact: true }).click();
  await expect.poll(async () => (await state(page)).writes.length).toBe(1);
  const saved = (await state(page)).writes[0];
  expect(saved.path).toBe(projectPath);
  const parsed = JSON.parse(saved.text) as Project;
  expect(parsed.version).toBe(1);
  expect(parsed.source).toMatchObject({ path, name: 'clip.webm', size: clip.length });
  await page.getByLabel('Playback speed').selectOption('1.5');
  await expect.poll(async () => (await state(page)).recoveries.some((item) => JSON.parse(item.text).speed === 1.5), { timeout: 5000 }).toBe(true);
  await expect.poll(async () => (await state(page)).writes.some((item) => JSON.parse(item.text).speed === 1.5), { timeout: 5000 }).toBe(true);
  const beforeSaveAs = (await state(page)).writes.length;
  await page.getByRole('button', { name: 'Save project as', exact: true }).click();
  await expect.poll(async () => (await state(page)).writes.length).toBe(beforeSaveAs + 1);
});

test('cancelled save leaves the session available for another attempt', async ({ page }) => {
  await setup(page, { cancelSave: true });
  await page.locator('.open-button').click();
  await expect(page.locator('.filename')).toHaveText('clip.webm');
  await openProjectMenu(page);
  await page.getByRole('button', { name: 'Save project', exact: true }).click();
  expect((await state(page)).writes).toEqual([]);
  await page.evaluate(() => { (window as unknown as { __projectTest: { cancelSave: boolean } }).__projectTest.cancelSave = false; });
  await page.getByRole('button', { name: 'Save project', exact: true }).click();
  await expect.poll(async () => (await state(page)).writes.length).toBe(1);
});

test('a failed project write reports the failure and can be retried', async ({ page }) => {
  await setup(page, { failWrite: true });
  await page.locator('.open-button').click();
  await expect(page.locator('.filename')).toHaveText('clip.webm');
  await openProjectMenu(page);
  await page.getByRole('button', { name: 'Save project', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Disk is full');
  expect((await state(page)).writes).toEqual([]);
  await page.evaluate(() => { (window as unknown as { __projectTest: { failWrite: boolean } }).__projectTest.failWrite = false; });
  await page.getByRole('button', { name: 'Save project', exact: true }).click();
  await expect.poll(async () => (await state(page)).writes.length).toBe(1);
});

test('a missing source can be located while retaining project edits', async ({ page }) => {
  await setup(page, { text: JSON.stringify(project(clip.length)), missing: true });
  await openProjectMenu(page);
  await page.getByRole('button', { name: 'Open project', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Locate source', exact: true })).toBeVisible();
  await page.evaluate(() => { (window as unknown as { __projectTest: { missing: boolean } }).__projectTest.missing = false; });
  await page.getByRole('button', { name: 'Locate source', exact: true }).click();
  await expect(page.locator('.filename')).toHaveText('clip.webm');
  await expect(page.getByRole('status', { name: 'Edit summary' })).toContainText('1 removed region');
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
});

test('startup recovery restores the interrupted edit session', async ({ page }) => {
  await setup(page, { recovery: JSON.stringify(project(clip.length)) });
  await expect(page.getByText('An interrupted editing session is available.')).toBeVisible();
  await page.getByRole('button', { name: 'Recover', exact: true }).click();
  await expect(page.locator('.filename')).toHaveText('clip.webm');
  await expect(page.getByRole('status', { name: 'Edit summary' })).toContainText('1 removed region');
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
});

test('autosave queues a newer edit while a project write is in flight', async ({ page }) => {
  await setup(page);
  await page.locator('.open-button').click();
  await expect(page.locator('.filename')).toHaveText('clip.webm');
  await openProjectMenu(page);
  await page.getByRole('button', { name: 'Save project', exact: true }).click();
  await expect.poll(async () => (await state(page)).writes.length).toBe(1);
  await page.evaluate(() => { (window as unknown as { __projectTest: { holdWrite: boolean } }).__projectTest.holdWrite = true; });
  await page.getByLabel('Playback speed').selectOption('1.5');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __projectTest: { writeInFlight: boolean } }).__projectTest.writeInFlight), { timeout: 5000 }).toBe(true);
  await page.getByLabel('Playback speed').selectOption('2');
  await page.waitForTimeout(900); // Allow the 750 ms debounce to enqueue behind the held write.
  await page.evaluate(() => {
    const testState = (window as unknown as { __projectTest: { holdWrite: boolean; releaseWrite: null | (() => void) } }).__projectTest;
    testState.holdWrite = false;
    testState.releaseWrite?.();
  });
  await expect.poll(async () => (await state(page)).writes.length, { timeout: 5000 }).toBe(3);
  const writes = (await state(page)).writes.map((item) => JSON.parse(item.text) as Project);
  expect(writes.map((item) => item.speed)).toEqual([1, 1.5, 2]);
});

test('cancelling a source mismatch leaves the current session intact', async ({ page }) => {
  const mismatched = project(clip.length + 1);
  await setup(page, { text: JSON.stringify(mismatched) });
  await openProjectMenu(page);
  await page.getByRole('button', { name: 'Open project', exact: true }).click();
  await expect(page.getByText('This source differs in size or duration. Use it with the saved cut timings?')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A space for your video' })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Edit summary' })).toContainText('0 removed regions');
});


test('audio analysis survives an unavailable native read command', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    Object.assign(window.__UNSAID_STORAGE__!, {
      readMedia: async () => { throw new Error('Command read_media not found'); },
    });
  });
  await page.locator('.open-button').click();
  await expect(page.locator('canvas[aria-label="Audio waveform"]')).toBeVisible();
  await expect(page.locator('canvas[aria-label="Audio frequency spectrum"]')).toBeVisible();
  await expect(page.locator('[aria-label="Video thumbnails"] img')).toHaveCount(8);
});
