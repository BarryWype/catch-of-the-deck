<script setup lang="ts">
import { isAlive, PLAYER_ID, type Combatant, type IntentPreview, type SpriteRef } from '../engine';
import AnimatedSprite from './AnimatedSprite.vue';
import HealthBar from './HealthBar.vue';
import IntentBadge from './IntentBadge.vue';
import SpriteView from './SpriteView.vue';
import PanicBar from './PanicBar.vue';
import StatusList from './StatusList.vue';
import type { AnimationClip } from './sprites';

withDefaults(
  defineProps<{
    combatant: Combatant;
    portrait: string;
    /** Animated art; falls back to the static `sprite`, then the emoji `portrait`. */
    clip?: AnimationClip;
    /** Bump to replay the same clip. */
    animationKey?: number;
    sprite?: SpriteRef;
    intent?: IntentPreview | null;
    targetable?: boolean;
    /** Small line under the name, e.g. the creature type. */
    subtitle?: string;
    /** Escape bar, for creatures. */
    escapeBar?: { escape: number; escapeAt: number; escapeRate: number };
  }>(),
  { clip: undefined, animationKey: 0, sprite: undefined, intent: null, subtitle: undefined, escapeBar: undefined },
);
defineEmits<{ select: []; animationDone: [] }>();
</script>

<template>
  <div class="combatant" :class="{ dead: !isAlive(combatant), animated: !!clip, targetable }" @click="$emit('select')">
    <div class="intent-slot">
      <IntentBadge v-if="intent && isAlive(combatant)" :intent="intent" />
    </div>
    <div class="portrait">
      <AnimatedSprite
        v-if="clip"
        :clip="clip"
        :play-key="animationKey"
        :size="168"
        :aria-label="combatant.name"
        @done="$emit('animationDone')"
      />
      <SpriteView v-else-if="sprite" :sprite="sprite" :size="128" :aria-label="combatant.name" />
      <span v-else>{{ portrait }}</span>
    </div>
    <div class="name">{{ combatant.name }}</div>
    <div v-if="subtitle" class="subtitle">{{ subtitle }}</div>
    <PanicBar v-if="escapeBar" v-bind="escapeBar" />
    <HealthBar :hp="combatant.hp" :max-hp="combatant.maxHp" :block="combatant.block" :grit="combatant.id === PLAYER_ID" />
    <StatusList :statuses="combatant.statuses" />
  </div>
</template>

<style scoped>
.combatant {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  border-radius: 14px;
  border: 2px solid transparent;
  transition: border-color 0.12s ease, background 0.12s ease;
}
.intent-slot { min-height: 44px; display: flex; align-items: flex-end; }
.portrait {
  display: grid;
  place-items: center;
  min-height: 128px;
  font-size: 4.5rem;
  line-height: 1;
  filter: drop-shadow(0 6px 6px rgb(0 0 0 / 0.5));
}
.name { font-weight: 700; }
.subtitle {
  margin-top: -4px;
  padding: 0 8px;
  border-radius: 8px;
  background: rgb(0 0 0 / 0.3);
  font-size: 0.72rem;
  color: var(--muted);
  letter-spacing: 0.03em;
}
.dead { opacity: 0.35; filter: grayscale(1); }
/* Animated combatants show their capture/defeat animation instead of fading out. */
.dead.animated { opacity: 1; filter: none; }
.dead.animated > :not(.portrait) { opacity: 0.35; }
.targetable { cursor: crosshair; border-color: var(--highlight); background: rgb(255 255 255 / 0.04); }
.targetable:hover { background: rgb(255 255 255 / 0.09); }
</style>
