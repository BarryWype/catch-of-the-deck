<script setup lang="ts">
import GameIcon from './GameIcon.vue';
import SpriteView from './SpriteView.vue';
import { computed } from 'vue';
import type { GameData, RunState } from '../engine';
import { t } from './i18n';

/** The relics on offer (`RunState.relicChoices`): take one, or leave them. Shown over the map. */
const props = defineProps<{ run: RunState; data: GameData }>();
const emit = defineEmits<{ take: [id: string]; skip: [] }>();

const relics = computed(() => (props.run.relicChoices ?? []).map((id) => props.data.equipment[id]).filter(Boolean));
</script>

<template>
  <div class="relic-choice" role="dialog" aria-modal="true" :aria-label="t('relic.title')">
    <div class="panel">
      <h2>{{ t('relic.title') }}</h2>
      <p class="hint">{{ t('relic.hint') }}</p>
      <div class="relics">
        <button v-for="relic in relics" :key="relic.id" class="relic" :class="relic.rarity" @click="emit('take', relic.id)">
          <SpriteView v-if="relic.sprite" :sprite="relic.sprite" :size="48" />
          <span v-else class="icon"><GameIcon :icon="relic.icon ?? '🎒'" /></span>
          <strong>{{ relic.name }}</strong>
          <small class="rarity">{{ t(`relic.rarity.${relic.rarity ?? 'common'}`) }}</small>
          <span class="text">{{ relic.description }}</span>
        </button>
      </div>
      <button class="ghost" @click="emit('skip')">{{ t('relic.skip') }}</button>
    </div>
  </div>
</template>

<style scoped>
.relic-choice { position: fixed; inset: 0; z-index: 20; display: grid; place-items: center; padding: 16px; background: rgb(8 12 20 / 0.7); overflow-y: auto; }
.panel { display: flex; flex-direction: column; align-items: center; gap: 10px; width: min(760px, 100%); padding: 18px; border: 1px solid var(--line); border-radius: 14px; background: linear-gradient(180deg, #26304a, #1c2334); }
.panel h2, .panel p { margin: 0; text-align: center; }
.hint { color: var(--muted); }
.relics { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; width: 100%; }
.relic { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px; color: var(--text); background: #1a2132; border: 1px solid var(--line); border-radius: 10px; text-align: center; }
.relic .icon { font-size: 2.4rem; line-height: 48px; }
.relic .rarity { color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.7rem; }
.relic.uncommon .rarity { color: #7fb8ff; }
.relic.rare .rarity { color: var(--highlight); }
.relic .text { font-size: 0.85rem; font-weight: 400; color: var(--muted); }
@media (hover: hover) {
  .relic:hover { border-color: rgb(245 215 110 / 0.55); transform: translateY(-2px); }
}
@media (max-width: 700px), (max-height: 500px) {
  .panel { padding: 12px; gap: 8px; }
  .relics { grid-template-columns: 1fr; }
  .relic { flex-direction: row; flex-wrap: wrap; justify-content: flex-start; text-align: left; }
  .relic .text { flex-basis: 100%; }
}
</style>
