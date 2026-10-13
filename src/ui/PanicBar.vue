<script setup lang="ts">
import { computed } from 'vue';
import { ESCAPE_BAR_NAME } from '../engine';

/** The tug of war: the creature flees when the bar fills, and is captured if it's pushed down to 0. */
const props = defineProps<{ escape: number; escapeAt: number; escapeRate: number }>();
const percent = (value: number) => (props.escapeAt > 0 ? Math.min(100, (100 * value) / props.escapeAt) : 0);
const fill = computed(() => percent(props.escape));
const next = computed(() => percent(props.escape + props.escapeRate) - fill.value);
const text = computed(() => `${ESCAPE_BAR_NAME} ${props.escape}/${props.escapeAt} (+${props.escapeRate}/turn)`);
</script>

<template>
  <div v-tip="{ title: text, body: 'It flees when the bar fills, and is caught if it drops to 0.' }" class="panicbar">
    <div class="fill" :style="{ width: `${fill}%` }" />
    <div class="next" :style="{ left: `${fill}%`, width: `${next}%` }" />
    <span class="label">{{ text }}</span>
  </div>
</template>

<style scoped>
.panicbar {
  position: relative;
  width: 170px;
  height: 14px;
  border-radius: 7px;
  background: #1b2b3a;
  overflow: hidden;
  border: 1px solid #0006;
}
.fill { height: 100%; background: linear-gradient(90deg, #4fa6c7, #e8a33d); transition: width 0.3s ease; }
.next {
  position: absolute;
  top: 0;
  bottom: 0;
  background: repeating-linear-gradient(135deg, rgb(232 163 61 / 0.45) 0 4px, transparent 4px 8px);
  transition: left 0.3s ease, width 0.3s ease;
}
.label {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 0.66rem;
  font-weight: 700;
  white-space: nowrap;
  text-shadow: 0 1px 2px #000;
}
</style>
