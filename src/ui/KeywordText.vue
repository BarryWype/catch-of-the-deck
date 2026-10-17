<script setup lang="ts">
import { computed } from 'vue';
import GameIcon from './GameIcon.vue';
import { splitKeywords } from './keywords';

/** Text whose keywords (Grit, Hold, Drain, Weak…) explain themselves on hover, most with their icon before them. */
const props = defineProps<{ text: string }>();
const parts = computed(() => splitKeywords(props.text));
</script>

<template>
  <template v-for="(part, i) in parts" :key="i">
    <span v-if="part.tip" v-tip="part.tip" class="keyword"><GameIcon v-if="part.icon" :icon="part.icon" class="icon" />{{ part.text }}</span>
    <template v-else>{{ part.text }}</template>
  </template>
</template>

<style scoped>
.keyword { text-decoration: underline dotted; text-underline-offset: 2px; white-space: nowrap; cursor: help; }
.icon { margin-right: 0.15em; }
</style>
