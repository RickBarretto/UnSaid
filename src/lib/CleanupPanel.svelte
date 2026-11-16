<script lang="ts">
  type Region = { start: number; end: number };
  let { cuts, duration, onreview, onrestore }: { cuts: Region[]; duration: number; onreview?: () => void; onrestore?: (region: Region) => void } = $props();
  const removed = $derived(cuts.reduce((total, cut) => total + cut.end - cut.start, 0));
  const categories = ['Silences', 'Filler words', 'Hesitations', 'Repetitions', 'Coughs / sneezes', 'Mouth noises'];
  function time(seconds: number) {
    const value = Math.max(0, seconds);
    return `${Math.floor(value / 60)}:${(value % 60).toFixed(2).padStart(5, '0')}`;
  }
</script>

<aside class="cleanup-panel" aria-label="Cleanup">
  <div class="cleanup-heading"><h2><img src="/icons/sparkles.svg" alt="" />Cleanup</h2><button class="analyze" disabled title="Automatic analysis is not implemented">Analyze</button></div>
  <div class="manual-summary"><span>Manual cuts <strong>{cuts.length}</strong></span><span>{removed.toFixed(2)} s removed</span></div>
  <p class="edited-duration">Edited duration <strong>{time(Math.max(0, duration - removed))}</strong></p>
  <div class="categories" aria-label="Upcoming automatic cleanup">
    {#each categories as category, index}<label><input type="checkbox" disabled /><i style={`--dot:${['#b69bfa','#f1b49b','#c7b2f7','#9bd0b7','#dfa5be','#cfbead'][index]}`}></i><span>{category}</span><small>Coming soon</small></label>{/each}
  </div>
  {#if cuts.length}
    <ol class="manual-list" aria-label="Removed regions">
      {#each cuts as cut}
        <li><span>{cut.start.toFixed(3)}–{cut.end.toFixed(3)} s</span>{#if onrestore}<button class="restore" aria-label={`Restore cut ${cut.start.toFixed(3)}–${cut.end.toFixed(3)} seconds`} onclick={() => onrestore?.(cut)}>Restore</button>{/if}</li>
      {/each}
    </ol>
  {/if}
  <button class="review" disabled={!cuts.length || !onreview} onclick={() => onreview?.()}>Review {cuts.length} {cuts.length === 1 ? 'cut' : 'cuts'} <img src="/icons/chevron-right.svg" alt="" /></button>
</aside>

<style>
.cleanup-panel {
  height:100%;
  min-height:0;
  background:#fcfaffc9;
  border:1px solid #fff8;
  border-radius:30px;
  padding:20px;
  box-shadow:0 8px 21px #3620540e;
  display:flex;
  flex-direction:column;
  gap:13px;
  color:#272039;
  overflow:auto
}
@media(min-width:851px) { .cleanup-panel { max-height:400px; align-self:start; } }
.cleanup-panel>* { flex-shrink:0; }
.review img { width:20px; height:20px; margin-left:auto; filter:brightness(0) invert(1); }
.cleanup-heading {
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px
}
.cleanup-heading h2 {
  display:flex;
  align-items:center;
  gap:10px;
  font-size:18px;
  letter-spacing:-.4px;
  margin:0;
  font-weight:600
}
.cleanup-heading img {
  width:25px;
  height:25px;
  filter:invert(25%) sepia(92%) saturate(2800%) hue-rotate(244deg)
}
.analyze {
  color:#6546df;
  background:#eee8ff;
  border:1px solid #cfc0fc;
  border-radius:20px;
  padding:8px 16px;
  font-size:13px
}
.analyze:disabled {
  opacity:.65;
  cursor:default
}
.manual-summary {
  display:flex;
  justify-content:space-between;
  gap:10px;
  font-size:14px;
  margin-top:6px
}
.manual-summary strong {
  display:inline-block;
  background:#e4dbff;
  color:#6540d5;
  padding:2px 8px;
  border-radius:10px;
  margin-left:5px
}
.manual-summary>span:last-child {
  color:#8a7fa1
}
.edited-duration {
  margin:0;
  font-size:11px;
  color:#8a7fa1
}
.edited-duration strong {
  font-weight:500;
  color:#665578;
  margin-left:8px
}
.categories {
  display:grid;
  gap:12px;
  margin:2px 0
}
.categories label {
  display:flex;
  align-items:center;
  gap:10px;
  font-size:14px;
  color:#6f6481
}
.categories input {
  appearance:none;
  width:19px;
  height:19px;
  border:1.5px solid #d6cce6;
  border-radius:5px;
  margin:0;
  flex-shrink:0
}
.categories i {
  width:13px;
  height:13px;
  background:var(--dot);
  border-radius:50%;
  flex-shrink:0
}
.categories small {
  margin-left:auto;
  color:#aaa0b8;
  font-size:10px;
  white-space:nowrap
}
.manual-list {
  font-size:11px;
  color:#81728f
}
.manual-list {
  padding-left:18px;
  margin:7px 0;
  max-height:65px;
  overflow:auto;
  line-height:1.6
}
.manual-list li {
  color:#99506a;
  padding:2px 0
}
.restore {
  margin-left:10px;
  padding:2px 7px;
  border:1px solid #ead2de;
  border-radius:7px;
  background:#fff5f8;
  color:#914f6d;
  font-size:10px;
  cursor:pointer
}
.review {
  display:flex;
  align-items:center;
  justify-content:center;
  gap:10px;
  background:#5b3ce5;
  color:white;
  border:0;
  border-radius:24px;
  padding:12px 17px;
  font-size:14px;
  font-weight:500;
  margin-top:auto;
  cursor:pointer;
  box-shadow:0 3px 6px #57409d16
}
.review:disabled {
  opacity:.48;
  cursor:default
}
@media(max-width:1200px) {
  .cleanup-panel {
    padding:16px;
    gap:10px
  }
  .categories {
    gap:10px
  }
  .categories label {
    gap:8px;
    font-size:12px
  }
  .categories small {
    font-size:9px
  }
  .cleanup-heading h2 {
    font-size:16px
  }
}
@media(max-width:850px) {
  .cleanup-panel {
    height:auto
  }
  .categories {
    grid-template-columns:1fr 1fr
  }
  .categories small {
    display:none
  }
}
</style>
