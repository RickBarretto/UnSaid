<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  type Region = { start: number; end: number };
  let { duration, position, selection, cuts, disabled = false, onselect, analysis = null, thumbnails = [], analysisStatus = '', controls }: {
    duration: number;
    position: number;
    selection: Region | null;
    cuts: Region[];
    disabled?: boolean;
    onselect: (region: Region) => void;
    analysis?: { peaks: Float32Array; spectrum: Uint8Array; columns: number; bins: number } | null;
    thumbnails?: string[];
    analysisStatus?: string;
    controls?: Snippet;
  } = $props();

  let rail: HTMLDivElement;
  let waveform = $state<HTMLCanvasElement>();
  let spectrogram = $state<HTMLCanvasElement>();
  let zoom = $state(1);
  let showSpectrum = $state(true);
  let revision = $state(0);
  const length = $derived(Number.isFinite(duration) ? Math.max(0, duration) : 0);
  const span = $derived(length / zoom);
  const viewStart = $derived(Math.max(0, Math.min(length - span, position - span / 2)));
  const viewEnd = $derived(viewStart + span);
  const visibleThumbnails = $derived(thumbnails.filter((_, index) => {
    const at = (index + 0.5) / thumbnails.length * length;
    return at >= viewStart && at <= viewEnd;
  }));

  function draw() {
    if (!analysis || !waveform) return;
    const width = Math.max(1, Math.floor(rail.clientWidth));
    waveform.width = width;
    waveform.height = 100;
    const context = waveform.getContext('2d');
    if (context) {
      context.clearRect(0, 0, width, 100);
      context.fillStyle = '#9677ed';
      for (let x = 0; x < width; x++) {
        const from = Math.floor((viewStart + x / width * span) / length * analysis.peaks.length);
        const to = Math.max(from + 1, Math.ceil((viewStart + (x + 1) / width * span) / length * analysis.peaks.length));
        let peak = 0;
        for (let index = from; index < Math.min(to, analysis.peaks.length); index++) peak = Math.max(peak, Math.abs(analysis.peaks[index]));
        const height = Math.min(1, peak) * 90;
        context.fillRect(x, 50 - height / 2, 1, Math.max(1, height));
      }
    }
    if (!spectrogram || !showSpectrum) return;
    spectrogram.width = width;
    spectrogram.height = 60;
    const spectrumContext = spectrogram.getContext('2d');
    if (!spectrumContext) return;
    const pixels = spectrumContext.createImageData(width, 60);
    for (let x = 0; x < width; x++) {
      const column = Math.min(analysis.columns - 1, Math.floor((viewStart + x / width * span) / length * analysis.columns));
      for (let y = 0; y < 60; y++) {
        const bin = Math.min(analysis.bins - 1, Math.floor((59 - y) / 60 * analysis.bins));
        const intensity = (analysis.spectrum[column * analysis.bins + bin] ?? 0) / 255;
        const offset = (y * width + x) * 4;
        pixels.data[offset] = 55 + intensity * 200;
        pixels.data[offset + 1] = 30 + intensity * 135;
        pixels.data[offset + 2] = 110 + intensity * 105;
        pixels.data[offset + 3] = 255;
      }
    }
    spectrumContext.putImageData(pixels, 0, 0);
  }
  onMount(() => {
    const observer = new ResizeObserver(() => revision++);
    observer.observe(rail);
    return () => observer.disconnect();
  });
  $effect(() => {
    analysis; viewStart; span; showSpectrum; revision;
    const frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  });
  let drag = $state<{ pointer: number; anchor: number; edge: 'start' | 'end' | null; base: Region | null } | null>(null);
  let draft = $state<Region | null>(null);
  const inactive = $derived(disabled || length <= 0);
  const shown = $derived(draft ?? selection);
  const minimum = $derived(Math.min(0.01, length));
  const fractions = [0, 0.25, 0.5, 0.75, 1];

  function clamp(value: number) {
    return Math.max(0, Math.min(length, value));
  }

  function percent(value: number) {
    return span ? Math.max(0, Math.min(100, (value - viewStart) / span * 100)) : 0;
  }

  function at(clientX: number) {
    const bounds = rail.getBoundingClientRect();
    return bounds.width > 0 ? clamp(viewStart + (clientX - bounds.left) / bounds.width * span) : 0;
  }

  function emit(region: Region) {
    const next = { start: clamp(region.start), end: clamp(region.end) };
    if (Number.isFinite(next.start) && Number.isFinite(next.end) && next.end > next.start) {
      draft = next;
      onselect(next);
    }
  }

  function begin(event: PointerEvent, edge: 'start' | 'end' | null = null) {
    if (inactive || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    drag = { pointer: event.pointerId, anchor: at(event.clientX), edge, base: selection ? { ...selection } : null };
    draft = edge && selection ? { ...selection } : null;
    rail.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.pointer || inactive) return;
    const value = at(event.clientX);
    if (drag.edge && drag.base) {
      emit(drag.edge === 'start'
        ? { start: Math.min(value, drag.base.end - minimum), end: drag.base.end }
        : { start: drag.base.start, end: Math.max(value, drag.base.start + minimum) });
    } else {
      emit({ start: Math.min(drag.anchor, value), end: Math.max(drag.anchor, value) });
    }
  }

  function finish(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.pointer) return;
    if (event.type === 'pointerup') move(event);
    const pointer = drag.pointer;
    drag = null;
    draft = null;
    if (rail.hasPointerCapture(pointer)) rail.releasePointerCapture(pointer);
  }

  function edit(event: Event, edge: 'start' | 'end') {
    const input = event.currentTarget as HTMLInputElement;
    if (inactive || !selection) return;
    const value = input.valueAsNumber;
    if (!Number.isFinite(value) || value < 0 || value > length ||
      (edge === 'start' ? value >= selection.end : value <= selection.start)) {
      input.value = selection[edge].toFixed(2);
      return;
    }
    onselect({ ...selection, [edge]: value });
  }

  function nudge(event: KeyboardEvent, edge: 'start' | 'end') {
    if (inactive || !selection || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const value = selection[edge] + (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 0.1 : 0.01);
    onselect(edge === 'start'
      ? { start: clamp(Math.min(value, selection.end - minimum)), end: selection.end }
      : { start: selection.start, end: clamp(Math.max(value, selection.start + minimum)) });
  }
</script>

<section class="timeline" aria-label="Region selection">
  <div class="heading"><strong>Source timeline</strong>
    <div class="display-controls"><button aria-label="Show waveform" class:active={!showSpectrum} onclick={() => showSpectrum = false}>Waveform</button><button aria-label="Show waveform and spectrum" class:active={showSpectrum} onclick={() => showSpectrum = true}>Spectrum</button></div>
    <div class="zoom-controls"><button aria-label="Zoom out timeline" disabled={zoom <= 1} onclick={() => zoom = Math.max(1, zoom / 2)}>−</button><span>{zoom}×</span><button aria-label="Zoom in timeline" disabled={zoom >= 16 || inactive} onclick={() => zoom = Math.min(16, zoom * 2)}>+</button></div>
    {#if controls}<div class="timeline-controls">{@render controls()}</div>{/if}
    <span class="duration">{length.toFixed(2)} s</span></div>
  <div class="track-area">
    <div class="ruler" aria-hidden="true">
      {#each fractions as fraction}<span style={`left:${fraction * 100}%`}>{(viewStart + span * fraction).toFixed(2)}</span>{/each}
    </div>
    <div bind:this={rail} class="rail" class:inactive role="group" aria-label="Drag across source timeline to select a region"
      onpointerdown={(event) => begin(event)} onpointermove={move}
      onpointerup={finish} onpointercancel={finish} onlostpointercapture={finish}>
      {#if analysis}<canvas bind:this={waveform} class="waveform" aria-label="Audio waveform"></canvas>{:else}<span class="analysis-empty">{analysisStatus || 'Open a video to view its audio data.'}</span>{/if}
      {#each cuts.filter(cut => cut.end > viewStart && cut.start < viewEnd) as cut}
        <div class="cut" style={`left:${percent(cut.start)}%;width:${Math.max(0, percent(cut.end) - percent(cut.start))}%`} title={`Removed ${cut.start.toFixed(2)}–${cut.end.toFixed(2)} seconds`} aria-hidden="true"></div>
      {/each}
      {#if shown}
        <div class="selected" style={`left:${percent(shown.start)}%;width:${Math.max(0, percent(shown.end) - percent(shown.start))}%`} aria-hidden="true"></div>
        {#each ['start', 'end'] as edge}
          {@const boundary = edge as 'start' | 'end'}
          {#if shown[boundary] >= viewStart && shown[boundary] <= viewEnd}
          <button class="handle" role="slider" aria-label={`Selection ${boundary}`} disabled={inactive}
            aria-valuemin={boundary === 'start' ? 0 : shown.start}
            aria-valuemax={boundary === 'start' ? shown.end : length}
            aria-valuenow={shown[boundary]} aria-valuetext={`${shown[boundary].toFixed(2)} seconds`}
            style={`left:${percent(shown[boundary])}%`}
            onpointerdown={(event) => begin(event, boundary)} onkeydown={(event) => nudge(event, boundary)}><span></span></button>
          {/if}
        {/each}
      {/if}
      <div class="playhead" style={`left:${percent(position)}%`} aria-hidden="true"></div>
    </div>
    {#if showSpectrum}
      {#if analysis}<canvas bind:this={spectrogram} class="spectrogram" aria-label="Audio frequency spectrum" onpointerdown={(event) => begin(event)}></canvas>
      {:else}<div class="spectrum-pending">{disabled ? 'Frequency spectrum' : 'Waiting for decoded audio data'}</div>{/if}
    {/if}
    <div class="thumbnails" aria-label="Video thumbnails">{#if visibleThumbnails.length}{#each visibleThumbnails as thumbnail}<img src={thumbnail} alt="" />{/each}{:else}<span>{disabled ? 'Video frames' : 'Preparing video frames…'}</span>{/if}</div>
  </div>
  <div class="selection-fields">
    <label>Selection start <span><input type="number" min="0" max={shown?.end ?? length} step="0.01" value={shown?.start.toFixed(2) ?? ''} disabled={inactive || !shown} onchange={(event) => edit(event, 'start')} /> s</span></label>
    <label>Selection end <span><input type="number" min={shown?.start ?? 0} max={length} step="0.01" value={shown?.end.toFixed(2) ?? ''} disabled={inactive || !shown} onchange={(event) => edit(event, 'end')} /> s</span></label>
    <p>{shown ? `${(shown.end - shown.start).toFixed(2)} s selected` : 'Drag across the timeline to select a region.'}</p>
  </div>

</section>

<style>
.timeline {
  color:#211936;
  min-width:0
}
.heading {
  display:flex;
  align-items:center;
  gap:14px;
  height:32px;
  font-size:12px;
  padding:0 12px
}
.heading strong {
  font-weight:500;
  color:#7b7192
}
.duration {
  margin-left:12px;
  color:#8a809d
}
.timeline-controls { display:flex; align-items:center; gap:12px; margin-left:auto; }
.display-controls,.zoom-controls {
  display:flex;
  align-items:center;
  gap:4px;
  padding:3px;
  background:#f1edfb;
  border-radius:20px;
  box-shadow:0 2px 6px #37255b12
}
.heading button {
  border:0;
  background:transparent;
  color:#6d54ba;
  font-size:12px;
  border-radius:15px;
  padding:5px 10px;
  cursor:pointer
}
.heading button.active {
  background:#e0d6ff;
  color:#5635d7
}
.zoom-controls span {
  min-width:30px;
  text-align:center;
  color:#897c9f
}
.zoom-controls button {
  font-size:17px;
  padding:1px 10px
}
.heading button:disabled {
  opacity:.4;
  cursor:default
}
.track-area {
  margin-top:8px;
  padding:0 8px
}
.ruler {
  height:25px;
  position:relative;
  color:#898099;
  font-size:11px;
  font-variant-numeric:tabular-nums;
  border-bottom:1px solid #eae4f5
}
.ruler span {
  position:absolute;
  transform:translateX(-50%)
}
.ruler span:first-child {
  transform:none
}
.ruler span:last-child {
  transform:translateX(-100%)
}
.ruler span:after {
  content:'';
  height:7px;
  width:1px;
  background:#d8ceeb;
  position:absolute;
  top:18px;
  left:50%
}
.rail {
  height:100px;
  position:relative;
  touch-action:none;
  cursor:crosshair;
  user-select:none;
  background:#f8f5ff
}
.rail.inactive {
  cursor:default
}
.waveform {
  width:100%;
  height:100px;
  display:block;
  pointer-events:none
}
.spectrogram {
  width:100%;
  height:60px;
  display:block;
  background:#42296d
}
.spectrum-pending { height:60px; display:grid; place-items:center; color:#9b8ead; font-size:11px; background:#f1eafa; }
.thumbnails>span { align-self:center; margin:auto; color:#9b8ead; font-size:11px; }
.analysis-empty {
  position:absolute;
  inset:0;
  display:grid;
  place-items:center;
  color:#9183a9;
  font-size:12px;
  pointer-events:none;
  text-align:center;
  padding:10px
}
.thumbnails {
  height:44px;
  display:flex;
  overflow:hidden;
  gap:2px;
  margin-top:8px
}
.thumbnails img {
  height:44px;
  min-width:0;
  flex:1;
  object-fit:cover;
  border-radius:5px
}
.cut,.selected {
  position:absolute;
  top:0;
  bottom:0;
  pointer-events:none
}
.cut {
  background:repeating-linear-gradient(135deg,#bd7b8533 0,#bd7b8533 5px,#bd7b8510 5px,#bd7b8510 10px);
  border-left:1px solid #bd7b8577;
  border-right:1px solid #bd7b8577
}
.selected {
  background:#8e73f12b;
  border:1px dashed #8967ef;
  border-radius:8px
}
.handle {
  position:absolute;
  top:16px;
  bottom:16px;
  width:12px;
  transform:translateX(-50%);
  padding:0;
  border:2px solid #9679e6;
  border-radius:5px;
  background:#f8f5ff;
  cursor:ew-resize;
  touch-action:none;
  z-index:2;
  display:grid;
  place-items:center
}
.handle span {
  width:1px;
  height:15px;
  background:#a38bdf
}
.handle:focus-visible {
  outline:3px solid #b5a3f7;
  outline-offset:3px
}
.handle:disabled {
  cursor:default
}
.playhead {
  position:absolute;
  top:-8px;
  bottom:-4px;
  width:2px;
  background:#6442db;
  pointer-events:none;
  z-index:3
}
.playhead:before {
  content:'';
  position:absolute;
  left:-3px;
  top:-3px;
  width:8px;
  height:8px;
  border-radius:50%;
  background:#6442db
}
.selection-fields {
  display:flex;
  align-items:center;
  flex-wrap:wrap;
  gap:14px;
  margin:10px 12px 0
}
.selection-fields label {
  display:flex;
  align-items:center;
  gap:7px;
  font-size:11px;
  color:#79718f
}
.selection-fields label>span {
  display:flex;
  align-items:center;
  gap:4px
}
.selection-fields input {
  width:85px;
  border:1px solid #e2d9f2;
  border-radius:8px;
  background:#fff9;
  color:#55416f;
  padding:5px 7px;
  font:inherit;
  font-size:12px;
  font-variant-numeric:tabular-nums
}
.selection-fields input:disabled {
  opacity:.5
}
.selection-fields input:focus-visible {
  outline:3px solid #b5a3f7;
  outline-offset:2px
}
.selection-fields p {
  margin:0 0 0 auto;
  font-size:11px;
  color:#8c7da3
}
@media(max-width:700px) {
  .timeline-controls { flex-wrap:wrap; margin-left:0; flex-basis:100%; }
  .heading {
    gap:5px;
    flex-wrap:wrap;
    height:auto
  }
  .heading strong {
    flex-basis:100%
  }
  .heading button {
    padding:4px 7px
  }
  .selection-fields {
    gap:8px
  }
  .selection-fields p {
    flex-basis:100%;
    margin:0
  }
  .ruler {
    font-size:10px
  }
  .handle {
    width:18px
  }
  .duration {
    display:none
  }
}
</style>
