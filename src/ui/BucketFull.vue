<script setup lang="ts">
import { computed, ref } from 'vue';
import { progressionTotal, runSellBonus, saleValue, type GameData, type RunState } from '../engine';
import Aquarium from './Aquarium.vue';
import BaitConfirm from './BaitConfirm.vue';
import BaitLabel from './BaitLabel.vue';
import GameIcon from './GameIcon.vue';
import { t } from './i18n';
import SpriteView from './SpriteView.vue';

/**
 * After a fight whose catches don't fit in the bucket: for the first waiting catch, keep it once
 * the bucket has room (made by selling bucket creatures or using them as bait, as many as the
 * player likes), or sell the catch or use it as bait. One catch at a time.
 */
const props = defineProps<{ run: RunState; data: GameData }>();
const emit = defineEmits<{ keep: []; sell: []; bait: []; sellCreature: [slot: number]; baitCreature: [slot: number] }>();

const waiting = computed(() => {
  const caught = props.run.waiting[0];
  const def = caught && props.data.enemies[caught.id];
  if (!def) return null;
  return { def, size: caught.size, value: saleValue(caught.id, runSellBonus(props.run, props.data), props.data, caught.size), more: props.run.waiting.length - 1 };
});
const full = computed(() => props.run.bucket.length >= props.run.bucketSize);
const baitConfirm = ref<InstanceType<typeof BaitConfirm>>();
</script>

<template>
  <div v-if="waiting" class="bucket-full">
    <header class="head">
      <h2><GameIcon icon="🪣" /> {{ t(full ? 'bucketFull.title' : 'bucketFull.roomTitle', { n: run.bucket.length, max: run.bucketSize }) }}</h2>
      <p>{{ t(full ? 'bucketFull.text' : 'bucketFull.roomText', { name: waiting.def.name }) }}</p>
    </header>
    <section class="catch" :aria-label="t('bucketFull.newCatch')">
      <SpriteView v-if="waiting.def.sprite" :sprite="waiting.def.sprite" :size="64" />
      <span class="name">
        <small>{{ t('bucketFull.newCatch') }}</small>
        {{ waiting.def.name }}
        <small>{{ t(`size.${waiting.size}`) }}</small>
      </span>
      <span class="choices">
        <button v-tip="full ? t('bucketFull.keepBlocked') : undefined" :disabled="full" @click="emit('keep')">{{ t('bucketFull.keep') }}</button>
        <button @click="emit('sell')">{{ t('bucketFull.sellCatch') }} <GameIcon icon="🪙" /> {{ waiting.value }}</button>
        <button class="bait" @click="baitConfirm?.open(run.waiting[0])"><BaitLabel :text="t('bucketFull.baitCatch')" :creature="run.waiting[0]" :data="data" /></button>
      </span>
    </section>
    <BaitConfirm ref="baitConfirm" :data="data" @confirm="emit('bait')" />
    <p v-if="waiting.more" class="more">{{ t('bucketFull.more', { n: waiting.more }) }}</p>
    <Aquarium
      class="aquarium"
      :creatures="run.bucket"
      :capacity="run.bucketSize"
      :companions="run.companions.length"
      :bonds="run.companions.map((c) => c.bond)"
      :sell-bonus="runSellBonus(run, data)"
      :extra-stars="progressionTotal(run.progression, data, 'companionStars')"
      :data="data"
      :title="t('aquarium.bucket')"
      bait
      icon="🪣"
      @sell="(slot) => emit('sellCreature', slot)"
      @bait="(slot) => emit('baitCreature', slot)"
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
.choices { display: flex; flex-wrap: wrap; gap: 6px; }
.more { margin: 0; color: var(--muted); font-size: 0.8rem; }
.aquarium { flex: 1; min-height: 220px; }
@media (max-width: 700px), (max-height: 500px) {
  .bucket-full { height: auto; min-height: 100%; gap: 8px; }
  .head h2 { font-size: 1.1rem; }
}
</style>
