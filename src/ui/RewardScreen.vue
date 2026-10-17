<script setup lang="ts">
import { computed, ref } from 'vue';
import { creatureTypeNames, describeCard, type GameData } from '../engine';
import CardView from './CardView.vue';
import GameIcon from './GameIcon.vue';
import { t } from './i18n';

/**
 * `skips`: how many are left this level (Eel companions); otherwise a card must be taken.
 * `rerolls`: how many are left, the run's own and the companions'. `families`: those the reward
 * draws from (the fight's creatures'), none meaning every family. `boss`: after a level's boss,
 * the deck (with whether a free removal is still on offer) and the bucket's size, for the two
 * extra options: removing a card, and ending the run.
 */
const props = defineProps<{
  choices: string[];
  data: GameData;
  skips: number;
  rerolls: number;
  families: string[];
  boss?: { deck: string[]; canRemove: boolean; bucket: number } | null;
}>();
const emit = defineEmits<{ choose: [cardId: string]; skip: []; reroll: []; remove: [cardIndex: number]; endRun: [] }>();
/** Picking the card to remove, in place of the reward's cards. */
const removing = ref(false);
function remove(cardIndex: number) {
  emit('remove', cardIndex);
  removing.value = false;
}
const confirmEnd = ref<HTMLDialogElement>();
const tagNames = computed(() => creatureTypeNames(props.data));
const shownFamilies = computed(() => props.families.map((id) => props.data.families[id]).filter(Boolean));
/** Each card's family, shown above it: a reward short of its families' cards tops up from others. */
const familyOf = (id: string) => {
  const family = props.data.cards[id]?.family;
  return family ? props.data.families[family] : undefined;
};
</script>

<template>
  <section v-if="removing && boss" class="reward">
    <h2>{{ t('reward.removeTitle') }}</h2>
    <div class="deck">
      <CardView
        v-for="(id, i) in boss.deck"
        :key="i"
        :card="data.cards[id]"
        :description="describeCard(data.cards[id], { tagNames })"
        @click="remove(i)"
      />
    </div>
    <button class="ghost" @click="removing = false">{{ t('common.cancel') }}</button>
  </section>
  <section v-else class="reward">
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
    <!-- After a boss: a free card removal, on top of the reward, and the chance to head home. -->
    <div v-if="boss" class="options boss">
      <button v-if="boss.canRemove" v-tip="t('reward.removeTip')" class="ghost" :disabled="boss.deck.length <= 1" @click="removing = true">
        ✂️ {{ t('reward.removeCard') }}
      </button>
      <button v-tip="t('reward.endRunTip')" class="ghost" @click="confirmEnd?.showModal()">🏠 {{ t('reward.endRun') }}</button>
    </div>
    <dialog ref="confirmEnd" class="confirm" @click="$event.target === confirmEnd && confirmEnd?.close()">
      <h3>{{ t('leave.title') }}</h3>
      <p>{{ t('leave.text', { n: boss?.bucket ?? 0 }) }}</p>
      <footer>
        <button class="ghost" autofocus @click="confirmEnd?.close()">{{ t('leave.back') }}</button>
        <button @click="emit('endRun')">{{ t('leave.confirm') }}</button>
      </footer>
    </dialog>
  </section>
</template>

<style scoped>
.reward { display: flex; flex-direction: column; align-items: center; gap: 28px; padding-top: 10vh; }
.reward h2 { margin: 0; }
.families { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; margin: -12px 0 0; color: var(--muted); }
.family { display: inline-flex; align-items: center; gap: 5px; padding: 2px 10px; border: 1px solid var(--line); border-radius: 999px; background: var(--panel-soft); color: var(--text); font-weight: 600; cursor: help; }
.options { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; }
.options.boss { margin-top: -14px; }
.options button { display: inline-flex; align-items: center; gap: 6px; }
.deck { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; max-width: 900px; }
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
