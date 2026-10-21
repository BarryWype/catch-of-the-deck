<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import {
  CATCH_SIZES,
  MAX_BOND_LEVEL,
  parseScenario,
  SESSION_SLOTS,
  STORE_KINDS,
  validateScenario,
  type Catch,
  type DebugCreature,
  type DebugError,
  type DebugScenario,
  type DebugStart,
  type GameData,
  type StoreKind,
} from '../engine';
import { t, type TextKey } from './i18n';
import { deleteScenario, saveScenario, savedScenarios } from './debugStore';
import { readFeatures, writeFeatures } from './featureStore';

/**
 * The debug drawer's content on the menu (see README → Debug panel): a scenario to set up, save,
 * copy or paste, and start in the sandbox. Quick presets start each age's mini-boss or boss.
 */
const props = defineProps<{ data: GameData }>();
const emit = defineEmits<{ play: [DebugScenario] }>();

/** Where a scenario can start; each store is its own entry, started as `{ type: 'shop', store }`. */
const START_TYPES = ['creature', 'encounter', 'miniBoss', 'boss', 'event', 'cafe', 'tackle', 'bait', 'treasure', 'fisherman'] as const;
type StartType = (typeof START_TYPES)[number];
const isStore = (type: string): type is StoreKind => (STORE_KINDS as readonly string[]).includes(type);
const BONDS = Array.from({ length: MAX_BOND_LEVEL + 1 }, (_, i) => i);

const byName = <T extends { name: string }>(list: T[]) => [...list].sort((a, b) => a.name.localeCompare(b.name));
const builds = computed(() => Object.values(props.data.builds));
const creatures = computed(() => byName(Object.values(props.data.enemies)));
const encounters = computed(() => byName(props.data.encounters));
const events = computed(() => byName(Object.values(props.data.events).filter((e) => !e.treasure)));
const fishermen = computed(() => Object.values(props.data.fishermen));
/** The choices for the start's id, when its type needs one. */
const startIds = computed(() => {
  const type = startType.value;
  if (type === 'creature') return creatures.value;
  if (type === 'encounter') return encounters.value.map((e) => ({ id: e.id, name: `${e.name} (${e.enemies.length})` }));
  if (type === 'event') return events.value;
  if (type === 'fisherman') return fishermen.value;
  return [];
});

/** The fight-variety features: changing one saves it and reloads the game. */
const features = readFeatures();
const featureIds = Object.keys(features) as (keyof typeof features)[];
const setAllFeatures = (on: boolean) => writeFeatures(Object.fromEntries(featureIds.map((id) => [id, on])) as unknown as typeof features);

const randomSeed = () => Math.floor(Math.random() * 1_000_000);
const firstCreature = () => creatures.value[0]?.id ?? '';

const draft = reactive({
  seed: randomSeed(),
  build: builds.value[0]?.id ?? '',
  level: 0,
  fights: 0,
  /** Empty: full Grit. */
  hp: '' as number | '',
  coins: 0,
  rerolls: 1,
  companions: [] as DebugCreature[],
  bucket: [] as Catch[],
  deck: [...(builds.value[0]?.starterDeck ?? [])],
  hand: [] as string[],
  useProfile: false,
  unlocked: [] as string[],
  fishermenMet: [] as string[],
  home: [] as DebugCreature[],
  shells: 0,
  progression: [] as string[],
});
const startType = ref<StartType>('creature');
const startId = ref(firstCreature());

/** A new build starts from its own starter deck. */
function setBuild(id: string) {
  draft.build = id;
  resetDeck();
}
function resetDeck() {
  draft.deck = [...(props.data.builds[draft.build]?.starterDeck ?? [])];
  draft.hand = [];
}

function scenario(): DebugScenario {
  const type = startType.value;
  const start = (
    isStore(type)
      ? { type: 'shop', store: type }
      : ['creature', 'encounter', 'event', 'fisherman'].includes(type)
        ? { type, id: startId.value }
        : { type }
  ) as DebugStart;
  return {
    seed: draft.seed,
    build: draft.build,
    level: draft.level,
    fights: draft.fights,
    ...(draft.hp === '' ? {} : { hp: draft.hp }),
    coins: draft.coins,
    rerolls: draft.rerolls,
    companions: draft.companions.map((c) => ({ ...c })),
    bucket: draft.bucket.map((c) => ({ ...c })),
    deck: [...draft.deck],
    ...(draft.hand.length ? { hand: [...draft.hand] } : {}),
    start,
    ...(draft.useProfile
      ? {
          profile: {
            unlocked: [...draft.unlocked],
            fishermenMet: [...draft.fishermenMet],
            home: draft.home.map((c) => ({ ...c })),
            shells: draft.shells,
            progression: [...draft.progression],
          },
        }
      : {}),
  };
}

/** Fill the form from a scenario that passed `validateScenario`. */
function load(s: DebugScenario) {
  Object.assign(draft, {
    seed: s.seed ?? 1,
    build: s.build,
    level: s.level,
    fights: s.fights ?? 0,
    hp: s.hp ?? '',
    coins: s.coins ?? 0,
    rerolls: s.rerolls ?? 1,
    companions: (s.companions ?? []).map((c) => ({ ...c })),
    bucket: (s.bucket ?? []).map((c) => ({ ...c })),
    deck: [...(s.deck ?? props.data.builds[s.build].starterDeck)],
    hand: [...(s.hand ?? [])],
    useProfile: !!s.profile,
    unlocked: [...(s.profile?.unlocked ?? [])],
    fishermenMet: [...(s.profile?.fishermenMet ?? [])],
    home: (s.profile?.home ?? []).map((c) => ({ ...c })),
    shells: s.profile?.shells ?? 0,
    progression: [...(s.profile?.progression ?? [])],
  });
  startType.value = s.start.type === 'shop' ? (s.start.store ?? 'tackle') : s.start.type;
  startId.value = 'id' in s.start ? s.start.id : '';
}

const error = ref<DebugError | null>(null);
const message = ref('');
const errorText = computed(() => error.value && t(`debug.error.${error.value.code}` as TextKey, { detail: error.value.detail }));

function play(s: DebugScenario) {
  error.value = validateScenario(s, props.data);
  if (!error.value) emit('play', s);
}

/** The old shortcuts: a fresh run with the first build, straight into an age's mini-boss or boss. */
const presets = computed(() =>
  props.data.levels.flatMap((_, level) => [
    { level, type: 'miniBoss' as const, label: t('debug.miniBoss', { n: level + 1 }) },
    { level, type: 'boss' as const, label: t('debug.boss', { n: level + 1 }) },
  ]),
);
function playPreset(level: number, type: 'miniBoss' | 'boss') {
  play({ seed: randomSeed(), build: builds.value[0].id, level, start: { type } });
}

// The deck: search every card by name or family to add it.
const search = ref('');
const cardMatches = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return [];
  return byName(Object.values(props.data.cards))
    .filter((c) => c.name.toLowerCase().includes(q) || (c.family && (props.data.families[c.family]?.name ?? c.family).toLowerCase().includes(q)))
    .slice(0, 30);
});
const cardName = (id: string) => props.data.cards[id]?.name ?? id;
const familyName = (id: string) => {
  const family = props.data.cards[id]?.family;
  return family ? (props.data.families[family]?.name ?? family) : '';
};
const count = (list: string[], id: string) => list.filter((x) => x === id).length;
function addToHand(index: number) {
  const id = draft.deck[index];
  if (count(draft.hand, id) < count(draft.deck, id)) draft.hand.push(id);
}
function removeFromDeck(index: number) {
  const [id] = draft.deck.splice(index, 1);
  if (count(draft.hand, id) > count(draft.deck, id)) draft.hand.splice(draft.hand.lastIndexOf(id), 1);
}

function toggle(list: string[], id: string, on: boolean) {
  const index = list.indexOf(id);
  if (on && index < 0) list.push(id);
  if (!on && index >= 0) list.splice(index, 1);
}

// Saved scenarios, and JSON in and out.
const name = ref('');
const pasted = ref('');
function save() {
  const n = name.value.trim();
  if (!n) return;
  saveScenario(n, scenario());
  message.value = t('debug.saved', { name: n });
}
function loadSaved(n: string) {
  const s = savedScenarios.value[n];
  error.value = validateScenario(s, props.data);
  if (error.value) return;
  load(s);
  name.value = n;
  message.value = t('debug.loaded', { name: n });
}
async function copy() {
  const json = JSON.stringify(scenario(), null, 2);
  try {
    await navigator.clipboard.writeText(json);
    message.value = t('debug.copied');
  } catch {
    // No clipboard access: the JSON goes in the box, to copy by hand.
    pasted.value = json;
    message.value = t('debug.copyFailed');
  }
}
function applyPasted() {
  const result = parseScenario(pasted.value, props.data);
  if ('error' in result) {
    error.value = result.error;
    return;
  }
  error.value = null;
  load(result.scenario);
  message.value = t('debug.pasted');
}
</script>

<template>
  <div class="debug-tools">
    <p class="hint">{{ t('debug.hint') }}</p>
    <section>
      <h3>{{ t('debug.features') }}</h3>
      <p class="hint">{{ t('debug.featuresHint') }}</p>
      <label v-for="id in featureIds" :key="id" class="check">
        <input type="checkbox" :checked="features[id]" @change="writeFeatures({ ...features, [id]: ($event.target as HTMLInputElement).checked })" />
        {{ t(`debug.feature.${id}`) }}
      </label>
      <div class="presets">
        <button class="ghost" @click="setAllFeatures(true)">{{ t('debug.allOn') }}</button>
        <button class="ghost" @click="setAllFeatures(false)">{{ t('debug.allOff') }}</button>
      </div>
    </section>
    <section>
      <h3>{{ t('debug.presets') }}</h3>
      <div class="presets">
        <button v-for="p in presets" :key="p.label" class="ghost" @click="playPreset(p.level, p.type)">{{ p.label }}</button>
      </div>
    </section>

    <section>
      <h3>{{ t('debug.run') }}</h3>
      <div class="grid">
        <label>{{ t('debug.build') }}
          <select :value="draft.build" @change="setBuild(($event.target as HTMLSelectElement).value)">
            <option v-for="b in builds" :key="b.id" :value="b.id">{{ b.name }}{{ b.unlock ? ` 🔒` : '' }}</option>
          </select>
        </label>
        <label>{{ t('debug.age') }}
          <select v-model.number="draft.level">
            <option v-for="(l, i) in data.levels" :key="l.id" :value="i">{{ l.name }}</option>
          </select>
        </label>
        <label>{{ t('debug.fights') }}<input v-model.number="draft.fights" type="number" min="0" /></label>
        <label>{{ t('debug.grit') }}<input v-model.number="draft.hp" type="number" min="1" :placeholder="t('debug.full')" /></label>
        <label>{{ t('debug.coins') }}<input v-model.number="draft.coins" type="number" min="0" /></label>
        <label>{{ t('debug.rerolls') }}<input v-model.number="draft.rerolls" type="number" min="0" /></label>
        <label>{{ t('debug.seed') }}
          <span class="row"><input v-model.number="draft.seed" type="number" min="0" /><button class="ghost" :aria-label="t('debug.randomSeed')" @click="draft.seed = randomSeed()">🎲</button></span>
        </label>
      </div>
    </section>

    <section>
      <h3>{{ t('debug.start') }}</h3>
      <div class="grid">
        <label>{{ t('debug.startType') }}
          <select v-model="startType" @change="startId = startIds[0]?.id ?? ''">
            <option v-for="type in START_TYPES" :key="type" :value="type">{{ t(`debug.startTypes.${type}`) }}</option>
          </select>
        </label>
        <label v-if="startIds.length">{{ t('debug.which') }}
          <select v-model="startId">
            <option v-for="o in startIds" :key="o.id" :value="o.id">{{ o.name }}</option>
          </select>
        </label>
      </div>
    </section>

    <section>
      <h3>{{ t('debug.companions', { n: draft.companions.length, max: SESSION_SLOTS }) }}</h3>
      <div v-for="(c, i) in draft.companions" :key="i" class="row creature">
        <select v-model="c.id" :aria-label="t('debug.creature')"><option v-for="e in creatures" :key="e.id" :value="e.id">{{ e.name }}</option></select>
        <select v-model.number="c.bond" :aria-label="t('debug.bond')"><option v-for="b in BONDS" :key="b" :value="b">{{ t('debug.bondLevel', { n: b }) }}</option></select>
        <select v-model="c.size" :aria-label="t('debug.size')"><option v-for="s in CATCH_SIZES" :key="s" :value="s">{{ t(`size.${s}`) }}</option></select>
        <button class="ghost" :aria-label="t('debug.remove')" @click="draft.companions.splice(i, 1)">✕</button>
      </div>
      <button class="ghost" :disabled="draft.companions.length >= SESSION_SLOTS" @click="draft.companions.push({ id: firstCreature(), bond: 0, size: 'normal' })">+ {{ t('debug.addCompanion') }}</button>
    </section>

    <section>
      <h3>{{ t('debug.bucket', { n: draft.bucket.length }) }}</h3>
      <div v-for="(c, i) in draft.bucket" :key="i" class="row creature">
        <select v-model="c.id" :aria-label="t('debug.creature')"><option v-for="e in creatures" :key="e.id" :value="e.id">{{ e.name }}</option></select>
        <select v-model="c.size" :aria-label="t('debug.size')"><option v-for="s in CATCH_SIZES" :key="s" :value="s">{{ t(`size.${s}`) }}</option></select>
        <button class="ghost" :aria-label="t('debug.remove')" @click="draft.bucket.splice(i, 1)">✕</button>
      </div>
      <button class="ghost" @click="draft.bucket.push({ id: firstCreature(), size: 'normal' })">+ {{ t('debug.addCatch') }}</button>
    </section>

    <section>
      <h3>{{ t('debug.deck', { n: draft.deck.length }) }} <button class="ghost small" @click="resetDeck">{{ t('debug.resetDeck') }}</button></h3>
      <ul class="chips">
        <li v-for="(id, i) in draft.deck" :key="i">
          <span>{{ cardName(id) }}</span>
          <button class="ghost" :aria-label="t('debug.toHand', { card: cardName(id) })" v-tip="t('debug.toHand', { card: cardName(id) })" @click="addToHand(i)">✋</button>
          <button class="ghost" :aria-label="t('debug.remove')" @click="removeFromDeck(i)">✕</button>
        </li>
      </ul>
      <input v-model="search" type="search" :placeholder="t('debug.searchCards')" :aria-label="t('debug.searchCards')" />
      <ul v-if="cardMatches.length" class="matches">
        <li v-for="c in cardMatches" :key="c.id">
          <button class="ghost" @click="draft.deck.push(c.id)">+ {{ c.name }} <small>{{ familyName(c.id) }}</small></button>
        </li>
      </ul>
      <h4>{{ t('debug.hand') }}</h4>
      <p v-if="!draft.hand.length" class="hint">{{ t('debug.handHint') }}</p>
      <ul v-else class="chips">
        <li v-for="(id, i) in draft.hand" :key="i">
          <span>{{ cardName(id) }}</span>
          <button class="ghost" :aria-label="t('debug.remove')" @click="draft.hand.splice(i, 1)">✕</button>
        </li>
      </ul>
    </section>

    <section>
      <h3>{{ t('debug.profile') }}</h3>
      <label class="check"><input v-model="draft.useProfile" type="checkbox" /> {{ t('debug.useProfile') }}</label>
      <template v-if="draft.useProfile">
        <h4>{{ t('debug.unlocked') }}</h4>
        <label v-for="b in builds.filter((b) => b.unlock)" :key="b.id" class="check">
          <input type="checkbox" :checked="draft.unlocked.includes(b.id)" @change="toggle(draft.unlocked, b.id, ($event.target as HTMLInputElement).checked)" /> {{ b.name }}
        </label>
        <h4>{{ t('debug.met') }}</h4>
        <label v-for="f in fishermen" :key="f.id" class="check">
          <input type="checkbox" :checked="draft.fishermenMet.includes(f.id)" @change="toggle(draft.fishermenMet, f.id, ($event.target as HTMLInputElement).checked)" /> {{ f.name }}
        </label>
        <h4>{{ t('debug.home', { n: draft.home.length }) }}</h4>
        <div v-for="(c, i) in draft.home" :key="i" class="row creature">
          <select v-model="c.id" :aria-label="t('debug.creature')"><option v-for="e in creatures" :key="e.id" :value="e.id">{{ e.name }}</option></select>
          <select v-model.number="c.bond" :aria-label="t('debug.bond')"><option v-for="b in BONDS" :key="b" :value="b">{{ t('debug.bondLevel', { n: b }) }}</option></select>
          <select v-model="c.size" :aria-label="t('debug.size')"><option v-for="s in CATCH_SIZES" :key="s" :value="s">{{ t(`size.${s}`) }}</option></select>
          <button class="ghost" :aria-label="t('debug.remove')" @click="draft.home.splice(i, 1)">✕</button>
        </div>
        <button class="ghost" @click="draft.home.push({ id: firstCreature(), bond: 0, size: 'normal' })">+ {{ t('debug.addHome') }}</button>
        <label class="row">{{ t('debug.shells') }} <input v-model.number="draft.shells" type="number" min="0" /></label>
        <h4>{{ t('debug.logbook') }}</h4>
        <label v-for="n in data.progression" :key="n.id" class="check">
          <input type="checkbox" :checked="draft.progression.includes(n.id)" @change="toggle(draft.progression, n.id, ($event.target as HTMLInputElement).checked)" /> {{ n.name }}
        </label>
      </template>
    </section>

    <section>
      <h3>{{ t('debug.scenarios') }}</h3>
      <div class="row">
        <input v-model="name" :placeholder="t('debug.name')" :aria-label="t('debug.name')" />
        <button class="ghost" :disabled="!name.trim()" @click="save">{{ t('debug.save') }}</button>
      </div>
      <ul class="saved">
        <li v-for="(_, n) in savedScenarios" :key="n" class="row">
          <span>{{ n }}</span>
          <button class="ghost" @click="loadSaved(String(n))">{{ t('debug.load') }}</button>
          <button class="ghost" :aria-label="t('debug.delete')" @click="deleteScenario(String(n))">🗑</button>
        </li>
      </ul>
      <div class="row">
        <button class="ghost" @click="copy">{{ t('debug.copy') }}</button>
        <button class="ghost" :disabled="!pasted.trim()" @click="applyPasted">{{ t('debug.paste') }}</button>
      </div>
      <textarea v-model="pasted" rows="4" :placeholder="t('debug.pasteHint')" :aria-label="t('debug.pasteHint')"></textarea>
    </section>

    <p v-if="errorText" class="error" role="alert">{{ errorText }}</p>
    <p v-else-if="message" class="hint" role="status">{{ message }}</p>
    <button class="go" @click="play(scenario())">{{ t('debug.play') }}</button>
  </div>
</template>

<style scoped>
.presets { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.go { position: sticky; bottom: 0; padding: 10px; }
.saved { display: flex; flex-direction: column; gap: 4px; }
.saved span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.small { padding: 2px 8px; font-size: 0.75rem; }
</style>
