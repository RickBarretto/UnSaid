<script lang="ts">
  import { onDestroy } from 'svelte';

  let video = $state<HTMLVideoElement>();
  let picker: HTMLInputElement;
  let url = $state('');
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
  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];

  function openFile(file?: File) {
    if (!file) return;
    if (file.type && !file.type.startsWith('video/') && !/\.(mp4|m4v|mov|webm|mkv|avi|ogv|ogg)$/i.test(file.name)) {
      error = 'Choose a video file, such as MP4, WebM, or MOV.';
      return;
    }
    video?.pause();
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(file);
    filename = file.name;
    playing = false;
    loading = true;
    ready = false;
    duration = 0;
    position = 0;
    speed = 1;
    error = '';
  }

  function selected(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    openFile(input.files?.[0]);
    input.value = '';
  }

  function drop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    dragging = false;
    openFile(event.dataTransfer?.files[0]);
  }

  async function togglePlayback() {
    if (!video || !ready) return;
    if (!video.paused) {
      video.pause();
      return;
    }
    const element = video;
    const source = url;
    if (element.ended) element.currentTime = 0;
    try {
      await element.play();
    } catch (cause) {
      if (disposed || source !== url || element !== video ||
        (cause instanceof DOMException && cause.name === 'AbortError')) return;
      loading = false;
      playing = false;
      error = 'This video could not start. Try another file or a different browser-supported format.';
    }
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
        break;
      case 'durationchange':
        duration = Number.isFinite(element.duration) ? element.duration : 0;
        break;
      case 'timeupdate':
        position = element.currentTime || 0;
        break;
      case 'canplay':
        loading = false;
        break;
      case 'waiting':
        if (ready && !element.error) loading = true;
        break;
      case 'playing':
        loading = false;
        error = '';
        playing = true;
        break;
      case 'play':
        playing = true;
        break;
      case 'pause':
      case 'ended':
        playing = false;
        loading = false;
        break;
      case 'error':
        loading = false;
        playing = false;
        ready = false;
        error = element.error?.code === 3
          ? 'This video could not be decoded. Try an MP4 with H.264 video and AAC audio, or WebM.'
          : 'This video format or codec is not supported here. Try an MP4 with H.264 video and AAC audio, or WebM.';
        break;
    }
  }

  function seek(event: Event) {
    if (video && ready) {
      const next = Number((event.currentTarget as HTMLInputElement).value);
      video.currentTime = next;
      position = next;
    }
  }

  function changeSpeed(event: Event) {
    speed = Number((event.currentTarget as HTMLSelectElement).value);
    if (video) video.playbackRate = speed;
  }

  function keydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (event.code !== 'Space' || event.repeat || event.altKey || event.ctrlKey || event.metaKey ||
      target?.closest('input, select, textarea, button, [contenteditable="true"]')) return;
    if (ready) {
      event.preventDefault();
      void togglePlayback();
    }
  }

  function time(seconds: number) {
    const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
    const minutes = Math.floor(value / 60);
    return value >= 3600
      ? `${Math.floor(value / 3600)}:${String(minutes % 60).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
      : `${String(minutes).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  }

  onDestroy(() => {
    disposed = true;
    video?.pause();
    if (url) URL.revokeObjectURL(url);
  });
</script>

<svelte:window onkeydown={keydown} ondragover={(event) => event.preventDefault()} ondrop={drop} />

<main>
  <header>
    <div class="brand">
      <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
      UnSaid
    </div>
    <span class="filename" title={filename}>{filename || 'Your local video workspace'}</span>
    <input class="file-input" tabindex="-1" bind:this={picker} type="file" accept="video/*,.mkv,.mov,.avi,.m4v" onchange={selected} aria-label="Choose a local video" />
    <button class="primary open-button" onclick={() => picker.click()}><span aria-hidden="true">＋</span> {url ? 'Replace video' : 'Open video'}</button>
  </header>

  <section class:dragging class:has-video={!!url} class="preview" aria-label="Video preview"
    ondragenter={(event) => { event.preventDefault(); dragging = true; }}
    ondragover={(event) => { event.preventDefault(); dragging = true; }}
    ondragleave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) dragging = false; }}
    ondrop={drop}>
    {#if url}
      {#key url}
        <!-- svelte-ignore a11y_media_has_caption (Local files do not supply caption tracks.) -->
        <video bind:this={video} src={url} preload="metadata" playsinline
          onloadedmetadata={mediaEvent} oncanplay={mediaEvent}
          onwaiting={mediaEvent} onplaying={mediaEvent}
          onplay={mediaEvent} onpause={mediaEvent}
          onended={mediaEvent} onerror={mediaEvent}
          ontimeupdate={mediaEvent} ondurationchange={mediaEvent}>
        </video>
      {/key}
      {#if loading}<div class="loading" role="status">Loading video…</div>{/if}
    {:else}
      <div class="empty-state">
        <div class="video-icon" aria-hidden="true">▷</div>
        <h1>{dragging ? 'Drop to open your video' : 'A space for your video'}</h1>
        <p>Drop a video here, or choose one from your computer.</p>
        <button class="primary" onclick={() => picker.click()}>Open video</button>
        <span class="privacy">Local playback. No uploads.</span>
      </div>
    {/if}
    {#if dragging && url}<div class="drop-overlay">Drop to replace your video</div>{/if}
  </section>

  {#if error}<div class="error" role="alert"><span>{error}</span><button onclick={() => picker.click()}>Choose another video</button></div>{/if}

  <section class="transport" aria-label="Playback controls">
    <div class="control-row">
      <button class="primary play-button" disabled={!ready} onclick={togglePlayback} aria-label={playing ? 'Pause video' : 'Play video'}>
        <span aria-hidden="true">{playing ? 'Ⅱ' : '▶'}</span> {playing ? 'Pause' : 'Play'}
      </button>
      <span class="time" aria-label={`Elapsed ${time(position)}, total ${time(duration)}`}>{time(position)} <span>/</span> {time(duration)}</span>
      <label class="speed"><span>Speed</span><select aria-label="Playback speed" value={speed} onchange={changeSpeed} disabled={!ready}>{#each speeds as value}<option value={value}>{value}×</option>{/each}</select></label>
    </div>
    <input class="seek" type="range" min="0" max={duration || 1} step="0.01" value={position} oninput={seek} disabled={!ready || !duration} aria-label="Seek video" aria-valuetext={`${time(position)} of ${time(duration)}`} style={`--progress: ${duration ? position / duration * 100 : 0}%`} />
    <div class="control-footer"><span>{url ? 'Your original file stays untouched.' : 'Open a video to get started.'}</span><span class="keyboard-hint">Space to play / pause</span></div>
  </section>
</main>
