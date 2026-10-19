<script setup lang="ts">
import KeywordText from './KeywordText.vue';
import { computed } from 'vue';
import { bonusEffects, describeCompanionEffect, FULL_SCHOOL, type CatchSize, type Discovery, type GameData } from '../engine';
import { t } from './i18n';
import SideDrawer from './SideDrawer.vue';
import SpriteView from './SpriteView.vue';

/**
 * A 📖 tab on the right edge that opens a drawer listing every creature in the game, grouped by
 * temperament, each group headed by the bonus its creatures give as companions.
 * Creatures never encountered show as a question mark.
 */
const props = defineProps<{
  data: GameData;
  homeAquarium: string[];
  discovered: Readonly<Record<string, Discovery>>;
  /** The biggest of each species ever caught. */
  biggest: Readonly<Record<string, CatchSize>>;
}>();

/** A mark per size on the book's entries. */
const SIZE_MARK: Record<CatchSize, string> = { small: 'S', normal: 'M', large: 'L', trophy: '🏆' };

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
      owned: owned.get(e.id) ?? 0,
      status: props.discovered[e.id],
      biggest: props.biggest[e.id],
    }));
});
const discoveredCount = computed(() => creatures.value.filter((c) => c.status).length);

/** The creatures by temperament, in the companion bonuses' order, each with its bonus at 1★ and its full school. */
const groups = computed(() =>
  Object.values(props.data.companionBonuses)
    .map((def) => ({
      def,
      creatures: creatures.value.filter((c) => props.data.enemies[c.id]?.temperament === def.id),
      oneStar: bonusEffects(def, 1, 1).map(describeCompanionEffect).join(' '),
      fullSchool: def.fullSchool.map(describeCompanionEffect).join(' '),
    }))
    .filter((g) => g.creatures.length),
);

</script>

<template>
  <SideDrawer icon="📖" :title="t('book.title')">
    <template #header>
      <span class="total">{{ t('book.discovered', { n: discoveredCount, total: creatures.length }) }}</span>
    </template>
    <!-- Collapsed by default: only the temperament shows; its bonus and creatures open with a click. -->
    <details v-for="g in groups" :key="g.def.id" class="group">
      <summary class="bonus">
        <h3>
          <span class="chevron" aria-hidden="true">▸</span>
          <span class="icon" aria-hidden="true">{{ g.def.icon }}</span>
          <span class="name">{{ g.def.temperamentName }} · {{ g.def.name }}</span>
          <span class="count">{{ g.creatures.filter((c) => c.status).length }}/{{ g.creatures.length }}</span>
        </h3>
      </summary>
      <div class="rules">
        <p><KeywordText :text="t('book.oneStar', { rule: g.oneStar })" /></p>
        <p v-if="g.fullSchool"><KeywordText :text="t('book.fullSchool', { n: FULL_SCHOOL, rule: g.fullSchool })" /></p>
      </div>
      <ul class="grid">
        <li
          v-for="c in g.creatures"
          :key="c.id"
          class="creature"
          :class="c.status"
          v-tip="c.status ? c.name : undefined"
        >
          <template v-if="c.status">
            <SpriteView :sprite="c.sprite" :size="64" />
            <span class="status">{{ c.status === 'captured' ? t('book.captured') : t('book.seen') }}</span>
            <span v-if="c.owned" v-tip="t('book.owned', { n: c.owned })" class="owned">×{{ c.owned }}</span>
            <span
              v-if="c.biggest"
              v-tip="t('book.biggest', { size: t(`size.${c.biggest}`) })"
              class="biggest"
              :class="c.biggest"
              :aria-label="t('book.biggest', { size: t(`size.${c.biggest}`) })"
            >
              {{ SIZE_MARK[c.biggest] }}
            </span>
          </template>
          <template v-else>
            <span class="unknown" :aria-label="t('book.notEncountered')">?</span>
            <span class="status">{{ t('book.unknown') }}</span>
          </template>
        </li>
      </ul>
    </details>
  </SideDrawer>
</template>

<style scoped>
.total { color: var(--muted); font-size: 0.85rem; }

.group { padding: 8px 16px 0; }
.bonus { padding: 8px 10px; border-radius: 10px; background: rgb(255 255 255 / 0.06); cursor: pointer; list-style: none; }
.bonus::-webkit-details-marker { display: none; }
.chevron { display: inline-block; color: var(--muted); transition: rotate 0.15s; }
.group[open] .chevron { rotate: 90deg; }
@media (hover: hover) {
  .bonus:hover { background: rgb(255 255 255 / 0.1); }
}
.bonus h3 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 0.95rem; }
.bonus .icon { font-size: 1.8rem; line-height: 1; }
.bonus .name { flex: 1; }
.bonus .count { color: var(--muted); font-size: 0.75rem; font-weight: 600; }
.rules { margin-top: 8px; padding: 6px 10px; border-left: 3px solid #f2c94c; border-radius: 6px; background: rgb(242 201 76 / 0.08); }
.rules p { margin: 2px 0; color: #f3e3b0; font-size: 0.8rem; line-height: 1.35; }
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: 10px;
  margin: 0;
  padding: 10px 0;
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
.biggest {
  position: absolute;
  top: 4px;
  left: 4px;
  min-width: 18px;
  padding: 0 4px;
  border-radius: 8px;
  background: #2c3a4a;
  font-size: 0.7rem;
  font-weight: 700;
}
.biggest.large { background: #3b5f8a; }
.biggest.trophy { background: #8a6a1f; }
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
