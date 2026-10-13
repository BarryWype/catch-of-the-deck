<script setup lang="ts">
import { computed } from 'vue';
import { activeBonuses, bondLevel, describeCompanionEffect, FULL_SCHOOL, SESSION_SLOTS, type GameData, type HomeCreature } from '../engine';
import SpriteView from './SpriteView.vue';
import { t } from './i18n';

/** The creatures picked from the home aquarium to start the run in the bucket, one per slot. */
const props = defineProps<{ brought: HomeCreature[]; data: GameData }>();
const emit = defineEmits<{ remove: [index: number] }>();

const slots = computed(() =>
  Array.from({ length: SESSION_SLOTS }, (_, i) => {
    const picked = props.brought[i];
    const creature = picked && props.data.enemies[picked.id];
    if (!creature) return null;
    return {
      creature,
      bond: bondLevel(picked, props.data),
      bonus: creature.temperament ? props.data.companionBonuses[creature.temperament] : undefined,
    };
  }),
);

/** What the picked creatures give together, with their scaled numbers. */
const bonuses = computed(() =>
  activeBonuses(props.brought, props.data).map((b) => ({ ...b, text: b.effects.map(describeCompanionEffect) })),
);
</script>

<template>
  <section class="session-slots" :aria-label="t('slots.label')">
    <header>🪣 {{ t('slots.title') }}</header>
    <div v-for="(slot, i) in slots" :key="i" class="slot" :class="{ empty: !slot }">
      <template v-if="slot">
        <SpriteView v-if="slot.creature.sprite" :sprite="slot.creature.sprite" :size="48" />
        <span class="name">
          {{ slot.creature.name }}
          <small v-if="slot.bonus">{{ slot.bonus.icon }} {{ slot.bonus.temperamentName }}<template v-if="slot.bond"> · ♥{{ slot.bond }}</template></small>
        </span>
        <button class="ghost remove" v-tip="t('slots.remove')" :aria-label="t('slots.removeLabel', { name: slot.creature.name })" @click="emit('remove', i)">
          ✕
        </button>
      </template>
      <span v-else class="hint">{{ t('slots.empty') }}</span>
    </div>
    <ul v-if="bonuses.length" class="bonuses" :aria-label="t('slots.bonuses')">
      <li v-for="b in bonuses" :key="b.def.id">
        <strong>{{ b.def.icon }} {{ b.def.name }}</strong>
        <span class="species">{{ b.species }}/{{ FULL_SCHOOL }} {{ b.def.temperamentName }}</span>
        <p v-for="(line, j) in b.text" :key="j">{{ line }}</p>
      </li>
    </ul>
    <p class="help">{{ t('slots.help') }}</p>
  </section>
</template>

<style scoped>
.session-slots { display: flex; flex-direction: column; gap: 6px; width: 230px; overflow-y: auto; }
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
.slot.empty { justify-content: center; border-style: dashed; background: none; }
.name { display: flex; flex: 1; flex-direction: column; font-size: 0.85rem; font-weight: 600; line-height: 1.15; }
.name small { color: var(--muted); font-size: 0.7rem; font-weight: 500; }
.bonuses { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; font-size: 0.75rem; }
.bonuses li { padding: 6px 8px; border-radius: 8px; background: rgb(255 255 255 / 0.05); }
.bonuses p { margin: 2px 0 0; color: var(--muted); line-height: 1.3; }
.species { float: right; color: var(--muted); font-size: 0.68rem; }
.remove { padding: 2px 8px; }
.hint { color: var(--muted); font-size: 0.8rem; }
.help { margin: 0; color: var(--muted); font-size: 0.72rem; line-height: 1.3; }
</style>
