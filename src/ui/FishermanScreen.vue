<script setup lang="ts">
import { computed } from 'vue';
import { describeQuest, questProgress, type GameData } from '../engine';
import AnimatedSprite from './AnimatedSprite.vue';
import GameIcon from './GameIcon.vue';
import { t } from './i18n';
import { characterClip } from './sprites';

/**
 * Meeting a fisherman on the map: who he is, the build he teaches, and his quest. Progress counts
 * `creatures`: the home aquarium and the bucket, as they'd be if the run ended well now.
 */
const props = defineProps<{ fishermanId: string; data: GameData; creatures: { id: string }[]; unlocked: string[] }>();
const emit = defineEmits<{ leave: [] }>();

const fisherman = computed(() => props.data.fishermen[props.fishermanId]);
const clip = computed(() => characterClip(fisherman.value?.sprite));
const quests = computed(() =>
  Object.values(props.data.builds)
    .filter((b) => b.unlock?.fisherman === props.fishermanId && !props.unlocked.includes(b.id))
    .map((b) => ({ build: b, quest: b.unlock!, ...questProgress(b.unlock!.quest, props.creatures, props.data) })),
);
</script>

<template>
  <section class="fisherman">
    <div class="portrait">
      <AnimatedSprite v-if="clip" :clip="clip" :size="144" :aria-label="fisherman?.name" />
      <GameIcon v-else :icon="fisherman?.icon ?? '🎣'" />
    </div>
    <h2>{{ fisherman?.name }}</h2>
    <p class="greeting">“{{ fisherman?.greeting }}”</p>
    <article v-for="q in quests" :key="q.build.id" class="quest">
      <h3>{{ t('fisherman.questTitle', { name: q.quest.name }) }}</h3>
      <p>{{ t('fisherman.wants', { quest: describeQuest(q.quest.quest, data) }) }}</p>
      <p class="progress" :class="{ ready: q.have >= q.need }">
        {{ q.have >= q.need ? t('fisherman.ready') : t('fisherman.progress', { have: q.have, need: q.need }) }}
      </p>
      <p class="rule">{{ t('fisherman.rule', { build: q.build.name }) }}</p>
    </article>
    <button @click="emit('leave')">{{ t('fisherman.leave') }}</button>
  </section>
</template>

<style scoped>
.fisherman { display: flex; flex-direction: column; align-items: center; gap: 10px; max-width: 560px; margin: 0 auto; padding: 6vh 0 24px; text-align: center; }
.fisherman h2 { margin: 0; }
.portrait { display: grid; place-items: center; width: 144px; height: 144px; font-size: 4rem; overflow: hidden; }
.greeting { margin: 0; font-style: italic; color: var(--muted); }
.quest {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid rgb(245 215 110 / 0.35);
  border-radius: 12px;
  background: linear-gradient(180deg, #26304a, #1c2334);
  text-align: left;
}
.quest h3 { margin: 0 0 6px; font-size: 1rem; color: var(--highlight); }
.quest p { margin: 4px 0 0; }
.progress { font-weight: 700; }
.progress.ready { color: #7fd99a; }
.rule { font-size: 0.85rem; color: var(--muted); }
button { margin-top: 6px; padding: 12px 24px; }
</style>
