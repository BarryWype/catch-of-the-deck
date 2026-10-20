<script setup lang="ts">
import KeywordText from './KeywordText.vue';
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue';
import {
  BASE_ENERGY,
  BOND_AT_HOME,
  BOND_LEVELS,
  bondPerFight,
  BUCKET_SIZE,
  FULL_SCHOOL,
  HOLD_PER_PATIENCE,
  MAX_PATIENCE,
  PATIENCE_ESCAPE_PERCENT,
  SESSION_SLOTS,
  STARTING_HAND_SIZE,
} from '../engine';
import { BOND_BY_TIER } from '../content/creatures';
import { describeQuest, GOLDEN_SHELLS, openQuests, questProgress, type CatchSize, type DebugScenario, type Discovery, type GameData, type HomeCreature, type Logbook, type RecoveringCreature } from '../engine';
import Aquarium from './Aquarium.vue';
import GameIcon from './GameIcon.vue';
import LogbookScreen from './LogbookScreen.vue';
import CreatureBook from './CreatureBook.vue';
import DebugPanel from './DebugPanel.vue';
import { debugPanel as debug, setDebugPanel as setDebug } from './debugStore';
import SideDrawer from './SideDrawer.vue';
import { playTheme, stopTheme, musicVolume, setMusicVolume, musicOn, setMusicOn } from './music';
import { sfxVolume, setSfxVolume } from './sfx';
import { language, languages, setLanguage, t } from './i18n';
import type { TransferContents } from './saveStore';

/** Loaded when opened, with its QR libraries, to keep them out of the main bundle. */
const TransferScreen = defineAsyncComponent(() => import('./TransferScreen.vue'));

const props = defineProps<{
  canResume: boolean;
  homeAquarium: HomeCreature[];
  creatureBook: Readonly<Record<string, Discovery>>;
  biggestCatch: Readonly<Record<string, CatchSize>>;
  unlocked: string[];
  fishermenMet: string[];
  logbook: Logbook;
  recovering: RecoveringCreature[];
  data: GameData;
  importTransfer: (contents: TransferContents) => boolean;
}>();

/** Open quests, one line each: who wants what, and how far the home aquarium is (a bucket quest has no progress at home). */
const quests = computed(() =>
  openQuests(props.data, props.unlocked, props.fishermenMet).map((build) => {
    const { fisherman, quest } = build.unlock!;
    const { have, need } = questProgress(quest, props.homeAquarium, props.data);
    const params = { fisherman: props.data.fishermen[fisherman]?.name ?? fisherman, quest: describeQuest(quest, props.data), have, need, build: build.name };
    const key = quest.type === 'inBucket' ? 'menu.questBucket' : have >= need ? 'menu.questReady' : 'menu.quest';
    return { id: build.id, text: t(key, params) };
  }),
);
const emit = defineEmits<{ resume: []; newRun: []; reset: []; playScenario: [DebugScenario]; buyNode: [id: string] }>();


/** The guide's bullet points (`guide.<key>` in the language files), and the numbers they quote. */
const GUIDE = ['catch', 'turn', 'moves', 'grit', 'hold', 'patience', 'aging', 'home', 'bucket', 'fishermen', 'companions', 'stars', 'bond', 'shells'] as const;
const GUIDE_NUMBERS = computed(() => ({
  energy: BASE_ENERGY,
  cards: STARTING_HAND_SIZE,
  holdPerPatience: HOLD_PER_PATIENCE,
  maxPatience: MAX_PATIENCE,
  patiencePercent: PATIENCE_ESCAPE_PERCENT,
  slots: SESSION_SLOTS,
  bucket: BUCKET_SIZE,
  fullSchool: FULL_SCHOOL,
  // The most stars any temperament's bonus still grows with.
  maxStars: Math.max(...Object.values(props.data.companionBonuses).flatMap((b) => b.effects.map((e) => e.byStars?.length ?? 0))),
  kid: bondPerFight(1, false),
  adult: bondPerFight(2, false),
  elder: bondPerFight(3, false),
  level1: Math.round(BOND_LEVELS[0] * 100),
  level2: Math.round(BOND_LEVELS[1] * 100),
  level3: Math.round(BOND_LEVELS[2] * 100),
  full1: BOND_BY_TIER[1],
  full2: BOND_BY_TIER[2],
  full3: BOND_BY_TIER[3],
  atHome: BOND_AT_HOME,
  ...GOLDEN_SHELLS,
}));

/** Exit only exists in the desktop app; a browser tab can't quit itself. */
const desktop = window.desktop;
/** Menu hidden so the whole aquarium can be seen. */
const viewing = ref(false);
/** The Transfer save screen, over the menu. */
const transferring = ref(false);
/** The Logbook, over the menu. */
const logbookOpen = ref(false);
/** Confirmation before wiping all progression. */
const confirmReset = ref<HTMLDialogElement>();

function reset() {
  confirmReset.value?.close();
  emit('reset');
}

const options = ref<HTMLDialogElement>();
/**
 * The desktop app makes the window fullscreen (and remembers it, see electron/main.js);
 * a browser uses the Fullscreen API, which only lasts until the page is left.
 */
const fullscreen = ref(false);

async function syncFullscreen() {
  fullscreen.value = desktop ? await desktop.isFullScreen() : !!document.fullscreenElement;
}

async function setFullscreen(on: boolean) {
  fullscreen.value = on;
  try {
    if (desktop) await desktop.setFullScreen(on);
    else if (on) await document.documentElement.requestFullscreen();
    else if (document.fullscreenElement) await document.exitFullscreen();
  } catch {
    // Refused (e.g. the browser blocks it): show what really happened.
    await syncFullscreen();
  }
}

async function openOptions() {
  await syncFullscreen();
  options.value?.showModal();
}

// Esc or F11 can leave browser fullscreen without going through the options.
onMounted(() => document.addEventListener('fullscreenchange', syncFullscreen));
onBeforeUnmount(() => document.removeEventListener('fullscreenchange', syncFullscreen));

/**
 * The menu theme (music.ts) plays from mount until a run leaves the menu.
 */
onMounted(() => playTheme('menu'));
onBeforeUnmount(stopTheme);
</script>

<template>
  <section class="menu" :class="{ viewing }">
    <Aquarium
      class="backdrop"
      :creatures="homeAquarium"
      :bonds="homeAquarium.map((c) => c.bond)"
      :recovering="viewing ? recovering : undefined"
      :data="data" :interactive="false" :title="t('aquarium.home')" icon="🏠" />

    <div v-if="!viewing" class="panel">
      <h2>Catch of the Deck</h2>
      <nav class="buttons">
        <button v-tip="canResume ? undefined : t('menu.noSave')" :disabled="!canResume" @click="emit('resume')">{{ t('menu.resume') }}</button>
        <button @click="emit('newRun')">{{ t('menu.newRun') }}</button>
        <button
          class="ghost logbook-button"
          :aria-label="`${t('logbook.button')} · ${t('logbook.shells', { n: logbook.shells })}`"
          @click="logbookOpen = true"
        >
          <span>{{ t('logbook.button') }}</span>
          <span class="shell-count" v-tip="t('logbook.shellsTip', GOLDEN_SHELLS)"><GameIcon icon="golden-shell" /> {{ logbook.shells }}</span>
        </button>
        <button class="ghost" @click="viewing = true">{{ t('menu.seeAquarium') }}</button>
        <button class="ghost" @click="transferring = true">{{ t('transfer.button') }}</button>
        <button class="ghost" @click="openOptions">{{ t('menu.options') }}</button>
        <button v-if="desktop" class="ghost" @click="desktop.quit()">{{ t('menu.exit') }}</button>
      </nav>
      <ul v-if="quests.length" class="quests">
        <li v-for="q in quests" :key="q.id"><GameIcon icon="🎣" /> {{ q.text }}</li>
      </ul>
      <p class="credits">
        {{ t('credits.music') }} · {{ t('credits.menu') }} · {{ t('credits.map') }}
      </p>
    </div>
    <button v-else class="show-menu" @click="viewing = false">☰ {{ t('app.menu') }}</button>
    <!-- Left edge: the guide, with the debug drawer under it when enabled in the options. -->
    <SideDrawer side="left" icon="📘" :title="t('guide.title')" :tab-offset="debug ? -34 : 0" :width="460">
      <ul class="guide">
        <li v-for="key in GUIDE" :key="key">
          <b><KeywordText :text="t(`guide.${key}.title`)" /></b> <KeywordText :text="t(`guide.${key}.text`, GUIDE_NUMBERS)" />
        </li>
      </ul>
    </SideDrawer>
    <!-- Shown when "Show debug panel" is ticked in the options (debugStore.ts). -->
    <SideDrawer v-if="debug" side="left" icon="🛠" :title="t('debug.title')" :tab-offset="34" :width="420">
      <DebugPanel :data="data" @play="emit('playScenario', $event)" />
    </SideDrawer>
    <button
      v-if="!viewing"
      v-tip="musicOn ? t('menu.musicOff') : t('menu.musicOn')"
      class="ghost sound"
      :class="{ off: !musicOn }"
      :aria-label="musicOn ? t('menu.musicOff') : t('menu.musicOn')"
      :aria-pressed="musicOn"
      @click="setMusicOn(!musicOn)"
    ><GameIcon icon="music-note" /></button>
    <button v-if="!viewing" class="ghost reset" @click="confirmReset?.showModal()">{{ t('reset.button') }}</button>

    <dialog ref="confirmReset" class="confirm" @click="$event.target === confirmReset && confirmReset?.close()">
      <h3>{{ t('reset.title') }}</h3>
      <p>{{ t('reset.text') }}</p>
      <footer>
        <button class="ghost" autofocus @click="confirmReset?.close()">{{ t('common.cancel') }}</button>
        <button class="danger" @click="reset">{{ t('reset.confirm') }}</button>
      </footer>
    </dialog>
    <dialog ref="options" class="confirm options" @click="$event.target === options && options?.close()">
      <h3>{{ t('options.title') }}</h3>
      <label class="option">
        <span>
          {{ t('options.language') }}
          <small>{{ t('options.languageHint') }}</small>
        </span>
        <select :value="language" @change="setLanguage(($event.target as HTMLSelectElement).value as typeof language)">
          <option v-for="l in languages" :key="l.code" :value="l.code">{{ l.name }}</option>
        </select>
      </label>
      <label class="option">
        <span>{{ t('options.music') }}</span>
        <input
          type="range"
          min="0"
          max="100"
          :value="musicVolume()"
          @input="setMusicVolume(Number(($event.target as HTMLInputElement).value))"
        />
      </label>
      <label class="option">
        <span>{{ t('options.sfx') }}</span>
        <input
          type="range"
          min="0"
          max="100"
          :value="sfxVolume()"
          @input="setSfxVolume(Number(($event.target as HTMLInputElement).value))"
        />
      </label>
      <label class="option">
        <span>
          {{ t('options.fullscreen') }}
          <small>{{ desktop ? t('options.fullscreenDesktop') : t('options.fullscreenBrowser') }}</small>
        </span>
        <input type="checkbox" role="switch" :checked="fullscreen" @change="setFullscreen(($event.target as HTMLInputElement).checked)" />
      </label>
      <label class="option">
        <span>
          {{ t('options.debug') }}
          <small>{{ t('options.debugHint') }}</small>
        </span>
        <input type="checkbox" role="switch" :checked="debug" @change="setDebug(($event.target as HTMLInputElement).checked)" />
      </label>
      <footer>
        <button autofocus @click="options?.close()">{{ t('options.done') }}</button>
      </footer>
    </dialog>
    <TransferScreen v-if="transferring" :data="data" :apply="importTransfer" @close="transferring = false" />
    <LogbookScreen v-if="logbookOpen" :logbook="logbook" :data="data" @buy="emit('buyNode', $event)" @close="logbookOpen = false" />
    <CreatureBook :data="data" :home-aquarium="homeAquarium.map((c) => c.id)" :discovered="creatureBook" :biggest="biggestCatch" />
  </section>
</template>

<style scoped>
/* The aquarium fills the window; the menu floats over it. */
.menu { position: fixed; inset: 0; z-index: 10; display: grid; place-items: center; background: var(--bg); }
.backdrop { position: absolute; inset: 0; z-index: 0; min-height: 0; }
.backdrop :deep(.tank) { border-width: 0; border-radius: 0; }
/* Its "Aquarium · N caught" header only shows when looking at the aquarium. */
.menu:not(.viewing) .backdrop :deep(.label) { display: none; }
/* Room on the right for the Menu button. */
.viewing .backdrop :deep(.label) { padding: 10px 120px 10px 16px; line-height: 2; }

.panel {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
  padding: 36px 48px;
  border-radius: 20px;
}
.panel h2 {
  margin: 0;
  font-size: 3rem;
  letter-spacing: 0.02em;
  background: linear-gradient(180deg, #fdf3d0, #f5d76e 55%, #d9a83c);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 3px 10px rgb(245 215 110 / 0.25));
  text-shadow: 0 3px 10px rgb(245 215 110 / 0.25);
}
.buttons { display: flex; flex-direction: column; gap: 12px; width: 240px; }
.buttons button { padding: 14px; font-size: 1.1rem; }
.buttons .ghost { background: rgb(15 18 25 / 0.6); color: var(--text); }
/* The Logbook, with the golden shells to spend at its right. */
.logbook-button { display: flex; align-items: center; justify-content: center; gap: 10px; }
.shell-count { font-weight: 800; color: var(--highlight); }
/* Open quests, under the buttons. */
.quests { margin: 0; padding: 0; max-width: 280px; list-style: none; font-size: 0.85rem; line-height: 1.4; text-align: center; color: var(--highlight); }
/* Who wrote the music. */
.credits { margin: 0; max-width: 260px; font-size: 0.68rem; line-height: 1.4; color: var(--muted); text-align: center; }

.reset {
  position: absolute;
  right: 16px;
  bottom: 14px;
  z-index: 1;
  padding: 6px 12px;
  font-size: 0.8rem;
  background: rgb(15 18 25 / 0.6);
  color: var(--muted);
}
.reset:hover { color: var(--text); }
/* Music on/off: the note, struck through and dimmed while the music is off. */
.sound {
  position: absolute;
  top: 12px;
  right: 16px;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  font-size: 1.3rem;
  background: rgb(15 18 25 / 0.6);
}
.sound.off .game-icon { opacity: 0.45; }
.sound.off::after {
  content: '';
  position: absolute;
  width: 30px;
  height: 3px;
  border-radius: 2px;
  background: var(--muted);
  transform: rotate(-45deg);
}


.options { border-color: #2c3a4a; }
.option { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 10px 0; cursor: pointer; }
.option small { display: block; color: var(--muted); font-size: 0.75rem; }
.option input { accent-color: var(--highlight); cursor: pointer; }
.option input[type='checkbox'] { width: 20px; height: 20px; }
.option input[type='range'] { width: 140px; }
.option select { padding: 4px 8px; border-radius: 6px; font: inherit; }

.guide { display: flex; flex-direction: column; gap: 12px; margin: 0; padding: 18px 20px 18px 36px; line-height: 1.45; }
.guide b { color: var(--highlight); }
.show-menu { position: absolute; top: 12px; right: 16px; z-index: 1; padding: 8px 14px; }

/* Small screens: a smaller panel, which scrolls itself rather than being cut off when the phone
   lies flat. (Not the menu: the drawers hide off its edges, and a scrolling menu would reveal them.) */
@media (max-width: 700px), (max-height: 500px) {
  .menu { padding: 12px 44px 48px; }
  .panel { gap: 14px; padding: 18px 22px; max-height: 100%; overflow-y: auto; }
  .panel h2 { font-size: 2rem; }
  .buttons { width: 210px; gap: 8px; }
  .buttons button { padding: 10px; font-size: 1rem; }
}
</style>
