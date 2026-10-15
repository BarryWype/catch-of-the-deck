<script setup lang="ts">
import { computed } from 'vue';
import type { IntentKind, IntentPreview, MoveTag } from '../engine';
import { t } from './i18n';

const props = defineProps<{ intent: IntentPreview }>();

const ICONS: Record<IntentKind, string> = { attack: '🗡️', pull: '🎣', defend: '🛡️', buff: '💪', debuff: '🌀', rest: '💤', feed: '🍤', windUp: '⚠️' };
const TAG_NAMES: Record<MoveTag, string> = {
  strike: t('intent.strike'),
  pull: t('intent.pull'),
  rest: t('intent.rest'),
  feed: t('intent.feed'),
  windUp: t('intent.windUp'),
  guard: t('intent.guard'),
  buff: t('intent.buff'),
};
/** What a quiet move means, in its tooltip. */
const hint = computed(() => (props.intent.tag === 'strike' || props.intent.tag === 'pull' ? '' : t(`intent.hint.${props.intent.tag}`)));
const damageText = computed(() => {
  const { damage, hits } = props.intent;
  if (damage === undefined) return '';
  return hits && hits > 1 ? `${damage}×${hits}` : `${damage}`;
});
</script>

<template>
  <div v-tip="{ title: intent.moveName, detail: TAG_NAMES[intent.tag], body: [hint, intent.description].filter(Boolean).join(' ') }" class="intent">
    <div class="icons">
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
.tag.rest, .tag.feed, .tag.guard, .tag.buff { background: #3a4a3a; }
.tag.windUp { background: #8a6a1f; }
.icon.rest, .icon.feed { background: #2e3a46; }
.icon.windUp { background: #5a4a1a; }
</style>
