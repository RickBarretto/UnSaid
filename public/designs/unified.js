(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const video = $('video'), rail = $('signal'), tip = $('selection-tip');
  let duration = 102.8, selection = { start: 24.6, end: 26 }, position = 24.6;
  let cuts = [{ start: 13.364, end: 14.964 }, { start: 69.904, end: 71.504 }];
  let past = [[]], future = [], mode = 'original', sourceUrl = '', dragging = null;
  const copy = (value) => value.map((region) => ({ ...region }));
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const percent = (n) => `${n / duration * 100}%`;
  const clock = (n, precise = true) => {
    const ms = Math.round(Math.max(0, n) * 1000);
    const base = `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
    return precise ? `${base}.${String(ms % 1000).padStart(3, '0')}` : base;
  };
  function tell(message) { $('notice').textContent = message; }
  function theme(value) {
    document.documentElement.dataset.theme = value;
    $('theme').setAttribute('aria-label', value === 'light' ? 'Use dark mode' : 'Use light mode');
    $('theme-label').textContent = value === 'light' ? 'Dark' : 'Light';
    try { localStorage.setItem('unsaid-prototype-theme', value); } catch {}
    draw();
  }
  $('theme').onclick = () => theme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  function draw() {
    const preview = document.querySelector('.preview');
    if (video.videoWidth && video.videoHeight) {
      const fittedHeight = Math.min(preview.clientHeight, preview.clientWidth * video.videoHeight / video.videoWidth);
      const frameBottom = (preview.clientHeight + fittedHeight) / 2;
      preview.style.setProperty('--fade-start', `${Math.max(0, frameBottom - Math.min(fittedHeight * .65, 360))}px`);
      preview.style.setProperty('--fade-end', `${Math.max(0, frameBottom - 2)}px`);
    }
    const width = Math.max(1, rail.clientWidth), height = Math.max(1, rail.clientHeight);
    const dpr = devicePixelRatio || 1;
    const wave = $('wave'), spectrum = $('spectrum-canvas');
    for (const canvas of [wave, spectrum]) {
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
      if (canvas === wave) {
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--wave');
        for (let x = 0; x < width; x += 4) {
          const t = x / width * 200;
          const amplitude = .04 + Math.abs(Math.sin(t * .37) * Math.cos(t * .11)) * .84;
          const h = amplitude * height;
          ctx.fillRect(x, (height - h) / 2, 2, Math.max(1, h));
        }
      } else {
        const dark = document.documentElement.dataset.theme === 'dark';
        ctx.fillStyle = dark ? '#27282a' : '#e7ded1'; ctx.fillRect(0, 0, width, height);
        for (let x = 0; x < width; x += 4) {
          for (let y = 0; y < height; y += 4) {
            const energy = Math.abs(Math.sin(x / width * 74) * Math.cos(x / width * 22)) * Math.pow(y / height, .6);
            ctx.fillStyle = `rgba(${dark ? '209,176,128' : '140,87,57'},${energy * .8})`;
            ctx.fillRect(x, y, 4, 4);
          }
        }
      }
    }
  }
  function placeTip() {
    if (!selection) return;
    const bounds = rail.getBoundingClientRect();
    const midpoint = (selection.start + selection.end) / 2 / duration * bounds.width;
    const half = tip.offsetWidth / 2;
    const center = clamp(midpoint, half, bounds.width - half);
    tip.style.left = `${center}px`;
    tip.style.setProperty('--pointer', `${clamp(midpoint - center + half, 7, tip.offsetWidth - 7)}px`);
  }
  function render() {
    $('selection').hidden = tip.hidden = !selection;
    if (selection) {
      $('selection').style.left = percent(selection.start);
      $('selection').style.width = percent(selection.end - selection.start);
      $('start').value = selection.start.toFixed(3); $('end').value = selection.end.toFixed(3);
      $('start').max = duration; $('end').max = duration;
      $('selection-duration').textContent = `${(selection.end - selection.start).toFixed(3)} s`;
      placeTip();
    }
    $('playhead').style.left = percent(position);
    $('time').textContent = clock(position);
    $('duration').textContent = clock(duration);
    $('cuts').replaceChildren(...cuts.map((region) => {
      const el = document.createElement('div'); el.className = 'cut';
      el.style.left = percent(region.start); el.style.width = percent(region.end - region.start); return el;
    }));
    $('cut-summary').textContent = `${cuts.length} ${cuts.length === 1 ? 'cut' : 'cuts'} · ${cuts.reduce((sum, region) => sum + region.end - region.start, 0).toFixed(2)} s removed`;
    $('undo').disabled = !past.length; $('redo').disabled = !future.length;
    document.querySelector('[data-mode="selected"]').disabled = !selection;
  }
  function ruler() {
    const nodes = [];
    for (let i = 0; i <= 10; i++) {
      const el = document.createElement('span'); const at = i / 10 * duration;
      el.textContent = duration < 10 ? `${at.toFixed(duration < 1 ? 2 : 1)} s` : clock(at, false); el.style.left = `${i * 10}%`; nodes.push(el);
    }
    $('ruler').replaceChildren(...nodes);
  }
  function editCuts(next) { past.push(copy(cuts)); future = []; cuts = next; render(); }
  $('remove').onclick = () => {
    if (!selection) return;
    const merged = [];
    for (const region of [...copy(cuts), { ...selection }].sort((a, b) => a.start - b.start)) {
      const last = merged.at(-1);
      if (last && region.start <= last.end) last.end = Math.max(last.end, region.end); else merged.push(region);
    }
    editCuts(merged); tell('Demo cut added · source unchanged');
  };
  $('keep').onclick = () => {
    if (!selection) return;
    const next = cuts.flatMap((region) => {
      if (region.end <= selection.start || region.start >= selection.end) return [{ ...region }];
      const parts = [];
      if (region.start < selection.start) parts.push({ start: region.start, end: selection.start });
      if (region.end > selection.end) parts.push({ start: selection.end, end: region.end });
      return parts;
    });
    editCuts(next); tell('Selected demo region kept');
  };
  function history(direction) {
    const from = direction === 'undo' ? past : future, to = direction === 'undo' ? future : past;
    if (!from.length) return;
    to.push(copy(cuts)); cuts = from.pop(); render();
  }
  $('undo').onclick = () => history('undo'); $('redo').onclick = () => history('redo');
  function setMode(next) {
    if (next === 'selected' && !selection) return;
    mode = next;
    document.querySelectorAll('[data-mode]').forEach((button) => {
      button.classList.toggle('active', button.dataset.mode === mode);
      button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
    });
    if (sourceUrl && mode === 'selected' && selection) { video.currentTime = selection.start; position = selection.start; }
    render();
  }
  document.querySelectorAll('[data-mode]').forEach((button) => button.onclick = () => setMode(button.dataset.mode));
  function deselect() { selection = null; if (mode === 'selected') setMode('original'); render(); }
  $('deselect').onclick = deselect;
  for (const edge of ['start', 'end']) {
    $(edge).onchange = () => {
      if (!selection) return;
      const next = Number($(edge).value);
      if ($(edge).value === '' || !Number.isFinite(next) || next < 0 || next > duration || (edge === 'start' ? next >= selection.end : next <= selection.start)) {
        tell('Use start < end, within the recording.'); render(); return;
      }
      selection = { ...selection, [edge]: next }; render();
    };
    $(`handle-${edge}`).onkeydown = (event) => {
      if (!selection || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const step = (event.shiftKey ? .1 : .01) * (event.key === 'ArrowLeft' ? -1 : 1);
      selection[edge] = edge === 'start' ? clamp(selection.start + step, 0, selection.end - .01) : clamp(selection.end + step, selection.start + .01, duration);
      render();
    };
  }
  function at(clientX) { const b = rail.getBoundingClientRect(); return clamp((clientX - b.left) / b.width * duration, 0, duration); }
  rail.onpointerdown = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const edge = event.target.id === 'handle-start' ? 'start' : event.target.id === 'handle-end' ? 'end' : null;
    dragging = { pointer: event.pointerId, edge, anchor: at(event.clientX), base: selection && { ...selection } };
    rail.setPointerCapture(event.pointerId);
    if (!edge) {
      const start = Math.min(at(event.clientX), duration - .01);
      selection = { start, end: Math.min(duration, start + .01) }; position = start;
    }
    render();
  };
  function move(event) {
    if (!dragging || event.pointerId !== dragging.pointer) return;
    const value = at(event.clientX), { edge, anchor, base } = dragging;
    if (edge && base) selection = edge === 'start' ? { start: Math.min(value, base.end - .01), end: base.end } : { start: base.start, end: Math.max(value, base.start + .01) };
    else {
      const start = Math.min(anchor, value, duration - .01);
      selection = { start, end: Math.max(start + .01, anchor, value) }; position = selection.start;
    }
    render();
  }
  rail.onpointermove = move;
  rail.onpointerup = (event) => {
    move(event); dragging = null;
    if (rail.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId);
    if (sourceUrl && selection) video.currentTime = selection.start;
  };
  rail.onpointercancel = () => { dragging = null; };
  rail.onlostpointercapture = () => { dragging = null; };
  function display(showSpectrum) {
    $('spectrum-canvas').hidden = !showSpectrum; $('wave').hidden = showSpectrum;
    for (const [id, active] of [['spectrum', showSpectrum], ['waveform', !showSpectrum]]) {
      $(id).classList.toggle('active', active); $(id).setAttribute('aria-pressed', String(active));
    }
    draw();
  }
  $('waveform').onclick = () => display(false); $('spectrum').onclick = () => display(true);
  $('fit').onclick = () => { ruler(); draw(); placeTip(); tell('Full recording · illustrative waveform'); };
  $('open').onclick = $('open-video').onclick = () => $('file').click();
  $('file').onchange = () => {
    const file = $('file').files[0]; if (!file) return;
    video.pause(); video.removeAttribute('src'); video.load();
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    sourceUrl = URL.createObjectURL(file); video.src = sourceUrl; video.load();
    $('filename').textContent = file.name; $('filename').title = file.name;
    $('play').disabled = true; $('empty').hidden = true;
    tell('Loading local video…'); $('file').value = '';
  };
  video.onloadedmetadata = () => {
    if (!Number.isFinite(video.duration) || video.duration <= 0) { tell('Cannot read video duration. Try another file.'); return; }
    duration = video.duration; position = 0; selection = null; cuts = []; past = []; future = [];
    video.playbackRate = Number($('speed').value); setMode('original');
    $('play').disabled = false; $('play').title = 'Play / pause (Space)';
    ruler(); render(); draw(); tell('Local video · illustrative waveform');
  };
  video.onerror = () => { $('play').disabled = true; $('empty').hidden = false; tell('Video could not open. Choose a supported local video.'); };
  async function togglePlayback() {
    if (!sourceUrl || $('play').disabled) return;
    if (!video.paused) { video.pause(); return; }
    if (mode === 'selected' && selection && (video.currentTime < selection.start || video.currentTime >= selection.end)) video.currentTime = selection.start;
    try { await video.play(); } catch { tell('Playback failed. Try a different local video.'); }
  }
  $('play').onclick = togglePlayback;
  const playbackState = () => {
    const playing = !video.paused;
    $('play-icon').src = `../icons/player-${playing ? 'pause' : 'play'}.svg`;
    $('play').setAttribute('aria-label', playing ? 'Pause video' : 'Play video');
  };
  video.onplay = video.onpause = video.onended = playbackState;
  video.ontimeupdate = () => {
    if (!video.paused) {
      if (mode === 'selected' && selection && video.currentTime >= selection.end) { video.pause(); video.currentTime = selection.start; }
      if (mode === 'edited') {
        const cut = cuts.find((region) => video.currentTime >= region.start && video.currentTime < region.end);
        if (cut) video.currentTime = cut.end;
      }
    }
    position = video.currentTime; $('playhead').style.left = percent(position); $('time').textContent = clock(position);
  };
  $('speed').onchange = () => { video.playbackRate = Number($('speed').value); };
  window.onkeydown = (event) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); history(event.shiftKey ? 'redo' : 'undo'); }
    else if (event.key === 'Escape') deselect();
    else if (event.code === 'Space' && !['BUTTON', 'A'].includes(event.target.tagName)) { event.preventDefault(); togglePlayback(); }
  };
  new ResizeObserver(() => { draw(); placeTip(); }).observe(rail);
  window.addEventListener('pagehide', () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); });
  let initialTheme = 'light'; try { initialTheme = localStorage.getItem('unsaid-prototype-theme') || 'light'; } catch {}
  theme(initialTheme === 'dark' ? 'dark' : 'light'); ruler(); render();
})();
