<script setup lang="ts">
import BarDelta from './BarDelta.vue';
import BarPreview from './BarPreview.vue';
import GameIcon from './GameIcon.vue';
import { computed } from 'vue';
import { t, term } from './i18n';
import { HOLD_ICON } from './icons';

/**
 * The player's Grit, as a globe of liquid that drains from the top. `after` / `end`: Grit after the
 * card being played and after the creatures' moves, drawn on the liquid (BarPreview) and as a number
 * (BarDelta). `block`: his Hold, a layer that fills the globe from the top, on the same scale as
 * Grit; `blockAfter` / `blockEnd`: Hold after the card and after the creatures' moves.
 */
const props = defineProps<{ hp: number; maxHp: number; block: number; after?: number; end?: number; blockAfter?: number; blockEnd?: number }>();
const share = (n: number) => (props.maxHp > 0 ? Math.min(100, (100 * n) / props.maxHp) : 0);
const percent = computed(() => share(props.hp));
const holdPercent = computed(() => share(props.block));
const holdShown = computed(() => props.block > 0 || (props.blockAfter ?? 0) > 0);
/**
 * How far the Hold (with what the card adds) reaches down over the Grit: the Grit's previews move
 * down by that much, so what a Strike takes after the Hold shows right under it.
 */
const covered = computed(() => Math.max(0, percent.value + share(Math.max(props.block, props.blockAfter ?? 0)) - 100));
</script>

<template>
  <div v-tip="t('bars.gritTip')" class="globe" :class="{ blocking: block > 0 }">
    <div class="fill" :style="{ height: `${percent}%` }" />
    <div class="hold" :style="{ height: `${holdPercent}%` }" />
    <BarPreview :value="block" :max="maxHp" :after="blockAfter" :end="blockEnd" from="top" />
    <div class="grit-preview" :style="{ transform: `translateY(${covered}%)` }">
      <BarPreview :value="hp" :max="maxHp" :after="after" :end="end" from="bottom" />
    </div>
    <i class="shine" aria-hidden="true" />
    <span class="value">
      <span v-if="holdShown" v-tip="`${block} ${term('hold')}`" class="hold-value">
        <GameIcon :icon="HOLD_ICON" />{{ blockAfter === undefined || blockAfter === block ? block : `${block} → ${blockAfter}` }}
      </span>
      <GameIcon icon="muscle" />
      <span>{{ hp }}/{{ maxHp }}<BarDelta :value="hp" :after="after" :end="end" /></span>
    </span>
  </div>
</template>

<style scoped>
/* Pixel-art glass: a dark rim and a lighter ring (box-shadows, so the circle's clip leaves them), a square shine. */
.globe {
  position: relative;
  width: 130px;
  height: 130px;
  flex-shrink: 0;
  border: 4px solid #0d0f14;
  border-radius: 50%;
  overflow: hidden;
  background: #3a2716;
  box-shadow: 0 0 0 3px #5b4632, 0 0 0 6px #0d0f14, 0 0 18px rgb(224 116 44 / 0.35);
  align-self: center;
}
.blocking { background: color-mix(in srgb, #3a2716 70%, var(--block)); box-shadow: 0 0 0 3px var(--block), 0 0 0 6px #0d0f14, 0 0 18px rgb(224 116 44 / 0.35); }
/* A lighter band on the surface, in a hard step like pixel shading. */
.fill {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--grit);
  transition: height 0.25s ease;
}
.grit-preview { position: absolute; inset: 0; pointer-events: none; }
/* Hold floats on the Grit, from the top down, with a darker edge where it meets it. */
.hold {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  background: var(--block);
  box-shadow: inset 0 -3px 0 rgb(13 26 38 / 0.35);
  transition: height 0.25s ease;
}
.shine { position: absolute; top: 18%; left: 22%; width: 12px; height: 12px; background: rgb(255 255 255 / 0.55); box-shadow: 12px -6px 0 -2px rgb(255 255 255 / 0.35); pointer-events: none; }
.value {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 2px;
  font-size: 1rem;
  font-weight: 800;
  color: #fff;
  white-space: nowrap;
  text-shadow: 0 1px 2px #000, 0 0 4px rgb(0 0 0 / 0.8);
}
.value .game-icon { width: 2rem; height: 2rem; }
.hold-value { display: inline-flex; align-items: center; gap: 2px; cursor: help; }
.hold-value .game-icon { width: 1.4rem; height: 1.4rem; }
.value :deep(.bar-delta) { font-size: 0.8rem; }
@media (max-width: 700px), (max-height: 500px) {
  .globe { width: 96px; height: 96px; border-width: 3px; }
  .value { font-size: 0.8rem; }
  .value .game-icon { width: 1.4rem; height: 1.4rem; }
  .hold-value .game-icon { width: 1rem; height: 1rem; }
  .shine { width: 8px; height: 8px; box-shadow: 8px -4px 0 -2px rgb(255 255 255 / 0.35); }
}
</style>
