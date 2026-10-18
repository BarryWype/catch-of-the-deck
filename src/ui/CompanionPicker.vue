<script setup lang="ts">
import KeywordText from './KeywordText.vue';
import { computed, ref } from 'vue';
import { activeBonuses, bondLevel, bonusEffects, companionStars, describeCompanionEffect, FULL_SCHOOL, MAX_BOND_LEVEL, type GameData, type HomeCreature } from '../engine';
import SpriteView from './SpriteView.vue';
import { t } from './i18n';

/**
 * A dialog listing the home aquarium by temperament, to pick one companion. Each temperament shows
 * its bonus (at the stars already brought, or 1★) and each creature the stars it would add: a
 * species already brought counts once, with its best stars.
 */
const props = defineProps<{ creatures: HomeCreature[]; brought: HomeCreature[]; data: GameData }>();
const emit = defineEmits<{ pick: [slot: number] }>();

const dialog = ref<HTMLDialogElement>();
/** The temperament shown, or null for all of them. */
const filter = ref<string | null>(null);

const groups = computed(() => {
  const active = new Map(activeBonuses(props.brought, props.data).map((b) => [b.def.id, b]));
  const broughtStars = new Map<string, number>();
  for (const c of props.brought) broughtStars.set(c.id, Math.max(broughtStars.get(c.id) ?? 0, companionStars(c, props.data)));
  return Object.values(props.data.companionBonuses)
    .map((def) => {
      const bonus = active.get(def.id);
      const creatures = props.creatures
        .map((c, slot) => ({ c, slot, def: props.data.enemies[c.id] }))
        .filter(({ def: e }) => e?.temperament === def.id)
        .map(({ c, slot, def: e }) => {
          const stars = companionStars(c, props.data);
          const level = bondLevel(c, props.data);
          return {
            slot,
            key: `${c.id}#${slot}`,
            name: e.name,
            sprite: e.sprite,
            portrait: e.portrait ?? '🐟',
            size: c.size,
            stars,
            gain: Math.max(0, stars - (broughtStars.get(c.id) ?? 0)),
            alreadyBrought: broughtStars.has(c.id),
            bond: level,
            fullBond: level === MAX_BOND_LEVEL,
          };
        })
        .sort((a, b) => b.gain - a.gain || b.stars - a.stars || a.name.localeCompare(b.name));
      return {
        def,
        creatures,
        bonus,
        rule: bonusEffects(def, Math.max(1, bonus?.stars ?? 0), bonus?.species ?? 0).map(describeCompanionEffect).join(' '),
        fullSchool: bonus && bonus.species >= FULL_SCHOOL ? '' : def.fullSchool.map(describeCompanionEffect).join(' '),
      };
    })
    .filter((g) => g.creatures.length);
});

const shown = computed(() => groups.value.filter((g) => !filter.value || g.def.id === filter.value));

function open() {
  if (!groups.value.some((g) => g.def.id === filter.value)) filter.value = null;
  dialog.value?.showModal();
}

function pick(slot: number) {
  dialog.value?.close();
  emit('pick', slot);
}

defineExpose({ open });
</script>

<template>
  <dialog ref="dialog" class="confirm picker" :aria-label="t('picker.title')" @click="$event.target === dialog && dialog?.close()">
    <h3>{{ t('picker.title') }}</h3>
    <div class="filters" role="group" :aria-label="t('picker.filter')">
      <button class="chip" :class="{ on: !filter }" :aria-pressed="!filter" @click="filter = null">
        {{ t('picker.all') }} <span class="n">{{ creatures.length }}</span>
      </button>
      <button
        v-for="g in groups"
        :key="g.def.id"
        class="chip"
        :class="{ on: filter === g.def.id, active: g.bonus }"
        :aria-pressed="filter === g.def.id"
        @click="filter = g.def.id"
      >
        {{ g.def.icon }} {{ g.def.temperamentName }} <span class="n">{{ g.creatures.length }}</span>
      </button>
    </div>

    <div class="list">
      <section v-for="g in shown" :key="g.def.id" class="group">
        <header class="bonus">
          <span class="icon" aria-hidden="true">{{ g.def.icon }}</span>
          <div class="about">
            <h4>
              {{ g.def.temperamentName }} · {{ g.def.name }}
              <span v-if="g.bonus" class="brought">{{ t('picker.brought', { stars: g.bonus.stars, n: g.bonus.species, full: FULL_SCHOOL }) }}</span>
            </h4>
            <p><KeywordText :text="t(g.bonus ? 'picker.now' : 'picker.oneStar', { rule: g.rule })" /></p>
            <p v-if="g.fullSchool"><KeywordText :text="t('book.fullSchool', { n: FULL_SCHOOL, rule: g.fullSchool })" /></p>
          </div>
        </header>
        <ul class="grid">
          <li v-for="c in g.creatures" :key="c.key">
            <button class="creature" :class="{ dim: !c.gain }" @click="pick(c.slot)">
              <SpriteView v-if="c.sprite" :sprite="c.sprite" :size="56" />
              <span v-else class="emoji">{{ c.portrait }}</span>
              <span class="name">{{ c.name }}</span>
              <span class="meta">
                <span class="stars">★{{ c.stars }}</span>
                <span v-if="c.bond" class="bond" :class="{ full: c.fullBond }">♥{{ c.bond }}</span>
                <span class="size">{{ t(`size.${c.size}`) }}</span>
              </span>
              <span v-if="c.alreadyBrought" class="gain" :class="{ none: !c.gain }">
                {{ c.gain ? t('picker.gain', { n: c.gain }) : t('picker.sameSpecies') }}
              </span>
            </button>
          </li>
        </ul>
      </section>
    </div>

    <footer>
      <button class="ghost" autofocus @click="dialog?.close()">{{ t('common.close') }}</button>
    </footer>
  </dialog>
</template>

<style scoped>
.picker { width: min(760px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); }
.picker[open] { display: flex; flex-direction: column; }
.filters { display: flex; flex: none; flex-wrap: wrap; gap: 6px; padding-bottom: 10px; }
.chip {
  padding: 4px 10px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgb(255 255 255 / 0.05);
  color: var(--text);
  font-size: 0.8rem;
  white-space: nowrap;
}
.chip .n { color: var(--muted); font-size: 0.72rem; }
.chip.active { border-color: #f2c94c; }
.chip.on { background: var(--highlight); color: #10161f; }
.chip.on .n { color: inherit; }

.list { display: flex; flex-direction: column; gap: 12px; min-height: 0; overflow-y: auto; }
.bonus { display: flex; gap: 10px; align-items: flex-start; padding: 6px 10px; border-left: 3px solid #f2c94c; border-radius: 6px; background: rgb(242 201 76 / 0.08); }
.bonus .icon { font-size: 1.8rem; line-height: 1; }
.bonus h4 { margin: 0; font-size: 0.95rem; }
.bonus .brought { margin-left: 6px; color: #f2c94c; font-size: 0.75rem; font-weight: 600; }
.bonus p { margin: 2px 0 0; color: #f3e3b0; font-size: 0.8rem; line-height: 1.35; }
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: 8px;
  margin: 0;
  padding: 8px 0 0;
  list-style: none;
}
.creature {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 100%;
  height: 100%;
  padding: 8px 6px;
  border: 2px solid #2c3a4a;
  border-radius: 10px;
  background: linear-gradient(180deg, #1f3448, #17283a);
  color: var(--text);
  text-align: center;
}
@media (hover: hover) {
  .creature:hover { border-color: var(--highlight); }
  .chip:not(.on):hover { background: rgb(255 255 255 / 0.12); }
}
.creature.dim { opacity: 0.7; }
.emoji { font-size: 2.4rem; line-height: 56px; }
.name { font-size: 0.8rem; font-weight: 600; line-height: 1.15; }
.meta { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; font-size: 0.72rem; }
.stars { color: #f2c94c; font-weight: 700; }
.bond { color: #f08bb0; font-weight: 700; }
.bond.full { color: #d9a520; }
.size { color: var(--muted); }
.gain { color: #7fd18f; font-size: 0.7rem; font-weight: 600; }
.gain.none { color: var(--muted); }

/* Small screens: the filters scroll sideways on one line instead of taking half the dialog. */
@media (max-width: 700px), (max-height: 500px) {
  .picker { padding: 14px 14px; }
  .filters { flex-wrap: nowrap; overflow-x: auto; }
  .grid { grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); }
}
</style>
