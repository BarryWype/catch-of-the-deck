<script setup lang="ts">
import { computed } from 'vue';
import { isAlive, PLAYER_ID, type Combatant, type IntentPreview, type SpriteRef } from '../engine';
import AnimatedSprite from './AnimatedSprite.vue';
import HealthBar from './HealthBar.vue';
import IntentBadge from './IntentBadge.vue';
import SpriteView from './SpriteView.vue';
import PanicBar from './PanicBar.vue';
import StatusList from './StatusList.vue';
import type { AnimationClip } from './sprites';
import { COMPACT_QUERY, useMedia } from './useScreen';

const props = withDefaults(
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
    /** Artwork scale: creatures are 1.2, mini-bosses and bosses 1.3; the player stays at 1. */
    scale?: number;
  }>(),
  { clip: undefined, animationKey: 0, sprite: undefined, intent: null, subtitle: undefined, escapeBar: undefined, scale: 1 },
);
defineEmits<{ select: []; animationDone: [] }>();
const compact = useMedia(COMPACT_QUERY);
/** The animated art is drawn into size x size frames; the static sprite, the portrait box and
 * the emoji fallback follow the same scale. */
const animatedSize = computed(() => Math.round((compact.value ? 100 : 168) * props.scale));
const stillSize = computed(() => Math.round((compact.value ? 84 : 128) * props.scale));
const portraitStyle = computed(() => ({
  minHeight: `${stillSize.value}px`,
  fontSize: `${(compact.value ? 3 : 4.5) * props.scale}rem`,
}));
</script>

<template>
  <div class="combatant" :class="{ dead: !isAlive(combatant), animated: !!clip, targetable }" @click="$emit('select')">
    <div class="intent-slot">
      <IntentBadge v-if="intent && isAlive(combatant)" :intent="intent" />
    </div>
    <!-- A creature's health bar sits above its sprite, its Will bar under its name; the player's
         Grit bar stays under the name. -->
    <HealthBar v-if="combatant.id !== PLAYER_ID" :hp="combatant.hp" :max-hp="combatant.maxHp" :block="combatant.block" />
    <div class="portrait" :style="portraitStyle">
      <AnimatedSprite
        v-if="clip"
        :clip="clip"
        :play-key="animationKey"
        :size="animatedSize"
        :aria-label="combatant.name"
        @done="$emit('animationDone')"
      />
      <SpriteView v-else-if="sprite" :sprite="sprite" :size="stillSize" :aria-label="combatant.name" />
      <span v-else>{{ portrait }}</span>
    </div>
    <div class="name">{{ combatant.name }}</div>
    <div v-if="subtitle" class="subtitle">{{ subtitle }}</div>
    <PanicBar v-if="escapeBar" v-bind="escapeBar" />
    <HealthBar v-if="combatant.id === PLAYER_ID" :hp="combatant.hp" :max-hp="combatant.maxHp" :block="combatant.block" grit />
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
  position: relative;
}
/* The target highlight sits on its own layer and fades in, so only opacity animates. */
.combatant::before {
  content: '';
  position: absolute;
  inset: -2px;
  border: 2px solid var(--highlight);
  border-radius: inherit;
  background: rgb(255 255 255 / 0.04);
  opacity: 0;
  transition: opacity 0.12s ease;
  pointer-events: none;
}
.targetable::before { opacity: 1; }
@media (hover: hover) {
  .targetable:hover::before { background: rgb(255 255 255 / 0.09); }
}
.intent-slot { min-height: 44px; display: flex; align-items: flex-end; }
.portrait {
  display: grid;
  place-items: center;
  min-height: 128px;
  font-size: 4.5rem;
  line-height: 1;
  position: relative;
  isolation: isolate;
}
/* A still shadow on the ground under the creature: a drop-shadow filter around an animated
   sprite would be redrawn on every frame. */
.portrait::after {
  content: '';
  position: absolute;
  bottom: 6px;
  left: 20%;
  z-index: -1;
  width: 60%;
  height: 14px;
  border-radius: 50%;
  background: radial-gradient(ellipse, rgb(0 0 0 / 0.45), transparent 70%);
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
/* Air between the creature's name block and its Will bar. */
.panicbar { margin-top: 8px; }
.dead { opacity: 0.35; filter: grayscale(1); }
/* Animated combatants show their capture/defeat animation instead of fading out. */
.dead.animated { opacity: 1; filter: none; }
.dead.animated > :not(.portrait) { opacity: 0.35; }
.targetable { cursor: crosshair; }
/* Small screens: less room around a smaller creature. */
@media (max-width: 700px), (max-height: 500px) {
  .combatant { padding: 4px 6px; gap: 3px; }
  .intent-slot { min-height: 36px; }
  .portrait { min-height: 84px; font-size: 3rem; }
}
</style>
