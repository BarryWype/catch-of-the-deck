<script setup lang="ts">
import { computed } from 'vue';
import { baitCards, type Catch, type GameData } from '../engine';
import { t } from './i18n';

/**
 * A bait button's text: `text` with its `{bait}` shown as the word "bait", which shows on hover the
 * card the creature gives (×2 for a trophy).
 */
const props = defineProps<{ text: string; creature: Catch; data: GameData }>();

const parts = computed(() => {
  const [before, after = ''] = props.text.split('{bait}');
  const cards = baitCards(props.creature, props.data);
  return { before, after, tip: { card: props.data.cards[cards[0]], detail: cards.length > 1 ? `×${cards.length}` : undefined } };
});
</script>

<template>
  {{ parts.before }}<span v-tip="parts.tip" class="keyword">{{ t('bait.word') }}</span>{{ parts.after }}
</template>

<style scoped>
.keyword { text-decoration: underline dotted; text-underline-offset: 2px; cursor: help; }
</style>
