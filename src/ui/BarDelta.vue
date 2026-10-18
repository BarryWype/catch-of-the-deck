<script setup lang="ts">
import { computed } from 'vue';

/**
 * The change a bar's preview predicts (BarPreview), written after its numbers: `(+5)` in green
 * for a rise, `(-5)` in red for a drop, from `value` now to `end` (or `after`) at the end of it.
 */
const props = defineProps<{ value: number; after?: number; end?: number }>();
const delta = computed(() => (props.end ?? props.after ?? props.value) - props.value);
</script>

<template>
  <span v-if="delta" class="bar-delta" :class="delta > 0 ? 'gain' : 'loss'">({{ delta > 0 ? `+${delta}` : delta }})</span>
</template>

<style scoped>
/* On a dark pill, so the colour reads over any bar's fill (orange Grit, teal Will, red Health). */
.bar-delta { margin-left: 4px; padding: 0 4px; border-radius: 6px; background: rgb(10 14 20 / 0.7); font-weight: 800; text-shadow: none; }
.gain { color: #8ff09a; }
.loss { color: #ff8a80; }
</style>
