<script setup lang="ts">
import { computed, ref } from 'vue';
import { bondLevel, bondToFull, describeCompanionEffect, MAX_BOND_LEVEL, type GameData, type Habitat } from '../engine';
import AnimatedSprite from './AnimatedSprite.vue';
import ParticleCanvas from './ParticleCanvas.vue';
import SpriteView from './SpriteView.vue';
import { animatedSheetFor, creatureClip } from './sprites';

const props = withDefaults(
  defineProps<{
    /** Creature ids to show (a run's bucket, or the home aquarium). */
    creatures: string[];
    data: GameData;
    /** Header, e.g. "Bucket" or "Home aquarium". */
    title?: string;
    icon?: string;
    /** False: just to look at, creatures can't be clicked. */
    interactive?: boolean;
    /** What clicking a creature offers: selling it, or bringing it for the session. */
    action?: 'sell' | 'bring';
    /** Why bringing is unavailable right now (e.g. all slots taken), if it is. */
    bringBlocked?: string;
    /**
     * In a run's bucket: the first this-many creatures were brought from home and give their bonus;
     * the rest were caught and are angry. Omit outside a run.
     */
    companions?: number;
    /** Bond points of each creature, in the same order (home aquarium, or a bucket's companions). */
    bonds?: number[];
  }>(),
  { interactive: true, title: 'Aquarium', icon: '🐠', action: 'sell', bringBlocked: undefined, companions: undefined, bonds: undefined },
);
const emit = defineEmits<{ sell: [slot: number]; bring: [slot: number] }>();

const SIZE = 96;

/** Stable pseudo-random number in [0, 1) per (creature slot, channel), so fish keep their lanes. */
function rand(slot: number, channel: number) {
  const x = Math.sin(slot * 127.1 + channel * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Stable number per string, so a fish keeps its lane when others are sold. */
function hash(text: string) {
  let h = 0;
  for (const char of text) h = (h * 31 + char.charCodeAt(0)) % 10007;
  return h;
}

function placement(habitat: Habitat, slot: number) {
  const duration =
    habitat === 'bottom' ? 30 + rand(slot, 1) * 25 : habitat === 'drift' ? 22 + rand(slot, 1) * 14 : 12 + rand(slot, 1) * 12;
  const vertical =
    habitat === 'bottom'
      ? { bottom: `${2 + rand(slot, 2) * 4}%` }
      : { top: `${(habitat === 'drift' ? 6 : 10) + rand(slot, 2) * (habitat === 'drift' ? 30 : 48)}%` };
  return {
    ...vertical,
    '--duration': `${duration.toFixed(1)}s`,
    // A negative delay starts each creature mid-swim, at a different spot.
    '--delay': `-${(rand(slot, 3) * duration * 2).toFixed(1)}s`,
    '--bob': `${(3 + rand(slot, 4) * 3).toFixed(1)}s`,
    '--rest': `${(rand(slot, 5) * 85).toFixed(1)}%`,
    zIndex: habitat === 'bottom' ? 3 : 2,
  };
}

const residents = computed(() => {
  const copies = new Map<string, number>();
  return props.creatures.map((id, slot) => {
    const def = props.data.enemies[id];
    const habitat = def?.habitat ?? 'swim';
    const copy = copies.get(id) ?? 0;
    copies.set(id, copy + 1);
    const key = `${id}#${copy}`;
    return {
      key,
      slot,
      name: def?.name ?? id,
      sellValue: def?.sellValue ?? 0,
      habitat,
      url: def?.sprite ? animatedSheetFor(def.sprite) : undefined,
      sprite: def?.sprite,
      portrait: def?.portrait ?? '🐟',
      style: placement(habitat, hash(key)),
      bonus: def?.temperament ? props.data.companionBonuses[def.temperament] : undefined,
      angry: props.companions !== undefined && slot >= props.companions,
      bond: bondOf(id, props.bonds?.[slot]),
    };
  });
});

/** Bond level and progress, or undefined when this aquarium doesn't track bonds. */
function bondOf(id: string, points: number | undefined) {
  if (points === undefined) return undefined;
  const level = bondLevel({ id, bond: points }, props.data);
  const text = `Bond level ${level}${level === MAX_BOND_LEVEL ? ' (fully bonded)' : ''} · ${points}/${bondToFull(id, props.data)}`;
  return { level, text };
}

type Resident = (typeof residents.value)[number];

/** Hover text for a creature: its name, then its sell value, mood and bond. */
function residentTip(r: Resident) {
  const detail = [
    props.interactive && props.action === 'sell' ? `Sells for 🪙 ${r.sellValue}` : '',
    r.angry ? '💢 Angry' : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return { title: r.name, detail: detail || undefined, body: r.bond ? `♥ ${r.bond.text}` : undefined };
}

const selectedKey = ref<string | null>(null);
const selected = computed(() => residents.value.find((r) => r.key === selectedKey.value));

function act() {
  if (!selected.value) return;
  if (props.action === 'sell') emit('sell', selected.value.slot);
  else emit('bring', selected.value.slot);
  selectedKey.value = null;
}

// Decoration: seaweed from objects.png (1 green algae, 2 red algae, 3 seaweed). Bubbles are drawn on a canvas.
const plants = [
  { index: 3, left: '4%', size: 96, delay: '0s' },
  { index: 1, left: '15%', size: 72, delay: '-1.2s' },
  { index: 2, left: '47%', size: 80, delay: '-2.1s' },
  { index: 3, left: '78%', size: 88, delay: '-0.6s' },
  { index: 1, left: '90%', size: 64, delay: '-1.7s' },
];
</script>

<template>
  <section class="aquarium" :aria-label="title">
    <header class="label">
      <span>{{ icon }} {{ title }}</span>
      <span class="count">{{ creatures.length }} caught</span>
    </header>

    <div class="tank">
      <div class="surface" />
      <div class="rays" />
      <ParticleCanvas effect="bubbles" />

      <div class="sand" />
      <div
        v-for="(p, i) in plants"
        :key="`p${i}`"
        class="plant"
        :style="{ left: p.left, animationDelay: p.delay }"
      >
        <SpriteView :sprite="{ sheet: 'objects', index: p.index }" :size="p.size" />
      </div>

      <!-- The lane spans the tank minus one creature and slides by its own width (transform only);
           the creature sits at its left edge. -->
      <div
        v-for="r in residents"
        :key="r.key"
        class="resident"
        :class="[r.habitat, { selected: r.key === selectedKey, interactive }]"
        :style="r.style"
      >
        <div
          class="fish"
          v-tip="residentTip(r)"
          :role="interactive ? 'button' : undefined"
          :tabindex="interactive ? 0 : undefined"
          @click="interactive && (selectedKey = r.key)"
          @keydown.enter="interactive && (selectedKey = r.key)"
        >
          <div class="bob">
            <AnimatedSprite v-if="r.url" :clip="creatureClip(r.url, 'idle')" :size="SIZE" />
            <SpriteView v-else-if="r.sprite" :sprite="r.sprite" :size="SIZE * (2 / 3)" />
            <span v-else class="emoji">{{ r.portrait }}</span>
          </div>
          <!-- Outside .bob, which mirrors the sprite, so the badges read the right way. -->
          <span v-if="r.angry" class="angry" aria-hidden="true">💢</span>
          <span v-else-if="r.bond?.level" class="bond" :class="{ full: r.bond.level === MAX_BOND_LEVEL }" aria-hidden="true">
            ♥{{ r.bond.level }}
          </span>
        </div>
      </div>

      <div v-if="selected" class="sell-panel" @keydown.esc="selectedKey = null">
        <strong>{{ selected.name }}</strong>
        <span v-if="selected.bond" class="bond-text">♥ {{ selected.bond.text }}</span>
        <template v-if="action === 'sell'">
          <span v-if="selected.angry" class="mood">💢 Angry: caught this run, no bonus</span>
          <span v-else-if="companions !== undefined && selected.bonus" class="mood">
            {{ selected.bonus.icon }} Companion: gives {{ selected.bonus.name }} (selling it ends that)
          </span>
          <span class="sell-value">🪙 {{ selected.sellValue }}</span>
          <div class="actions">
            <button @click="act">Sell</button>
            <button class="ghost" @click="selectedKey = null">Keep</button>
          </div>
        </template>
        <template v-else>
          <div v-if="selected.bonus" class="bonus">
            <b>{{ selected.bonus.icon }} {{ selected.bonus.name }}</b> · {{ selected.bonus.temperamentName }}
            <p v-for="(effect, i) in selected.bonus.effects" :key="i">{{ describeCompanionEffect(effect) }}</p>
          </div>
          <div class="actions">
            <button v-tip="bringBlocked" :disabled="!!bringBlocked" @click="act">Bring for the session</button>
            <button class="ghost" @click="selectedKey = null">Cancel</button>
          </div>
          <span v-if="bringBlocked" class="blocked">{{ bringBlocked }}</span>
        </template>
      </div>

      <p v-if="!creatures.length" class="empty">Nothing in here yet. Catch something!</p>
      <div class="glare" />
    </div>
  </section>
</template>

<style scoped>
.aquarium { display: flex; flex-direction: column; gap: 6px; min-height: 220px; }
.label { display: flex; justify-content: space-between; font-weight: 700; padding: 0 4px; }
.count { color: var(--muted); font-weight: 500; }

.tank {
  --size: 96px;
  position: relative;
  flex: 1;
  overflow: hidden;
  border: 6px solid #5c6b78;
  border-top-width: 10px;
  border-radius: 10px 10px 14px 14px;
  background: linear-gradient(180deg, #4fa6c7 0%, #2b7fa8 30%, #1d5f86 70%, #164a6b 100%);
  box-shadow: inset 0 0 40px rgb(0 0 0 / 0.35), 0 8px 18px rgb(0 0 0 / 0.4);
}

/* Water line just under the rim. */
.surface {
  position: absolute;
  inset: 0 0 auto;
  height: 10px;
  background: linear-gradient(180deg, rgb(255 255 255 / 0.35), transparent);
}
.rays {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(105deg, rgb(255 255 255 / 0.06) 0 40px, transparent 40px 110px);
  animation: rays 12s ease-in-out infinite alternate;
}
.glare {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(120deg, rgb(255 255 255 / 0.12) 0%, transparent 25%, transparent 75%, rgb(255 255 255 / 0.05) 100%);
  z-index: 5;
}
.sand {
  position: absolute;
  inset: auto 0 0;
  height: 14%;
  min-height: 26px;
  background:
    radial-gradient(ellipse 60% 60% at 30% 0%, #e2c98f 0 40%, transparent 41%),
    radial-gradient(ellipse 50% 70% at 80% 10%, #d8bd80 0 40%, transparent 41%),
    linear-gradient(180deg, #d4b679, #b8975a);
  z-index: 1;
}

.plant {
  position: absolute;
  bottom: 4%;
  transform-origin: 50% 100%;
  animation: sway 4s ease-in-out infinite alternate;
  z-index: 1;
}

/* Residents: the outer element travels left/right, and `.bob` both flips the sprite in sync
   (sprites face left; `scale`) and adds a little vertical life (`translate`). */
.resident {
  position: absolute;
  left: 0;
  width: calc(100% - var(--size));
  pointer-events: none;
  animation: travel var(--duration) ease-in-out var(--delay) infinite alternate;
}
.fish { position: relative; width: var(--size); pointer-events: auto; }
.bob {
  animation:
    face calc(var(--duration) * 2) linear var(--delay) infinite,
    bob var(--bob) ease-in-out infinite alternate;
}
.drift .bob {
  animation:
    face calc(var(--duration) * 2) linear var(--delay) infinite,
    drift calc(var(--bob) * 2) ease-in-out infinite alternate;
}
.bottom .bob { animation: face calc(var(--duration) * 2) linear var(--delay) infinite; }
.emoji { font-size: 3rem; }

.resident.interactive .fish { cursor: pointer; }
.fish:focus { outline: none; }
.resident.interactive .fish:hover .bob,
.resident.interactive .fish:focus-visible .bob { filter: drop-shadow(0 0 4px rgb(255 255 255 / 0.7)); }
.resident.selected .bob { filter: drop-shadow(0 0 6px var(--highlight)); }

.sell-panel {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 6;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 14px;
  border-radius: 10px;
  background: rgb(20 24 32 / 0.9);
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.4);
}
.sell-panel .sell-value { color: var(--energy); font-weight: 700; }
.sell-panel { max-width: 260px; text-align: center; }
.sell-panel .bonus { font-size: 0.78rem; }
.sell-panel .bonus p, .sell-panel .mood { margin: 2px 0 0; color: var(--muted); font-size: 0.75rem; }
.bond {
  position: absolute;
  top: -2px;
  right: 14px;
  padding: 0 5px;
  border-radius: 8px;
  background: rgb(201 74 120 / 0.85);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
  pointer-events: none;
}
.bond.full { background: #d9a520; }
.sell-panel .bond-text { color: #f08bb0; font-size: 0.75rem; }
.angry { position: absolute; top: -4px; right: 18px; font-size: 1rem; pointer-events: none; }
.sell-panel .blocked { color: var(--muted); font-size: 0.75rem; }
.sell-panel .actions { display: flex; gap: 6px; margin-top: 4px; }

.empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  margin: 0;
  color: rgb(255 255 255 / 0.7);
  font-style: italic;
  z-index: 4;
}

@keyframes travel {
  from { transform: translateX(0); }
  to { transform: translateX(100%); }
}
@keyframes face {
  0%, 49.99% { scale: -1 1; }
  50%, 100% { scale: 1 1; }
}
@keyframes bob {
  from { translate: 0 -4px; }
  to { translate: 0 4px; }
}
@keyframes drift {
  from { translate: 0 -28px; }
  to { translate: 0 28px; }
}
@keyframes sway {
  from { transform: rotate(-4deg); }
  to { transform: rotate(4deg); }
}
@keyframes rays {
  from { transform: translateX(-30px); }
  to { transform: translateX(30px); }
}

@media (prefers-reduced-motion: reduce) {
  .resident, .bob, .plant, .rays { animation: none; }
  .resident { transform: translateX(var(--rest)); }
}
</style>
