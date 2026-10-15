<script setup lang="ts">
import { computed } from 'vue';
import type { IntentKind, IntentPreview, MoveRole } from '../engine';
import { t, type TextKey } from './i18n';

const props = defineProps<{ intent: IntentPreview }>();

const ICONS: Record<IntentKind, string> = { attack: '🗡️', pull: '🎣', defend: '🛡️', buff: '💪', debuff: '🌀' };
const ROLE_ICONS: Partial<Record<MoveRole, string>> = { pace: '💤', windUp: '⚠️', heavy: '💥' };
/** Each special's icon (`IntentPreview.special.key`). */
const SPECIAL_ICONS: Record<string, string> = {
  ink: '🦑',
  junk: '🗑️',
  steal: '🫳',
  shake: '🪝',
  secondWind: '🌬️',
  venom: '☠️',
  tangled: '🪢',
  numbFingers: '🥶',
  pinchedHand: '🤏',
  skittish: '😬',
  spines: '🦔',
  burrowed: '🕳️',
  baitGrabbed: '🎣',
};
const TAG_NAMES = { strike: t('intent.strike'), pull: t('intent.pull'), secondWind: t('intent.secondWind') } as const;
const damageText = computed(() => {
  const { damage, hits } = props.intent;
  if (damage === undefined) return '';
  return hits && hits > 1 ? `${damage}×${hits}` : `${damage}`;
});
const roleIcon = computed(() => (props.intent.role ? ROLE_ICONS[props.intent.role] : undefined));
const specialIcon = computed(() => (props.intent.special ? SPECIAL_ICONS[props.intent.special.key] : undefined));
/** The tooltip: what its role and its special do, then its rules. */
const body = computed(() => {
  const { role, special, description } = props.intent;
  const roleText = role && role !== 'special' ? t(`intent.role.${role}` as TextKey) : '';
  const specialText = special ? t(`intent.special.${special.key}` as TextKey, { card: special.card ?? '' }) : '';
  return [roleText, specialText, description].filter(Boolean).join(' ');
});
</script>

<template>
  <div v-if="intent.hidden" v-tip="t('intent.hidden')" class="intent">
    <div class="icons"><span class="icon hidden">❓</span></div>
    <div class="move">?</div>
  </div>
  <div v-else v-tip="{ title: intent.moveName, detail: TAG_NAMES[intent.tag], body }" class="intent">
    <div class="icons">
      <span v-if="roleIcon" class="icon role" :class="intent.role">{{ roleIcon }}</span>
      <span v-if="specialIcon" class="icon special">{{ specialIcon }}</span>
      <span v-for="kind in intent.kinds" :key="kind" class="icon" :class="kind">
        {{ ICONS[kind] }}<b v-if="kind === 'attack'">{{ damageText }}</b><b v-else-if="kind === 'pull'">{{ intent.pull }}</b>
      </span>
    </div>
    <div class="move"><span class="tag" :class="intent.tag">{{ TAG_NAMES[intent.tag] }}</span> {{ intent.moveName }}</div>
  </div>
</template>

<style scoped>
.intent { display: flex; flex-direction: column; align-items: center; cursor: help; }
.icons { display: flex; gap: 4px; }
.icon {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 8px;
  border-radius: 12px;
  background: #2a2d36;
  font-size: 1rem;
}
.icon.attack { background: #5a2028; }
.icon.defend { background: #1f3f5a; }
.icon.buff { background: #234a2e; }
.icon.debuff { background: #4a2347; }
.move { font-size: 0.7rem; color: var(--muted); }
.icon.pull { background: #1f4a4a; }
.tag { padding: 0 5px; border-radius: 6px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: #fff; }
.tag.strike { background: #8a2f36; }
.tag.pull { background: #2a6b6b; }
.tag.secondWind { background: #6a3f8a; }
.icon.special { background: #4a3a5a; }
.icon.role.pace { background: #2e3a46; }
.icon.role.windUp { background: #5a4a1a; }
.icon.role.heavy { background: #7a2a1a; }
.icon.hidden { background: #333; }
</style>
