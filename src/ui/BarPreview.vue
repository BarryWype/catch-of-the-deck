<script setup lang="ts">
import { computed } from 'vue';

/**
 * What a bar is about to do, drawn over its fill: `value` now, `after` the card being played, `end`
 * once the creatures have played their shown moves (engine: `previewCard`, `previewIntents`). Each
 * step down is a grey-red piece of the bar, each step up a striped one. `from`: the edge the bar
 * fills from (the left by default; the Grit globe fills from the bottom, its Hold from the top).
 */
const props = defineProps<{ value: number; max: number; after?: number; end?: number; from?: 'left' | 'bottom' | 'top' }>();
const along = computed(() => (props.from === 'bottom' || props.from === 'top' ? 'height' : 'width'));
const percent = (v: number) => (props.max > 0 ? Math.max(0, Math.min(100, (100 * v) / props.max)) : 0);
const segments = computed(() => {
  const after = props.after ?? props.value;
  const end = props.end ?? after;
  return [
    [after, props.value],
    [end, after],
  ]
    .filter(([to, from]) => to !== from)
    .map(([to, from]) => ({
      kind: to < from ? 'loss' : 'gain',
      style: {
        [props.from ?? 'left']: `${percent(Math.min(to, from))}%`,
        [along.value]: `${percent(Math.max(to, from)) - percent(Math.min(to, from))}%`,
      },
    }));
});
</script>

<template>
  <div v-for="(s, i) in segments" :key="i" class="bar-preview" :class="[s.kind, along]" :style="s.style" aria-hidden="true" />
</template>

<style scoped>
.bar-preview { position: absolute; pointer-events: none; }
.bar-preview.width { top: 0; bottom: 0; }
.bar-preview.height { left: 0; right: 0; }
.loss { background: #8a5a58; box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.35); animation: preview-blink 1.2s ease-in-out infinite; }
.gain { background: repeating-linear-gradient(135deg, rgb(255 255 255 / 0.55) 0 4px, transparent 4px 8px); }
@keyframes preview-blink {
  50% { opacity: 0.6; }
}
@media (prefers-reduced-motion: reduce) {
  .loss { animation: none; }
}
</style>
