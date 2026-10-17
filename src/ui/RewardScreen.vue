<script setup lang="ts">
import { computed } from 'vue';
import { creatureTypeNames, describeCard, type GameData } from '../engine';
import CardView from './CardView.vue';
import GameIcon from './GameIcon.vue';
import { t } from './i18n';

/**
 * `skips`: how many are left this level (Eel companions); otherwise a card must be taken.
 * `rerolls`: how many are left, the run's own and the companions'. `families`: those the reward
 * draws from (the fight's creatures'), none meaning every family.
 */
const props = defineProps<{ choices: string[]; data: GameData; skips: number; rerolls: number; families: string[] }>();
const emit = defineEmits<{ choose: [cardId: string]; skip: []; reroll: [] }>();
const tagNames = computed(() => creatureTypeNames(props.data));
const shownFamilies = computed(() => props.families.map((id) => props.data.families[id]).filter(Boolean));
/** Each card's family, shown above it: a reward short of its families' cards tops up from others. */
const familyOf = (id: string) => {
  const family = props.data.cards[id]?.family;
  return family ? props.data.families[family] : undefined;
};
</script>

<template>
  <section class="reward">
    <h2>{{ t('reward.title') }}</h2>
    <p class="families">
      {{ t('reward.families') }}
      <template v-if="shownFamilies.length">
        <span v-for="f in shownFamilies" :key="f.id" v-tip="f.name" class="family"><GameIcon v-if="f.icon" :icon="f.icon" /> {{ f.name }}</span>
      </template>
      <span v-else class="family">{{ t('reward.anyFamily') }}</span>
    </p>
    <div class="choices">
      <div v-for="id in choices" :key="id" class="choice">
        <span v-if="familyOf(id)?.icon" v-tip="familyOf(id)!.name" class="card-family"><GameIcon :icon="familyOf(id)!.icon!" /></span>
        <CardView :card="data.cards[id]" :description="describeCard(data.cards[id], { tagNames })" @click="emit('choose', id)" />
      </div>
    </div>
    <div class="options">
      <button v-tip="t('reward.rerollTip')" class="ghost" :disabled="!rerolls" @click="emit('reroll')">🔄 {{ t('reward.reroll', { n: rerolls }) }}</button>
      <button v-if="skips" class="ghost" @click="emit('skip')">{{ t('reward.skip', { n: skips }) }}</button>
    </div>
  </section>
</template>

<style scoped>
.reward { display: flex; flex-direction: column; align-items: center; gap: 28px; padding-top: 10vh; }
.reward h2 { margin: 0; }
.families { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; margin: -12px 0 0; color: var(--muted); }
.family { display: inline-flex; align-items: center; gap: 5px; padding: 2px 10px; border: 1px solid var(--line); border-radius: 999px; background: var(--panel-soft); color: var(--text); font-weight: 600; cursor: help; }
.options { display: flex; gap: 12px; }
.choices { display: flex; gap: 24px; flex-wrap: wrap; justify-content: center; }
.choice { display: flex; flex-direction: column; align-items: center; gap: 18px; }
.card-family { font-size: 1.4rem; line-height: 1; cursor: help; }
.choices :deep(.card) { transform: scale(1.15); transform-origin: center; }
@media (hover: hover) {
  .choices :deep(.card:hover) { transform: scale(1.22) translateY(-10px); }
}
/* Small screens: the cards at their own size, so three fit. */
@media (max-width: 700px), (max-height: 500px) {
  .choices { gap: 10px; }
  .choice { gap: 6px; }
  .card-family { font-size: 1.1rem; }
  .choices :deep(.card) { transform: none; }
}
</style>
