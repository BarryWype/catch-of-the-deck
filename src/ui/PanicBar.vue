<script setup lang="ts">
import GameIcon from './GameIcon.vue';
import { computed } from 'vue';
import { t } from './i18n';

/**
 * The tug of war: the creature flees when the bar fills, and is captured if it's pushed down to 0.
 * `pull` is its upcoming move's Pull on the bar, before the player's Hold: it can warn of an escape
 * before the rise would.
 */
const props = defineProps<{ escape: number; escapeAt: number; escapeRate: number; pull?: number }>();
const percent = (value: number) => (props.escapeAt > 0 ? Math.min(100, (100 * value) / props.escapeAt) : 0);
const fill = computed(() => percent(props.escape));
const next = computed(() => percent(props.escape + props.escapeRate) - fill.value);
/** The fill's colour follows how full the bar is: teal when it's low, orange as it nears, red and
 * pulsing when it's about to flee. */
const stage = computed(() => (fill.value >= 85 ? 'critical' : fill.value >= 60 ? 'warn' : 'calm'));
/** Turns until it escapes at the current (slowed) rise; hidden while the rise is stopped. */
const escapesIn = computed(() => {
  if (props.escapeRate <= 0 || props.escape + props.escapeRate >= props.escapeAt) return null;
  return t('bars.escapeIn', { n: Math.ceil((props.escapeAt - props.escape) / props.escapeRate) });
});
/** The next rise — or the upcoming Pull, before Hold — would fill the bar. */
const escapesNext = computed(
  () => props.escape < props.escapeAt && props.escape + Math.max(props.escapeRate, props.pull ?? 0) >= props.escapeAt,
);
</script>

<template>
  <div class="will">
    <div v-tip="t('bars.willRate', { rate: escapeRate })" class="panicbar" :class="stage">
      <div class="fill" :style="{ transform: `scaleX(${fill / 100})` }" />
      <!-- Next turn's rise, from `fill` to `fill + next`: the outer window's right edge and the
         inner one's left edge slide there, so only transforms change. -->
      <div class="next-window" :style="{ transform: `translateX(${fill + next - 100}%)` }">
        <div class="next" :style="{ transform: `translateX(${100 - next}%)` }" />
      </div>
      <!-- Just the values, inside the bar; the hover says how fast the bar rises. -->
      <span class="value">{{ escape }}/{{ escapeAt }}</span>
      <!-- The ends of the tug of war: down to the hook (caught) or off to open water (fled). -->
      <span v-tip="t('bars.captureTip')" class="end left"><GameIcon icon="🪝" /></span>
      <span v-tip="t('bars.fleeTip')" class="end right"><GameIcon icon="💨" /></span>
    </div>
    <p v-if="escapesNext" class="escapes now">{{ t('bars.escapeNext') }}</p>
    <p v-else-if="escapesIn" class="escapes">{{ escapesIn }}</p>
  </div>
</template>

<style scoped>
.will { display: flex; flex-direction: column; align-items: center; gap: 2px; width: 100%; }
.panicbar {
  position: relative;
  /* As wide as the creature's block, so it lines up with the health bar under it. */
  width: 100%;
  /* The Will is a creature's second life bar, so it's tall (three times its old height) and wide. */
  height: 42px;
  border-radius: 12px;
  background: #14303d;
  overflow: hidden;
  border: 1px solid #0006;
}
.fill {
  height: 100%;
  transform-origin: left;
  transition: transform 0.3s ease, background 0.3s ease;
}
.panicbar.calm .fill { background: #3fb9c9; }
.panicbar.warn .fill { background: #e08a2c; }
.panicbar.critical .fill { background: #d8443c; animation: will-pulse 1.1s ease-in-out infinite; }
@keyframes will-pulse {
  50% { filter: brightness(1.3); }
}
@media (prefers-reduced-motion: reduce) {
  .panicbar.critical .fill { animation: none; }
}
.next-window { position: absolute; inset: 0; overflow: hidden; transition: transform 0.3s ease; }
.next {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(135deg, rgb(255 214 130 / 0.75) 0 4px, transparent 4px 8px);
  transition: transform 0.3s ease;
}
/* The values sit inside the bar, on the bright fill, so they carry their own shadow to stay
   readable (the hover says the rate, nothing more). */
.value {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 0.72rem;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
  text-shadow: 0 1px 2px #000, 0 0 4px rgb(0 0 0 / 0.8);
}
.end {
  position: absolute;
  top: 0;
  bottom: 0;
  display: grid;
  place-items: center;
  font-size: 1.5rem;
  text-shadow: 0 1px 2px #000;
}
.end.left { left: 6px; }
.end.right { right: 6px; }
.escapes { margin: 0; font-size: 0.72rem; font-weight: 600; color: var(--muted); }
.escapes.now { color: #ff8177; font-weight: 800; }
@media (max-width: 700px), (max-height: 500px) {
  .panicbar { height: 32px; }
  .end { font-size: 1.2rem; }
}
</style>
