<script setup lang="ts">
import { computed } from 'vue';
import { isAlive, PLAYER_ID, type Combatant, type FamilyDef, type IntentPreview, type SpriteRef } from '../engine';
import type { TipValue } from './tooltip';
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
    /** Hover text over the creature, e.g. its move set (see CombatView's `creatureTip`). */
    tip?: TipValue;
    /** The creature's families, shown as icons next to its name (engine: `creatureFamilies`). */
    families?: FamilyDef[];
    /**
     * Escape bar, for creatures. `pull` is its upcoming move's Pull, before the player's Hold;
     * `after` / `end` its preview (PanicBar).
     */
    escapeBar?: { escape: number; escapeAt: number; escapeRate: number; pull?: number; after?: number; end?: number };
    /** Health after the card being played and after the creatures' moves, and Block after the card (HealthBar). */
    healthPreview?: { after: number; end: number; blockAfter: number };
    /**
     * Sprite frame multiplier: the player is 4, creatures 5, mini-bosses and bosses 6. Animated
     * frames are 48px and static cells 32px, and sizes stay whole multiples of them, so the pixel
     * art stays crisp. Compact screens use two frames less.
     */
    frame?: number;
    /** The sprite only: the player's Grit and statuses are in the battlefield's corner panel instead. */
    bare?: boolean;
  }>(),
  { clip: undefined, animationKey: 0, sprite: undefined, intent: null, families: () => [], tip: undefined, escapeBar: undefined, healthPreview: undefined, frame: 4, bare: false },
);
defineEmits<{ select: []; animationDone: [] }>();
const compact = useMedia(COMPACT_QUERY);
const frames = computed(() => (compact.value ? Math.max(2, props.frame - 2) : props.frame));
/** The animated art is drawn into size x size frames; the static sprite, the portrait box and
 * the emoji fallback follow the same scale. */
const animatedSize = computed(() => frames.value * 48);
const stillSize = computed(() => frames.value * 32);
const portraitStyle = computed(() => ({
  minHeight: `${stillSize.value}px`,
  fontSize: `${frames.value}rem`,
}));
</script>

<template>
  <div class="combatant" :class="{ dead: !isAlive(combatant), animated: !!clip, targetable }" @click="$emit('select')">
    <!-- A creature shows what it will do above its head; the player has no intent. -->
    <div v-if="intent || escapeBar" class="intent-slot">
      <IntentBadge v-if="intent && isAlive(combatant)" :intent="intent" />
    </div>
    <!-- Everything about it in one block above the sprite, the bars the same width: its name and
         families (hover: the family's name), its Will, its health, then its statuses. -->
    <div v-if="!bare" class="hud">
      <div v-if="combatant.id !== PLAYER_ID" class="name">
        {{ combatant.name }}
        <span v-for="f in families" :key="f.id" v-tip="f.name" class="family" aria-hidden="true">{{ f.icon }}</span>
      </div>
      <PanicBar v-if="escapeBar" v-bind="escapeBar" />
      <HealthBar
        :hp="combatant.hp"
        :max-hp="combatant.maxHp"
        :block="combatant.block"
        :grit="combatant.id === PLAYER_ID"
        :after="healthPreview?.after"
        :end="healthPreview?.end"
        :block-after="healthPreview?.blockAfter"
      />
      <StatusList :statuses="combatant.statuses" />
    </div>
    <div v-tip="tip" class="portrait" :class="{ player: combatant.id === PLAYER_ID }" :style="portraitStyle">
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
/* The fisherman's art stands slightly right of the centre of its frame (creatures sit centred),
   so his shadow is centred under him rather than under the frame. */
.portrait.player::after { left: 25%; }
.hud { display: flex; flex-direction: column; align-items: stretch; gap: 4px; width: 210px; }
/* A dark backing, so the bars and text stay readable over the scene behind (seaweed, sand). */
.combatant:not(:has(.portrait.player)) .hud { padding: 6px 8px; border-radius: 10px; background: rgb(8 14 22 / 0.6); }
.name { display: flex; align-items: center; justify-content: center; gap: 6px; font-weight: 700; }
.family { font-size: 0.9rem; cursor: help; }
.dead { opacity: 0.35; filter: grayscale(1); }
/* Animated combatants show their capture/defeat animation instead of fading out. */
.dead.animated { opacity: 1; filter: none; }
.dead.animated > :not(.portrait) { opacity: 0.35; }
.targetable { cursor: crosshair; }
/* Small screens: less room around a smaller creature. */
@media (max-width: 700px), (max-height: 500px) {
  .combatant { padding: 4px 6px; gap: 3px; }
  .intent-slot { min-height: 36px; }
  .hud { width: 150px; gap: 3px; }
}
</style>
