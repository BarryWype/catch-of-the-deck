<script setup lang="ts">
import { computed } from 'vue';
import { describeEventEffect, eventChoiceBlocked, type GameData, type RunState } from '../engine';

const props = defineProps<{ eventId: string; run: RunState; data: GameData }>();
const emit = defineEmits<{ choose: [choiceIndex: number] }>();

const event = computed(() => props.data.events[props.eventId]);
const choices = computed(() =>
  event.value.choices.map((choice) => ({
    label: choice.label,
    text: choice.effects.map((e) => describeEventEffect(e, props.run, props.data)).join(' ') || 'Nothing happens.',
    blocked: eventChoiceBlocked(choice, props.run),
  })),
);
</script>

<template>
  <section class="event">
    <div class="icon">{{ event.icon ?? '❓' }}</div>
    <h2>{{ event.name }}</h2>
    <p class="description">{{ event.description }}</p>
    <div class="choices">
      <button
        v-for="(choice, i) in choices"
        :key="i"
        class="choice"
        :disabled="!!choice.blocked"
        v-tip="choice.blocked"
        @click="emit('choose', i)"
      >
        <strong>{{ choice.label }}</strong>
        <span>{{ choice.blocked ?? choice.text }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.event { display: flex; flex-direction: column; align-items: center; gap: 10px; max-width: 560px; margin: 0 auto; padding-top: 10vh; text-align: center; }
.event h2 { margin: 0; }
.icon { font-size: 4rem; line-height: 1; }
.description { margin: 0 0 12px; color: var(--muted); }
.choices { display: flex; flex-direction: column; gap: 10px; width: 100%; }
.choice { display: flex; flex-direction: column; gap: 2px; padding: 12px 16px; text-align: left; }
.choice span { font-weight: 400; font-size: 0.9rem; opacity: 0.85; }
</style>
