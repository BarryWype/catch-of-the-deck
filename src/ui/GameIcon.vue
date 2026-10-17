<script setup lang="ts">
import { computed } from 'vue';
import { iconUrl } from './icons';

/**
 * An icon given as an emoji or as the name of a file in assets/icons (`iconUrl`). With art, it shows
 * the 64×64 image sized to the surrounding text (1.25em); other emoji show as text, so content can
 * keep emoji that have no art yet.
 */
const props = defineProps<{ icon: string }>();

const url = computed(() => iconUrl(props.icon));
</script>

<template>
  <img v-if="url" :src="url" alt="" aria-hidden="true" class="game-icon" />
  <template v-else>{{ icon }}</template>
</template>

<style scoped>
.game-icon { width: 1.25em; height: 1.25em; vertical-align: -0.25em; image-rendering: pixelated; }
</style>
