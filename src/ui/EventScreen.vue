<script setup lang="ts">
import KeywordText from './KeywordText.vue';
import GameIcon from './GameIcon.vue';
import CardView from './CardView.vue';
import { computed, ref } from 'vue';
import { t } from './i18n';
import { describeCard, describeEventEffect, eventChoiceBlocked, eventChoicePick, type GameData, type RunState } from '../engine';

const props = defineProps<{ eventId: string; run: RunState; data: GameData }>();
const emit = defineEmits<{ choose: [choiceIndex: number, pick?: number] }>();

const event = computed(() => props.data.events[props.eventId]);
const choices = computed(() =>
  event.value.choices.map((choice) => ({
    label: choice.label,
    text: choice.effects.map((e) => describeEventEffect(e, props.run, props.data)).join(' ') || t('event.nothing'),
    blocked: eventChoiceBlocked(choice, props.run),
    pick: eventChoicePick(choice),
  })),
);

/** The choice waiting for a deck card or a bucket creature to be picked. */
const choosing = ref<number | null>(null);
const picking = computed(() => (choosing.value === null ? null : choices.value[choosing.value]));
function choose(i: number) {
  if (choices.value[i].pick) choosing.value = i;
  else emit('choose', i);
}
</script>

<template>
  <section class="event">
    <div class="icon"><GameIcon :icon="event.icon ?? '❓'" /></div>
    <h2>{{ event.name }}</h2>
    <p class="description">{{ event.description }}</p>
    <div v-if="picking" class="picking">
      <p><strong>{{ picking.label }}</strong> · <KeywordText :text="picking.text" /></p>
      <h3>{{ picking.pick === 'card' ? t('event.chooseCard') : t('event.chooseCreature') }}</h3>
      <div v-if="picking.pick === 'card'" class="deck">
        <button v-for="(id, i) in run.deck" :key="i" class="pick-card" @click="emit('choose', choosing!, i)">
          <CardView :card="data.cards[id]" :description="describeCard(data.cards[id])" :zoomable="false" />
        </button>
      </div>
      <div v-else class="creatures">
        <button v-for="(c, i) in run.bucket" :key="i" class="choice" @click="emit('choose', choosing!, i)">
          <strong>{{ data.enemies[c.id]?.name ?? c.id }}</strong>
        </button>
      </div>
      <button class="ghost" @click="choosing = null">{{ t('event.cancel') }}</button>
    </div>
    <div v-else class="choices">
      <button
        v-for="(choice, i) in choices"
        :key="i"
        class="choice"
        :disabled="!!choice.blocked"
        v-tip="choice.blocked"
        @click="choose(i)"
      >
        <strong>{{ choice.label }}</strong>
        <span><KeywordText :text="choice.blocked ?? choice.text" /></span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.event { display: flex; flex-direction: column; align-items: center; gap: 10px; max-width: 560px; margin: 0 auto; padding-top: 10vh; text-align: center; }
.event h2 { margin: 0; }
.icon { font-size: 4rem; line-height: 1; filter: drop-shadow(0 6px 18px rgb(245 215 110 / 0.3)); }
.description { margin: 0 0 12px; color: var(--muted); }
.choices { display: flex; flex-direction: column; gap: 10px; width: 100%; }
.choice {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 16px;
  text-align: left;
  color: var(--text);
  background: linear-gradient(180deg, #26304a, #1c2334);
  border: 1px solid var(--line);
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.3);
  transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}
@media (hover: hover) {
  .choice:hover:not(:disabled) { transform: translateY(-2px); border-color: rgb(245 215 110 / 0.55); box-shadow: 0 8px 20px rgb(0 0 0 / 0.4); }
}
.choice span { font-weight: 400; font-size: 0.9rem; color: var(--muted); }
.picking { display: flex; flex-direction: column; align-items: center; gap: 10px; width: 100%; }
.picking p, .picking h3 { margin: 0; }
.deck { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; max-width: 100%; }
.pick-card { padding: 0; background: none; border: 0; box-shadow: none; }
.creatures { display: flex; flex-direction: column; gap: 6px; width: 100%; }
</style>
