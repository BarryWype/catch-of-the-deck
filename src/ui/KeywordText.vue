<script setup lang="ts">
import { computed } from 'vue';
import GameIcon from './GameIcon.vue';
import { splitKeywords } from './keywords';

/**
 * Text whose keywords (Grit, Hold, Drain, Weak…) explain themselves on hover. A keyword with an
 * icon shows as the icon alone; screen readers still get the word.
 */
const props = defineProps<{ text: string }>();
const parts = computed(() => splitKeywords(props.text));
</script>

<template>
  <template v-for="(part, i) in parts" :key="i">
    <span v-if="part.tip && part.icon" v-tip="part.tip" class="keyword-icon" role="img" :aria-label="part.text" tabindex="0">
      <GameIcon :icon="part.icon" />
    </span>
    <span v-else-if="part.tip" v-tip="part.tip" class="keyword">{{ part.text }}</span>
    <template v-else>{{ part.text }}</template>
  </template>
</template>

<style scoped>
.keyword { text-decoration: underline dotted; text-underline-offset: 2px; cursor: help; }
.keyword-icon { cursor: help; }
</style>
