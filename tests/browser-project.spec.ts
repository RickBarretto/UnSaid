import { expect, test, type Page } from '@playwright/test';

let clip: Buffer;

// Encode a real, short video with audio in Chromium; no media binaries or injected storage.
test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto('/');
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 36;
    const drawing = canvas.getContext('2d')!;
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
    const complete = new Promise<Blob>((resolve) => { recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' })); });
    const paint = setInterval(() => {
      drawing.fillStyle = drawing.fillStyle === '#8421aa' ? '#21aa84' : '#8421aa';
      drawing.fillRect(0, 0, 64, 36);
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
  clip = Buffer.from(bytes);
  await page.close();
});

async function importClip(page: Page) {
  await page.getByLabel('Choose a local video').setInputFiles({
    name: 'browser clip.webm', mimeType: 'video/webm', buffer: clip,
  });
  await expect(page.getByRole('button', { name: 'Play video', exact: true })).toBeEnabled();
  await expect(page.locator('canvas[aria-label="Audio waveform"]')).toBeVisible();
  await expect(page.locator('canvas[aria-label="Audio frequency spectrum"]')).toBeVisible();
  await expect(page.locator('[aria-label="Video thumbnails"] img')).toHaveCount(8);
}

async function cutRegion(page: Page) {
  const rail = page.getByRole('group', { name: 'Drag across source timeline to select a region' });
  await rail.scrollIntoViewIfNeeded();
  const bounds = (await rail.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width * 0.1, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.9, bounds.y + bounds.height / 2, { steps: 8 });
  await page.mouse.up();
  const start = page.getByRole('spinbutton', { name: /^Selection start/ });
  const end = page.getByRole('spinbutton', { name: /^Selection end/ });
  await start.fill('0');
  await start.press('Tab');
  await end.fill('0.7');
  await end.press('Tab');
  await start.fill('0.3');
  await start.press('Tab');
  await page.getByRole('button', { name: 'Remove selection', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Removed regions' })).toContainText('0.300–0.700');
}

async function openMenu(page: Page) {
  const menu = page.locator('details.project-menu');
  if (!(await menu.evaluate((element) => (element as HTMLDetailsElement).open))) await menu.locator('summary').click();
}

async function downloadProject(page: Page, shortcut = false) {
  page.once('dialog', (dialog) => void dialog.accept('browser-project.unsaid.json'));
  const downloading = page.waitForEvent('download');
  if (shortcut) {
    await page.locator('main').click({ position: { x: 10, y: 10 } });
    await page.keyboard.press('Control+s');
  } else {
    await page.getByRole('button', { name: 'Save project', exact: true }).click();
  }
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/\.unsaid\.json$/);
  const chunks: Buffer[] = [];
  for await (const chunk of await download.createReadStream()) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
    version: number;
    edits: { cuts: { start: number; end: number }[]; past: unknown[] };
    speed: number;
    position: number;
    source: { path: string; name: string; size: number };
  };
}

test('browser Save downloads a project that reopens with media and edit history', async ({ page }) => {
  await page.goto('/');
  await importClip(page);
  await cutRegion(page);
  await page.getByLabel('Playback speed').selectOption('1.5');
  await openMenu(page);
  const saved = await downloadProject(page);
  expect(saved.version).toBe(1);
  expect(saved.source).toMatchObject({ name: 'browser clip.webm', size: clip.length });
  expect(saved.edits.cuts).toEqual([{ start: 0.3, end: 0.7 }]);
  expect(saved.edits.past).toHaveLength(1);
  expect(saved.speed).toBe(1.5);

  await page.reload();
  const recovery = page.getByRole('button', { name: 'Discard', exact: true });
  await expect(recovery).toBeVisible();
  await recovery.click();
  await openMenu(page);
  const fileChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open project', exact: true }).click();
  await (await fileChooser).setFiles({
    name: 'browser-project.unsaid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saved)),
  });
  await expect(page.locator('.filename')).toHaveText('browser clip.webm');
  await expect(page.getByRole('list', { name: 'Removed regions' })).toContainText('0.300–0.700');
  await expect(page.getByLabel('Playback speed')).toHaveValue('1.5');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Removed regions' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Removed regions' })).toContainText('0.300–0.700');
});

test('browser autosave recovers media, cuts, speed and playhead without a download', async ({ page }) => {
  await page.goto('/');
  let downloads = 0;
  page.on('download', () => downloads++);
  await importClip(page);
  await cutRegion(page);
  await page.getByLabel('Playback speed').selectOption('1.5');
  await page.getByRole('slider', { name: 'Seek video' }).evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = '1';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect.poll(() => page.locator('video').evaluate((video: HTMLVideoElement) => video.currentTime)).toBeCloseTo(1.4, 1);
  await page.waitForTimeout(1200); // Autosave is debounced by 750 ms.
  expect(downloads).toBe(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Recover', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Recover', exact: true }).click();
  await expect(page.locator('.filename')).toHaveText('browser clip.webm');
  await expect(page.getByRole('list', { name: 'Removed regions' })).toContainText('0.300–0.700');
  await expect(page.getByLabel('Playback speed')).toHaveValue('1.5');
  await expect.poll(() => page.locator('video').evaluate((video: HTMLVideoElement) => video.currentTime)).toBeCloseTo(1.4, 1);
  expect(downloads).toBe(0);
});

test('Ctrl+S downloads and Ctrl+O opens the project picker', async ({ page }) => {
  await page.goto('/');
  await importClip(page);
  await downloadProject(page, true);
  await page.locator('main').click({ position: { x: 10, y: 10 } });
  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press('Control+o');
  expect((await chooser).isMultiple()).toBe(false);
});

test('missing cached media can be relinked without losing edits', async ({ page }) => {
  await page.goto('/');
  await importClip(page);
  await cutRegion(page);
  await openMenu(page);
  const saved = await downloadProject(page);
  expect(saved.source.path).toMatch(/^browser:/);

  await page.reload();
  const discard = page.getByRole('button', { name: 'Discard', exact: true });
  await expect(discard).toBeVisible();
  await discard.click();
  await page.evaluate(async (key) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('unsaid-browser', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('files', 'readwrite');
        transaction.objectStore('files').delete(key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally { db.close(); }
  }, saved.source.path);

  await openMenu(page);
  const projectChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open project', exact: true }).click();
  await (await projectChooser).setFiles({
    name: 'browser-project.unsaid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saved)),
  });
  await expect(page.getByRole('button', { name: 'Locate source', exact: true })).toBeVisible();
  const mediaChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Locate source', exact: true }).click();
  await (await mediaChooser).setFiles({ name: 'browser clip.webm', mimeType: 'video/webm', buffer: clip });
  await expect(page.locator('.filename')).toHaveText('browser clip.webm');
  await expect(page.getByRole('list', { name: 'Removed regions' })).toContainText('0.300–0.700');
  await expect(page.locator('canvas[aria-label="Audio waveform"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();

  await openMenu(page);
  const relinked = await downloadProject(page);
  expect(relinked.source.path).toMatch(/^browser:/);
  expect(relinked.source.path).not.toBe(saved.source.path);
  expect(relinked.edits.cuts).toEqual(saved.edits.cuts);
});
