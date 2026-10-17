<script setup lang="ts">
import { computed } from 'vue';
import { bonusTotal, BUCKET_SIZE, companionEffects, saleValue, type GameData, type RunState } from '../engine';
import Aquarium from './Aquarium.vue';
import GameIcon from './GameIcon.vue';
import { t } from './i18n';
import SpriteView from './SpriteView.vue';

/**
 * After a fight whose catches don't fit in the bucket: for the first waiting catch, sell a
 * creature from the bucket to keep it, or sell the catch. One catch at a time.
 */
const props = defineProps<{ run: RunState; data: GameData }>();
const emit = defineEmits<{ keep: [slot: number]; sell: [] }>();

const waiting = computed(() => {
  const caught = props.run.waiting[0];
  const def = caught && props.data.enemies[caught.id];
  if (!def) return null;
  const sellBonus = bonusTotal(companionEffects(props.run.companions, props.data), 'sellBonus');
  return { def, size: caught.size, value: saleValue(caught.id, sellBonus, props.data), more: props.run.waiting.length - 1 };
});
</script>

<template>
  <div v-if="waiting" class="bucket-full">
    <header class="head">
      <h2><GameIcon icon="🪣" /> {{ t('bucketFull.title', { n: run.bucket.length, max: BUCKET_SIZE }) }}</h2>
      <p>{{ t('bucketFull.text', { name: waiting.def.name }) }}</p>
    </header>
    <section class="catch" :aria-label="t('bucketFull.newCatch')">
      <SpriteView v-if="waiting.def.sprite" :sprite="waiting.def.sprite" :size="64" />
      <span class="name">
        <small>{{ t('bucketFull.newCatch') }}</small>
        {{ waiting.def.name }}
        <small>{{ t(`size.${waiting.size}`) }}</small>
      </span>
      <button @click="emit('sell')">{{ t('bucketFull.sellCatch') }} · <GameIcon icon="🪙" /> {{ waiting.value }}</button>
    </section>
    <p v-if="waiting.more" class="more">{{ t('bucketFull.more', { n: waiting.more }) }}</p>
    <Aquarium
      class="aquarium"
      :creatures="run.bucket"
      :capacity="BUCKET_SIZE"
      :companions="run.companions.length"
      :bonds="run.companions.map((c) => c.bond)"
      :data="data"
      :title="t('aquarium.bucket')"
      :sell-label="t('bucketFull.swap', { name: waiting.def.name })"
      icon="🪣"
      @sell="(slot) => emit('keep', slot)"
    />
  </div>
</template>

<style scoped>
.bucket-full { display: flex; flex-direction: column; gap: 10px; height: 100%; padding: 8px 0 12px; }
.head h2 { margin: 0; font-size: 1.4rem; }
.head p { margin: 4px 0 0; color: var(--muted); }
.catch {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border: 2px solid #f0a050;
  border-radius: 12px;
  background: linear-gradient(180deg, #1f3448, #17283a);
}
.name { display: flex; flex: 1; flex-direction: column; min-width: 120px; font-weight: 700; line-height: 1.2; }
.name small { color: var(--muted); font-size: 0.72rem; font-weight: 500; }
.more { margin: 0; color: var(--muted); font-size: 0.8rem; }
.aquarium { flex: 1; min-height: 220px; }
@media (max-width: 700px), (max-height: 500px) {
  .bucket-full { height: auto; min-height: 100%; gap: 8px; }
  .head h2 { font-size: 1.1rem; }
}
</style>
