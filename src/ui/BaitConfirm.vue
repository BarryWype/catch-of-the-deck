<script setup lang="ts">
import { computed, ref } from 'vue';
import { baitCards, type Catch, type GameData } from '../engine';
import CardView from './CardView.vue';
import { t } from './i18n';
import SpriteView from './SpriteView.vue';

/**
 * Asks before a creature is used as bait (`useAsBait`): who it is, the card(s) it gives, that it's
 * gone for good (a companion with its bonus and bond), and where the cards go. `handSpace` is the
 * room left in the hand during a fight; outside one the cards join the deck.
 */
const props = defineProps<{ data: GameData; handSpace?: number }>();
const emit = defineEmits<{ confirm: [] }>();

const dialog = ref<HTMLDialogElement>();
const asked = ref<{ creature: Catch; companion: boolean } | null>(null);

function open(creature: Catch, companion = false) {
  asked.value = { creature, companion };
  dialog.value?.showModal();
}
defineExpose({ open });

const shown = computed(() => {
  if (!asked.value) return null;
  const { creature, companion } = asked.value;
  const def = props.data.enemies[creature.id];
  const cards = baitCards(creature, props.data);
  const bonus = companion && def?.temperament ? props.data.companionBonuses[def.temperament] : undefined;
  const late = props.handSpace === undefined ? 0 : Math.max(0, cards.length - props.handSpace);
  const where =
    props.handSpace === undefined ? t('bait.toDeck', { n: cards.length }) : late ? t('bait.nextTurn', { n: late }) : t('bait.toHand', { n: cards.length });
  return { def, size: creature.size, card: props.data.cards[cards[0]], copies: cards.length, bonus, where };
});

function confirm() {
  dialog.value?.close();
  emit('confirm');
}
</script>

<template>
  <dialog ref="dialog" class="confirm bait-confirm" @click="$event.target === dialog && dialog?.close()">
    <template v-if="shown">
      <h3>{{ t('bait.title', { name: shown.def?.name ?? '' }) }}</h3>
      <div class="who">
        <SpriteView v-if="shown.def?.sprite" :sprite="shown.def.sprite" :size="56" />
        <span class="size">{{ t(`size.${shown.size}`) }}</span>
      </div>
      <p>{{ t('bait.gives') }}</p>
      <div class="cards">
        <CardView :card="shown.card" />
        <b v-if="shown.copies > 1" class="copies">×{{ shown.copies }}</b>
      </div>
      <p class="gone">{{ t('bait.gone') }}</p>
      <p v-if="shown.bonus" class="gone">{{ t('bait.companion', { bonus: `${shown.bonus.icon ?? ''} ${shown.bonus.name}`.trim() }) }}</p>
      <p>{{ shown.where }}</p>
    </template>
    <footer>
      <button class="ghost" autofocus @click="dialog?.close()">{{ t('common.cancel') }}</button>
      <button class="danger" @click="confirm">{{ t('bait.confirm') }}</button>
    </footer>
  </dialog>
</template>

<style scoped>
.bait-confirm { width: min(420px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); overflow-y: auto; }
.bait-confirm p { margin: 6px 0 0; }
.who { display: flex; align-items: center; gap: 10px; }
.size { color: var(--muted); font-size: 0.85rem; }
.cards { display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 6px; }
.copies { font-size: 1.6rem; color: var(--highlight); }
.bait-confirm .gone { color: #f0a050; font-weight: 600; }
</style>
