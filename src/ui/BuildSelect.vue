<script setup lang="ts">
import GameIcon from './GameIcon.vue';
import { computed, ref } from 'vue';
import { creatureTypeNames, describeCard, type BuildDef, type GameData } from '../engine';
import CardView from './CardView.vue';
import { t } from './i18n';
import SpriteView from './SpriteView.vue';

/** The whole screen: the builds a run can start with (the unlocked ones), each with its details and starting items. */
const props = defineProps<{ builds: BuildDef[]; data: GameData }>();
const emit = defineEmits<{ choose: [buildId: string, itemId: string | undefined]; back: [] }>();

const tagNames = computed(() => creatureTypeNames(props.data));

/** The starting item picked under each build (its first one until the player picks). */
const picked = ref<Record<string, string | undefined>>({});
const itemOf = (build: BuildDef) => picked.value[build.id] ?? build.startingItems?.[0];

/** The starter deck as distinct cards with counts, in deck order. */
function deckSummary(build: BuildDef) {
  const counts = new Map<string, number>();
  for (const id of build.starterDeck) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts].map(([id, count]) => ({ card: props.data.cards[id], count }));
}
</script>

<template>
  <section class="build-select">
    <header class="intro">
      <button class="ghost back" @click="emit('back')">{{ t('common.back') }}</button>
      <h2>{{ t('build.title') }}</h2>
      <p>{{ t('build.intro') }}</p>
    </header>

    <div class="builds">
      <article v-for="build in builds" :key="build.id" class="build" :aria-labelledby="`build-${build.id}`">
        <header>
          <SpriteView v-if="build.sprite" :sprite="build.sprite" :size="88" class="icon" />
          <div>
            <h3 :id="`build-${build.id}`">{{ build.name }}</h3>
            <p class="description">{{ build.description }}</p>
          </div>
        </header>

        <div class="strong">
          <span class="label">{{ t('build.strongAgainst') }}</span>
          <span v-for="tag in build.strongAgainst" :key="tag" class="chip">{{ tagNames[tag] ?? tag }}</span>
        </div>

        <h4>{{ t('build.starterDeck', { n: build.starterDeck.length }) }}</h4>
        <div class="deck">
          <div v-for="{ card, count } in deckSummary(build)" :key="card.id" class="deck-card">
            <CardView :card="card" :description="describeCard(card, { tagNames })" />
            <span class="count">×{{ count }}</span>
          </div>
        </div>

        <template v-if="build.startingItems?.length">
          <h4>{{ t('build.startingItem') }}</h4>
          <div class="items" role="radiogroup" :aria-label="t('build.startingItemOf', { build: build.name })">
            <label v-for="id in build.startingItems" :key="id" class="item" :class="{ selected: itemOf(build) === id }">
              <input type="radio" :name="`item-${build.id}`" :value="id" :checked="itemOf(build) === id" @change="picked[build.id] = id" />
              <span class="item-icon"><GameIcon :icon="data.equipment[id]?.icon ?? '🎒'" /></span>
              <span>
                <b>{{ data.equipment[id]?.name }}</b>
                <small>{{ data.equipment[id]?.description }}</small>
              </span>
            </label>
          </div>
        </template>

        <button class="choose" @click="emit('choose', build.id, itemOf(build))">
          {{ t('build.fishWith', { build: build.name }) }}<template v-if="itemOf(build)"> + {{ data.equipment[itemOf(build)!]?.name }}</template>
        </button>
      </article>
    </div>
  </section>
</template>

<style scoped>
.build-select { display: flex; flex-direction: column; gap: 16px; padding: 12px 0 24px; }
.intro { position: relative; text-align: center; }
.back { position: absolute; top: 0; left: 0; }
.intro h2 { margin: 0; font-size: 1.8rem; }
.intro p { margin: 4px 0 0; color: var(--muted); }
@media (max-width: 700px) {
  .back { position: static; display: block; margin-bottom: 8px; }
}

.builds { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 440px), 1fr)); gap: 20px; }
.build {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px 20px;
  border: 2px solid #2c3a4a;
  border-radius: 16px;
  background: linear-gradient(180deg, #1f3448, #17283a);
}
.build header { display: flex; gap: 14px; align-items: center; }
.build h3 { margin: 0; font-size: 1.4rem; }
.build h4 { margin: 6px 0 0; font-size: 0.8rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
.description { margin: 4px 0 0; color: var(--muted); }
.icon { flex: none; filter: drop-shadow(0 4px 6px rgb(0 0 0 / 0.5)); }

.strong { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.label { font-size: 0.8rem; color: var(--muted); }
.chip { padding: 2px 10px; border-radius: 10px; background: #2f5a3a; font-size: 0.8rem; font-weight: 600; }

.deck { display: flex; gap: 10px; flex-wrap: wrap; }
.deck-card { position: relative; }
.deck-card :deep(.card) { cursor: default; }
.deck-card :deep(.card:hover) { transform: none; }
.count {
  position: absolute;
  top: -8px;
  right: -6px;
  padding: 0 6px;
  border-radius: 8px;
  background: var(--panel);
  font-weight: 800;
}

.items { display: flex; flex-direction: column; gap: 6px; }
.item {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 8px 12px;
  border: 2px solid #2c3a4a;
  border-radius: 10px;
  background: rgb(0 0 0 / 0.15);
  cursor: pointer;
}
.item:hover { border-color: #4a5a6a; }
.item.selected { border-color: var(--highlight); background: rgb(245 215 110 / 0.08); }
.item:has(input:focus-visible) { outline: 2px solid var(--highlight); outline-offset: 2px; }
.item input { position: absolute; opacity: 0; pointer-events: none; }
.item-icon { font-size: 1.5rem; line-height: 1; }
.item b { display: block; }
.item small { color: var(--muted); font-size: 0.8rem; }

.choose { margin-top: auto; padding: 12px; font-size: 1rem; }
</style>
