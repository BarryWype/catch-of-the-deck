<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { Discovery, GameData, HomeCreature } from '../engine';
import Aquarium from './Aquarium.vue';
import CreatureBook from './CreatureBook.vue';

defineProps<{
  canResume: boolean;
  homeAquarium: HomeCreature[];
  creatureBook: Readonly<Record<string, Discovery>>;
  data: GameData;
}>();
const emit = defineEmits<{ resume: []; newRun: []; reset: []; debugStart: [levelIndex: number, kind: 'miniBoss' | 'boss'] }>();

/**
 * Temporary shortcuts for testing the bosses, shown when "Show debug panel" is ticked in the
 * options. The choice is a per-device convenience, kept in localStorage.
 */
const DEBUG_KEY = 'slay-the-fish:debug-panel';
function readDebug() {
  try {
    return localStorage.getItem(DEBUG_KEY) === 'true';
  } catch {
    return false;
  }
}
const debug = ref(readDebug());
function setDebug(on: boolean) {
  debug.value = on;
  try {
    localStorage.setItem(DEBUG_KEY, String(on));
  } catch {
    // Storage blocked: the panel just won't be remembered.
  }
}
const DEBUG_STARTS = [0, 1, 2].flatMap((level) => [
  { level, kind: 'miniBoss' as const, label: `Act ${level + 1} · mini-boss` },
  { level, kind: 'boss' as const, label: `Act ${level + 1} · boss` },
]);

/** Exit only exists in the desktop app; a browser tab can't quit itself. */
const desktop = window.desktop;
/** Menu hidden so the whole aquarium can be seen. */
const viewing = ref(false);
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
</script>

<template>
  <section class="menu" :class="{ viewing }">
    <Aquarium
      class="backdrop"
      :creatures="homeAquarium.map((c) => c.id)"
      :bonds="homeAquarium.map((c) => c.bond)"
      :data="data" :interactive="false" title="Home aquarium" icon="🏠" />

    <div v-if="!viewing" class="panel">
      <h2>Slay the Fish</h2>
      <nav class="buttons">
        <button :disabled="!canResume" :title="canResume ? undefined : 'No saved run yet'" @click="emit('resume')">Resume</button>
        <button @click="emit('newRun')">New run</button>
        <button class="ghost" @click="viewing = true">See aquarium</button>
        <button class="ghost" @click="openOptions">Options</button>
        <button v-if="desktop" class="ghost" @click="desktop.quit()">Exit</button>
      </nav>
    </div>
    <button v-else class="show-menu" @click="viewing = false">☰ Menu</button>
    <nav v-if="debug && !viewing" class="debug" aria-label="Debug shortcuts">
      <strong>🛠 Debug</strong>
      <button v-for="d in DEBUG_STARTS" :key="d.label" class="ghost" @click="emit('debugStart', d.level, d.kind)">{{ d.label }}</button>
    </nav>
    <button v-if="!viewing" class="ghost reset" @click="confirmReset?.showModal()">Reset progression</button>

    <dialog ref="confirmReset" class="confirm" @click="$event.target === confirmReset && confirmReset?.close()">
      <h3>Reset progression?</h3>
      <p>This deletes your saved run and every creature in your home aquarium. It can't be undone.</p>
      <footer>
        <button class="ghost" autofocus @click="confirmReset?.close()">Cancel</button>
        <button class="danger" @click="reset">Reset everything</button>
      </footer>
    </dialog>
    <dialog ref="options" class="confirm options" @click="$event.target === options && options?.close()">
      <h3>Options</h3>
      <label class="option">
        <span>
          Fullscreen
          <small>{{ desktop ? 'Remembered next time you open the game.' : 'Press Esc to leave it.' }}</small>
        </span>
        <input type="checkbox" role="switch" :checked="fullscreen" @change="setFullscreen(($event.target as HTMLInputElement).checked)" />
      </label>
      <label class="option">
        <span>
          Show debug panel
          <small>Shortcuts on the menu to jump straight to each mini-boss and boss.</small>
        </span>
        <input type="checkbox" role="switch" :checked="debug" @change="setDebug(($event.target as HTMLInputElement).checked)" />
      </label>
      <footer>
        <button autofocus @click="options?.close()">Done</button>
      </footer>
    </dialog>
    <CreatureBook :data="data" :home-aquarium="homeAquarium.map((c) => c.id)" :discovered="creatureBook" />
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
  background: rgb(15 18 25 / 0.72);
  box-shadow: 0 10px 30px rgb(0 0 0 / 0.45);
  backdrop-filter: blur(3px);
}
.panel h2 { margin: 0; font-size: 3rem; letter-spacing: 0.02em; }
.buttons { display: flex; flex-direction: column; gap: 12px; width: 240px; }
.buttons button { padding: 14px; font-size: 1.1rem; }
.buttons .ghost { background: rgb(15 18 25 / 0.6); color: var(--text); }

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


.options { border-color: #2c3a4a; }
.option { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 10px 0; cursor: pointer; }
.option small { display: block; color: var(--muted); font-size: 0.75rem; }
.option input { width: 20px; height: 20px; accent-color: var(--highlight); cursor: pointer; }

.debug {
  position: absolute;
  top: 50%;
  left: 16px;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  border: 1px dashed #c94a4a;
  border-radius: 10px;
  background: rgb(15 18 25 / 0.75);
  transform: translateY(-50%);
  font-size: 0.8rem;
}
.debug strong { color: #f08b8b; }
.debug button { padding: 6px 10px; font-size: 0.8rem; background: rgb(15 18 25 / 0.6); color: var(--text); }
.show-menu { position: absolute; top: 12px; right: 16px; z-index: 1; padding: 8px 14px; }
</style>
