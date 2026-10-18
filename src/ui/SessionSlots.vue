<script setup lang="ts">
import KeywordText from './KeywordText.vue';
import GameIcon from './GameIcon.vue';
import { computed } from 'vue';
import { activeBonuses, bondLevel, companionStars, describeCompanionEffect, FULL_SCHOOL, nextStars, SESSION_SLOTS, type GameData, type HomeCreature } from '../engine';
import SpriteView from './SpriteView.vue';
import { t } from './i18n';

/** The creatures picked from the home aquarium to start the run in the bucket, one per slot. */
const props = defineProps<{ brought: HomeCreature[]; data: GameData }>();
const emit = defineEmits<{ remove: [index: number]; pick: [] }>();

const slots = computed(() =>
  Array.from({ length: SESSION_SLOTS }, (_, i) => {
    const picked = props.brought[i];
    const creature = picked && props.data.enemies[picked.id];
    if (!creature) return null;
    return {
      creature,
      bond: bondLevel(picked, props.data),
      stars: companionStars(picked, props.data),
      bonus: creature.temperament ? props.data.companionBonuses[creature.temperament] : undefined,
    };
  }),
);

/** What the picked creatures give together, with their scaled numbers, and what more stars would change. */
const bonuses = computed(() =>
  activeBonuses(props.brought, props.data).map((b) => {
    const next = nextStars(b);
    return {
      ...b,
      text: b.effects.map(describeCompanionEffect),
      next: next && t('slots.nextStars', { n: next.more, rule: next.effects.map(describeCompanionEffect).join(' ') }),
    };
  }),
);
</script>

<template>
  <section class="session-slots" :aria-label="t('slots.label')">
    <header><GameIcon icon="🪣" /> {{ t('slots.title') }}</header>
    <template v-for="(slot, i) in slots" :key="i">
      <div v-if="slot" class="slot">
        <SpriteView v-if="slot.creature.sprite" :sprite="slot.creature.sprite" :size="48" />
        <span class="name">
          <span>{{ slot.creature.name }} <span class="stars" v-tip="t('slots.starsTip')">★{{ slot.stars }}</span></span>
          <small v-if="slot.bonus">{{ slot.bonus.icon }} {{ slot.bonus.temperamentName }}<template v-if="slot.bond"> · ♥{{ slot.bond }}</template></small>
        </span>
        <button class="ghost remove" v-tip="t('slots.remove')" :aria-label="t('slots.removeLabel', { name: slot.creature.name })" @click="emit('remove', i)">
          ✕
        </button>
      </div>
      <button v-else class="slot empty" @click="emit('pick')">{{ t('slots.empty') }}</button>
    </template>
    <ul v-if="bonuses.length" class="bonuses" :aria-label="t('slots.bonuses')">
      <li v-for="b in bonuses" :key="b.def.id">
        <strong>{{ b.def.icon }} {{ b.def.name }}</strong>
        <span class="species"><span class="stars">★{{ b.stars }}</span> · {{ b.species }}/{{ FULL_SCHOOL }} {{ b.def.temperamentName }}</span>
        <p v-for="(line, j) in b.text" :key="j"><KeywordText :text="line" /></p>
        <p v-if="b.next" class="next"><KeywordText :text="b.next" /></p>
      </li>
    </ul>
    <p class="help">{{ t('slots.help') }}</p>
  </section>
</template>

<style scoped>
.session-slots { display: flex; flex-direction: column; gap: 6px; width: 230px; overflow-y: auto; }
/* Small screens: the slots sit under the aquarium, across its width. */
@media (max-width: 700px), (max-height: 500px) {
  .session-slots { width: 100%; }
}
header { font-weight: 700; padding: 0 4px; }
.slot {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
  min-height: 56px;
  padding: 4px 8px;
  border: 2px solid #2c3a4a;
  border-radius: 10px;
  background: linear-gradient(180deg, #1f3448, #17283a);
}
.slot.empty { justify-content: center; border-style: dashed; background: none; color: var(--muted); font-size: 0.8rem; font-weight: 600; }
@media (hover: hover) {
  .slot.empty:hover { border-color: var(--highlight); color: var(--text); }
}
.name { display: flex; flex: 1; flex-direction: column; font-size: 0.85rem; font-weight: 600; line-height: 1.15; }
.name small { color: var(--muted); font-size: 0.7rem; font-weight: 500; }
.bonuses { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; font-size: 0.75rem; }
.bonuses li { padding: 6px 8px; border-radius: 8px; background: rgb(255 255 255 / 0.05); }
.bonuses p { margin: 2px 0 0; color: var(--muted); line-height: 1.3; }
.species { float: right; color: var(--muted); font-size: 0.68rem; }
.stars { color: #f2c94c; font-weight: 700; }
.bonuses .next { color: #c9b26a; font-style: italic; }
.remove { padding: 2px 8px; }
.help { margin: 0; color: var(--muted); font-size: 0.72rem; line-height: 1.3; }
</style>
