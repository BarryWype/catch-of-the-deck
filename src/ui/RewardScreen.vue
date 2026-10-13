<script setup lang="ts">
import { computed } from 'vue';
import { creatureTypeNames, describeCard, type GameData } from '../engine';
import CardView from './CardView.vue';
import { t } from './i18n';

/** `skips`, `rerolls`: how many are left this level (Eel companions); otherwise a card must be taken. */
const props = defineProps<{ choices: string[]; data: GameData; skips: number; rerolls: number }>();
const emit = defineEmits<{ choose: [cardId: string]; skip: []; reroll: [] }>();
const tagNames = computed(() => creatureTypeNames(props.data));
</script>

<template>
  <section class="reward">
    <h2>{{ t('reward.title') }}</h2>
    <div class="choices">
      <CardView
        v-for="id in choices"
        :key="id"
        :card="data.cards[id]"
        :description="describeCard(data.cards[id], { tagNames })"
        @click="emit('choose', id)"
      />
    </div>
    <div v-if="skips || rerolls" class="options">
      <button v-if="rerolls" class="ghost" @click="emit('reroll')">🔄 {{ t('reward.reroll', { n: rerolls }) }}</button>
      <button v-if="skips" class="ghost" @click="emit('skip')">{{ t('reward.skip', { n: skips }) }}</button>
    </div>
  </section>
</template>

<style scoped>
.reward { display: flex; flex-direction: column; align-items: center; gap: 28px; padding-top: 10vh; }
.reward h2 { margin: 0; }
.options { display: flex; gap: 12px; }
.choices { display: flex; gap: 24px; flex-wrap: wrap; justify-content: center; }
.choices :deep(.card) { transform: scale(1.15); }
.choices :deep(.card:hover) { transform: scale(1.15) translateY(-10px); }
</style>
