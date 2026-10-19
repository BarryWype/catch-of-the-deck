<script setup lang="ts">
import { ref } from 'vue';
import { describeCard, type GameData } from '../engine';
import CardView from './CardView.vue';
import { t } from './i18n';

/**
 * `skips`: how many are left this level (Eel companions); otherwise a card must be taken.
 * `rerolls`: how many are left, the run's own and the companions'. `boss`: after a level's boss,
 * the deck (with whether a free removal is still on offer) and the bucket's size, for the two
 * extra options: removing a card, and ending the run.
 */
defineProps<{
  choices: string[];
  data: GameData;
  skips: number;
  rerolls: number;
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
</script>

<template>
  <section v-if="removing && boss" class="reward">
    <h2>{{ t('reward.removeTitle') }}</h2>
    <div class="deck">
      <CardView
        v-for="(id, i) in boss.deck"
        :key="i"
        :card="data.cards[id]"
        :description="describeCard(data.cards[id])"
        @click="remove(i)"
      />
    </div>
    <button class="ghost" @click="removing = false">{{ t('common.cancel') }}</button>
  </section>
  <section v-else class="reward">
    <h2>{{ t('reward.title') }}</h2>
    <div class="choices">
      <div v-for="id in choices" :key="id" class="choice">
        <CardView :card="data.cards[id]" :description="describeCard(data.cards[id])" @click="emit('choose', id)" />
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
.options { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; }
.options.boss { margin-top: -14px; }
.options button { display: inline-flex; align-items: center; gap: 6px; }
.deck { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; max-width: 900px; }
.choices { display: flex; gap: 24px; flex-wrap: wrap; justify-content: center; }
.choice { display: flex; flex-direction: column; align-items: center; gap: 18px; }
.choices :deep(.card) { transform: scale(1.15); transform-origin: center; }
@media (hover: hover) {
  .choices :deep(.card:hover) { transform: scale(1.22) translateY(-10px); }
}
/* Small screens: the cards at their own size, so three fit. */
@media (max-width: 700px), (max-height: 500px) {
  .choices { gap: 10px; }
  .choice { gap: 6px; }
  .choices :deep(.card) { transform: none; }
}
</style>
