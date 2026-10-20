<script setup lang="ts">
import { computed } from 'vue';
import GameIcon from './GameIcon.vue';
import type { IntentKind, IntentPreview } from '../engine';
import { t, type TextKey } from './i18n';

/**
 * What the creature will do next. Four chips, one per thing a move can do, each with a minimal
 * tooltip of its own; the move's name (hover) still tells the whole story.
 */
const props = defineProps<{ intent: IntentPreview }>();

const KIND_SHAPES: Record<IntentKind, string> = { attack: 'bite1', pull: 'excape1', defend: 'arrow-up-green', buff: 'arrow-up-green', debuff: 'arrow-down-red' };
/** Each chip says what it does, in as few words as possible. */
const KIND_TIPS: Record<IntentKind, TextKey> = {
  attack: 'intent.strikeTip',
  pull: 'intent.pullTip',
  defend: 'intent.buffTip',
  buff: 'intent.buffTip',
  debuff: 'intent.debuffTip',
};

/** The arrows also say exactly what the move does to the creature or to the player. */
function kindTip(kind: IntentKind) {
  const body = kind === 'debuff' ? props.intent.debuffText : kind === 'defend' || kind === 'buff' ? props.intent.buffText : undefined;
  return body ? { title: t(KIND_TIPS[kind]), body } : t(KIND_TIPS[kind]);
}

/** Defends and buffs share the one green arrow. */
const shownKinds = computed(() => {
  const seen = new Set<string>();
  return props.intent.kinds.filter((k) => (seen.has(KIND_SHAPES[k]) ? false : seen.add(KIND_SHAPES[k])));
});

/** The move's values as written; the bars show what gets past the player's Hold. */
const damage = computed(() => {
  const { damage: value, hits } = props.intent;
  if (value === undefined) return undefined;
  return hits && hits > 1 ? `${value}×${hits}` : `${value}`;
});

const TAG_NAMES = { strike: t('intent.strike'), pull: t('intent.pull'), secondWind: t('intent.secondWind') } as const;
/** The move's own tooltip: what its role and its special do, then its rules. */
const body = computed(() => {
  const { role, special, description, delayed } = props.intent;
  const roleText = delayed ? t('intent.delayed', { move: delayed }) : role && role !== 'special' ? t(`intent.role.${role}` as TextKey) : '';
  const specialText = special ? t(`intent.special.${special.key}` as TextKey, { card: special.card ?? '' }) : '';
  return [roleText, specialText, description].filter(Boolean).join(' ');
});
</script>

<template>
  <div v-if="intent.hidden" v-tip="t('intent.hidden')" class="intent">
    <div class="icons"><span class="icon hidden"><GameIcon icon="question-mark" /></span></div>
  </div>
  <div v-else v-tip="{ title: intent.moveName, detail: TAG_NAMES[intent.tag], body }" class="intent">
    <div class="icons">
      <span v-for="kind in shownKinds" :key="kind" v-tip="kindTip(kind)" class="icon" :class="kind">
        <GameIcon :icon="KIND_SHAPES[kind]" />
        <b v-if="kind === 'attack' && damage">{{ damage }}</b>
        <b v-else-if="kind === 'pull' && intent.pull !== undefined">{{ intent.pull }}</b>
        <b v-else-if="kind === 'defend' && intent.block">{{ intent.block }}</b>
      </span>
    </div>
    <div class="move">
      <span class="tag" :class="intent.tag">{{ TAG_NAMES[intent.tag] }}</span> {{ intent.moveName }}<span v-if="intent.delayed" class="delayed"> → {{ intent.delayed }}</span>
    </div>
  </div>
</template>

<style scoped>
/* The three lines of the intent get air between them; the badge also clears the Will bar below. */
.intent { display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: help; margin-bottom: 8px; }
.icons { display: flex; align-items: center; gap: 4px; }
.icon {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border-radius: 12px;
  background: #2a2d36;
  font-size: 1rem;
}
.icon .game-icon { width: 35px; height: 35px; }
.icon b { font-size: 1.5rem; }
/* Red for the Strike, the Will bar's teal for the Pull, green up and red down for the rest —
   each shape also tells its kind apart on its own. */
.icon.attack { background: #4d1d24; color: #ff8177; }
.icon.pull { background: #12333e; color: #4fc3d9; }
.icon.defend, .icon.buff { background: #234a2e; color: #7ee08a; }
.icon.debuff { background: #4a2347; color: #e78b96; }
.icon.hidden { background: #333; color: #aaa; }
/* On a dark pill, so it reads over any ground or water behind the creature. */
.move { padding: 2px 8px 2px 3px; border-radius: 8px; background: rgb(10 14 20 / 0.72); font-size: 0.78rem; font-weight: 600; color: var(--text); }
.tag { padding: 0 5px; border-radius: 6px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: #fff; }
.tag.strike { background: #8a2f36; }
.tag.pull { background: #2a6b6b; }
.tag.secondWind { background: #6a3f8a; }
.delayed { color: var(--muted); font-weight: 500; }
/* Small screens: tighter chips, and a move name that wraps rather than overflowing. */
@media (max-width: 700px), (max-height: 500px) {
  .icon { padding: 2px 6px; }
  .icon b { font-size: 1.5rem; }
  .intent { gap: 3px; margin-bottom: 5px; }
  .move { font-size: 0.7rem; max-width: 190px; text-align: center; line-height: 1.25; }
}
</style>
