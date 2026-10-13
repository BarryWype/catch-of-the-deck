<script setup lang="ts">
import { computed } from 'vue';
import { creatureTypeNames, type Discovery, type GameData } from '../engine';
import { t } from './i18n';
import SideDrawer from './SideDrawer.vue';
import SpriteView from './SpriteView.vue';

/**
 * A 📖 tab on the right edge that opens a drawer listing every creature in the game.
 * Creatures never encountered show as a question mark.
 */
const props = defineProps<{
  data: GameData;
  homeAquarium: string[];
  discovered: Readonly<Record<string, Discovery>>;
}>();

const tagNames = computed(() => creatureTypeNames(props.data));

/** Every creature, in sprite-sheet order, with how far the player got with it and how many are at home. */
const creatures = computed(() => {
  const owned = new Map<string, number>();
  for (const id of props.homeAquarium) owned.set(id, (owned.get(id) ?? 0) + 1);
  return Object.values(props.data.enemies)
    .filter((e) => e.sprite)
    .sort((a, b) => a.sprite!.index - b.sprite!.index)
    .map((e) => ({
      id: e.id,
      name: e.name,
      sprite: e.sprite!,
      type: e.tags?.map((t) => tagNames.value[t] ?? t).join(', ') ?? '',
      owned: owned.get(e.id) ?? 0,
      status: props.discovered[e.id],
    }));
});
const discoveredCount = computed(() => creatures.value.filter((c) => c.status).length);

</script>

<template>
  <SideDrawer icon="📖" :title="t('book.title')">
    <template #header>
      <span class="total">{{ t('book.discovered', { n: discoveredCount, total: creatures.length }) }}</span>
    </template>
    <ul class="grid">
      <li
        v-for="c in creatures"
        :key="c.id"
        class="creature"
        :class="c.status"
        v-tip="c.status ? { title: c.name, detail: c.type } : undefined"
      >
        <template v-if="c.status">
          <SpriteView :sprite="c.sprite" :size="64" />
          <span class="status">{{ c.status === 'captured' ? t('book.captured') : t('book.seen') }}</span>
          <span v-if="c.owned" v-tip="t('book.owned', { n: c.owned })" class="owned">×{{ c.owned }}</span>
        </template>
        <template v-else>
          <span class="unknown" :aria-label="t('book.notEncountered')">?</span>
          <span class="status">{{ t('book.unknown') }}</span>
        </template>
      </li>
    </ul>
  </SideDrawer>
</template>

<style scoped>
.total { color: var(--muted); font-size: 0.85rem; }

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: 10px;
  margin: 0;
  padding: 16px;
  list-style: none;
}
.creature {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 6px;
  border-radius: 10px;
  background: rgb(255 255 255 / 0.04);
  text-align: center;
}
.unknown {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  font-size: 2.4rem;
  font-weight: 800;
  color: var(--muted);
  opacity: 0.5;
}
.status { font-size: 0.7rem; font-weight: 600; color: var(--muted); }
.captured .status { color: #7fd18f; }
.owned {
  position: absolute;
  top: 4px;
  right: 4px;
  padding: 0 5px;
  border-radius: 8px;
  background: #2f5a3a;
  font-size: 0.7rem;
  font-weight: 700;
}
</style>
