<script setup lang="ts">
import { computed, ref } from 'vue';
import { findNode, isReleaseFight, SESSION_SLOTS } from '../engine';
import { t, term } from './i18n';
import Aquarium from './Aquarium.vue';
import CombatView from './CombatView.vue';
import EggTray from './EggTray.vue';
import EventScreen from './EventScreen.vue';
import MapView from './MapView.vue';
import MenuScreen from './MenuScreen.vue';
import RewardScreen from './RewardScreen.vue';
import SessionSlots from './SessionSlots.vue';
import ShopScreen from './ShopScreen.vue';
import TooltipLayer from './TooltipLayer.vue';
import { useGame } from './useGame';

function randomSeed() {
  return Math.floor(Math.random() * 1_000_000);
}

/** `?seed=123` in the URL replays the same run. */
function initialSeed() {
  const param = new URLSearchParams(location.search).get('seed');
  const seed = param === null ? NaN : Number(param);
  return Number.isInteger(seed) ? seed : randomSeed();
}

const game = useGame(initialSeed());
const { data, seed, run, combat, screen, rewardChoices, eventId, shopVisit, savedGame, homeAquarium, creatureBook, eggs, newEggs, brought, homeLeft, runEnd, rewardLeft } = game;

/**
 * The top bar's title: the act being played, from its level's "age · place" name. It replaces
 * the old "Floor N", which counted won encounters rather than floors.
 */
const act = computed(() => {
  const [age, place] = (data.levels[run.value?.level ?? 0]?.name ?? '').split(' · ');
  return { age, place: place ?? '' };
});

function newRun() {
  game.newRun(randomSeed());
}

/** The first run from the menu honours `?seed=`; later ones are random. */
let firstRun = true;
function newRunFromMenu() {
  game.newRun(firstRun ? initialSeed() : randomSeed());
  firstRun = false;
}

/** Starting over while a run is in progress (one with a save) asks first: that run is lost. */
const confirmNewRun = ref<HTMLDialogElement>();
let pendingNewRun = newRun;
function askNewRun(start: () => void) {
  if (!savedGame.value) return start();
  pendingNewRun = start;
  confirmNewRun.value?.showModal();
}
function startNewRun() {
  confirmNewRun.value?.close();
  pendingNewRun();
}
</script>

<template>
  <header v-if="run && screen !== 'menu'" class="topbar">
    <div class="act">
      <b>{{ act.age }}</b>
      <span v-if="act.place" class="act-place">{{ act.place }}</span>
    </div>
    <div class="run-info">
      <!-- In a fight the Grit bar under the fisherman already shows this; skip it there. -->
      <span v-if="screen !== 'combat'" class="stat grit" v-tip="term('grit')">
        <span class="bar" aria-hidden="true"><i :style="{ width: `${Math.round((100 * run.hp) / run.maxHp)}%` }"></i></span>
        <b>{{ run.hp }}<span class="max">/{{ run.maxHp }}</span></b>
      </span>
      <span class="stat coins" v-tip="t('app.coins')">
        <i class="coin" aria-hidden="true"></i>
        <b>{{ run.coins }}</b>
      </span>
      <span class="stat deck" v-tip="t('app.deckTip', { n: run.deck.length })">🂠 <b>{{ run.deck.length }}</b></span>
      <span class="seed" v-tip="{ title: t('app.seedTitle'), detail: t('app.seedDetail') }">{{ t('app.seed', { n: seed }) }}</span>
      <button class="ghost" @click="game.toMenu">{{ t('app.menu') }}</button>
      <button class="ghost new-run" @click="askNewRun(newRun)">{{ t('app.newRun') }}</button>
    </div>
  </header>

  <main>
    <!-- Before a run: pick up to SESSION_SLOTS creatures from home to bring along. -->
    <div v-if="screen === 'companions'" class="build-layout">
      <header class="companions-head">
        <button class="ghost" @click="game.toMenu">{{ t('common.back') }}</button>
        <div>
          <h2>{{ t('companions.title') }}</h2>
          <p>{{ t('companions.hint', { n: SESSION_SLOTS }) }}</p>
        </div>
      </header>
      <div class="home-row">
        <Aquarium
          class="aquarium"
          :creatures="homeLeft.map((c) => c.id)"
          :bonds="homeLeft.map((c) => c.bond)"
          :data="data"
          action="bring"
          :bring-blocked="brought.length >= SESSION_SLOTS ? t('companions.slotsFull') : undefined"
          :title="t('aquarium.home')"
          icon="🏠"
          @bring="game.bring"
        />
        <div class="slots-column">
          <SessionSlots :brought="brought" :data="data" @remove="game.unbring" />
          <button class="start-fishing" @click="game.startRun">{{ t('companions.start') }}</button>
        </div>
      </div>
    </div>
    <MenuScreen
      v-else-if="screen === 'menu' || !run"
      :can-resume="!!savedGame"
      :home-aquarium="homeAquarium"
      :creature-book="creatureBook"
      :data="data"
      @resume="game.resume"
      @new-run="askNewRun(newRunFromMenu)"
      @reset="game.resetProgress"
      @debug-start="(level, kind) => game.debugStartAt(level, kind, randomSeed())"
    />
    <!-- The bucket stays in view on the map and in shops, where selling pays for the shopping. -->
    <div v-else-if="screen === 'map' || screen === 'shop'" class="map-layout">
      <MapView v-if="screen === 'map'" :run="run" :data="data" @travel="game.travel" />
      <ShopScreen v-else class="shop-panel" :run="run" :data="data" :visit="shopVisit" @buy="game.buy" @leave="game.leaveShop" />
      <Aquarium
        class="aquarium"
        :creatures="run.bucket"
        :companions="run.companions.length"
        :bonds="run.companions.map((c) => c.bond)"
        :data="data"
        :title="t('aquarium.bucket')"
        icon="🪣"
        @sell="game.sell"
      />
    </div>
    <CombatView
      v-else-if="screen === 'combat' && combat"
      :state="combat"
      :data="data"
      :equipment="run.equipment"
      :new-eggs="newEggs"
      :release-reason="isReleaseFight(run) ? (findNode(run.map, run.position)?.releaseReason ?? t('combat.defaultRelease')) : null"
      @action="game.dispatch"
      @claim-victory="game.claimVictory"
      @leave="game.leaveFight"
      @menu="game.toMenu"
    />
    <EventScreen v-else-if="screen === 'event' && eventId" :event-id="eventId" :run="run" :data="data" @choose="game.chooseEvent" />
    <section v-else-if="screen === 'leave'" class="complete">
      <div class="leave-icon">🏠</div>
      <h2>{{ t('leave.title') }}</h2>
      <p>{{ t('leave.text', { n: run.bucket.length }) }}</p>
      <div class="complete-actions">
        <button class="ghost" @click="game.cancelLeave">{{ t('leave.back') }}</button>
        <button @click="game.finishSession">{{ t('leave.confirm') }}</button>
      </div>
    </section>
    <RewardScreen
      v-else-if="screen === 'reward'"
      :choices="rewardChoices"
      :data="data"
      :skips="rewardLeft.skips"
      :rerolls="rewardLeft.rerolls"
      @choose="game.chooseReward"
      @skip="game.skipCardReward"
      @reroll="game.rerollCardReward"
    />
    <section v-else-if="screen === 'complete'" class="complete">
      <template v-if="runEnd !== 'fled'">
        <h2>{{ runEnd === 'won' ? t('complete.won') : t('complete.left') }}</h2>
        <p>{{ t(runEnd === 'won' ? 'complete.wonText' : 'complete.leftText', { grit: run.hp }) }}</p>
        <p>{{ t('complete.bucketHome', { n: run.bucket.length }) }}</p>
      </template>
      <template v-else>
        <h2>{{ t('complete.fledTitle') }}</h2>
        <p>{{ t('complete.fledText') }}</p>
      </template>
      <p v-if="newEggs" class="new-eggs">{{ t('common.newEggs', { n: newEggs }) }}</p>
      <div class="complete-actions">
        <button @click="game.toMenu">{{ t('complete.toMenu') }}</button>
      </div>
    </section>
  </main>

  <dialog ref="confirmNewRun" class="confirm" @click="$event.target === confirmNewRun && confirmNewRun?.close()">
    <h3>{{ t('newRunDialog.title') }}</h3>
    <p>{{ t('newRunDialog.text') }}</p>
    <footer>
      <button class="ghost" autofocus @click="confirmNewRun?.close()">{{ t('common.cancel') }}</button>
      <button class="danger" @click="startNewRun">{{ t('newRunDialog.abandon') }}</button>
    </footer>
  </dialog>

  <!-- Only between runs, where the home aquarium is: not over the map's bucket or the cards. -->
  <EggTray v-if="['menu', 'companions', 'complete'].includes(screen)" :eggs="eggs" :data="data" @hatch="game.hatchEgg" />

  <!-- Every hover text in the app (v-tip) is drawn here. -->
  <TooltipLayer />
</template>

<style scoped>

/* Map on top, aquarium fills whatever height is left. */
.map-layout {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  padding-bottom: 12px;
}
.map-layout .aquarium { flex: 1; }
.map-layout .shop-panel { flex-shrink: 0; padding-top: 2vh; }

/* Choosing companions: a header, then the home aquarium and the session slots. */
.build-layout {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  padding-bottom: 12px;
}
.build-layout .home-row { display: flex; flex: 1; min-height: 0; gap: 12px; }
.companions-head { display: flex; gap: 16px; align-items: center; padding-top: 8px; }
.companions-head h2 { margin: 0; }
.companions-head p { margin: 4px 0 0; color: var(--muted); }
.slots-column { display: flex; flex-direction: column; gap: 12px; min-height: 0; }
.slots-column .session-slots { flex: 1; min-height: 0; }
.start-fishing { padding: 16px; border-radius: 12px; background: #2d8a4e; color: #fff; font-size: 1.15rem; font-weight: 800; }
.start-fishing:hover { background: #36a35d; }
.build-layout .aquarium { flex: 1; min-width: 0; }

.complete { display: flex; flex-direction: column; align-items: center; gap: 8px; padding-top: 15vh; }
.complete h2 { margin: 0; font-size: 2rem; }
.complete p { margin: 0; max-width: 520px; text-align: center; }
.leave-icon { font-size: 4rem; line-height: 1; }
.new-eggs { color: var(--highlight); font-weight: 600; }
.complete-actions { display: flex; gap: 8px; margin-top: 12px; }

/* Small screens: the bucket and the home aquarium get less room, the slots go under the aquarium. */
@media (max-width: 700px), (max-height: 500px) {
  .map-layout, .build-layout { gap: 8px; padding-bottom: 8px; }
  .build-layout { height: auto; min-height: 100%; }
  .build-layout .home-row { flex-direction: column; }
  .build-layout .aquarium { min-height: 220px; }
  .companions-head { gap: 10px; }
  .companions-head h2 { font-size: 1.1rem; }
  .complete { padding: 6vh 0 16px; text-align: center; }
  .complete h2 { font-size: 1.5rem; }
}
</style>
