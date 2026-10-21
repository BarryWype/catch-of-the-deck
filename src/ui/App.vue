<script setup lang="ts">
import GameIcon from './GameIcon.vue';
import { computed, ref } from 'vue';
import { describeCard, findNode, isReleaseFight, justBeatBoss, progressionTotal, REWARD_REROLLS_AT_START, runSellBonus, SESSION_SLOTS, type CardDef } from '../engine';
import { t, term } from './i18n';
import Aquarium from './Aquarium.vue';
import BucketFull from './BucketFull.vue';
import CardView from './CardView.vue';
import CombatView from './CombatView.vue';
import DebugCombatTools from './DebugCombatTools.vue';
import BuildSelect from './BuildSelect.vue';
import CompanionPicker from './CompanionPicker.vue';
import EventScreen from './EventScreen.vue';
import FishermanScreen from './FishermanScreen.vue';
import CreatureBook from './CreatureBook.vue';
import MapView from './MapView.vue';
import MenuScreen from './MenuScreen.vue';
import RewardScreen from './RewardScreen.vue';
import SessionSlots from './SessionSlots.vue';
import ShopScreen from './ShopScreen.vue';
import TooltipLayer from './TooltipLayer.vue';
import TutorialOverlay, { type TutorialStep } from './TutorialOverlay.vue';
import CardZoom from './CardZoom.vue';
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
const { data, seed, run, combat, screen, canReturnToShop, debugScenario, infiniteEnergy, rewardChoices, eventId, shopVisit, savedGame, homeAquarium, creatureBook, biggestCatch, brought, homeLeft, runEnd, rewardLeft, builds, unlocked, fishermenMet, newlyUnlocked, logbook, recovering, shellsWon, tutorialsSeen } = game;

/** Stars the Logbook adds to every companion: the profile's before a run, the run's during it. */
const homeExtraStars = computed(() => progressionTotal(logbook.value.unlocked, data, 'companionStars'));

/**
 * The tutorials (TutorialOverlay): the map's on the first map screen, the fight's on the first turn
 * of the next fight. Each plays once per profile (`tutorialsSeen`), never in a debug scenario.
 */
const TUTORIALS: Record<'map' | 'fight', TutorialStep[]> = {
  map: [
    { target: '.map-layout > .aquarium', text: t('tutorial.map.bucket') },
    { target: '.node.miniBoss, .node.boss', text: t('tutorial.map.bosses') },
    { target: '.node.leave', text: t('tutorial.map.home') },
    { target: '.node.available', text: t('tutorial.map.next') },
  ],
  fight: [
    { target: '.globe', text: t('tutorial.fight.grit') },
    { target: '.tension', text: t('tutorial.fight.tension') },
    { target: '.patience', text: t('tutorial.fight.patience') },
    { target: '.enemies > .combatant:first-child .panicbar', text: t('tutorial.fight.will') },
    { target: '.enemies > .combatant:first-child .healthbar', text: t('tutorial.fight.health') },
    { target: '.enemies > .combatant:first-child .intent-slot', text: t('tutorial.fight.intent') },
    { target: '.hand', text: t('tutorial.fight.hand') },
    { target: '.end-turn', text: t('tutorial.fight.endTurn') },
  ],
};
const tutorial = computed(() => {
  if (debugScenario.value) return null;
  const id = screen.value === 'map' ? 'map' : screen.value === 'combat' && combat.value?.turn === 1 && combat.value.phase === 'playerTurn' ? 'fight' : null;
  return id && !tutorialsSeen.value.includes(id) ? id : null;
});
const runExtraStars = computed(() => (run.value ? progressionTotal(run.value.progression, data, 'companionStars') : 0));

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

/** The companion picker, opened from an empty session slot. */
const picker = ref<InstanceType<typeof CompanionPicker>>();

/** The deck dialog (the deck pill in the top bar): every card in it, by type, then by name. */
const deckDialog = ref<HTMLDialogElement>();
/** A shop item waits for a card or a creature to be picked: its list replaces the bucket below the shop. */
const shopPicking = ref(false);
const TYPE_ORDER: CardDef['type'][] = ['attack', 'defense', 'drain', 'support', 'power', 'junk'];
const deckCards = computed(() =>
  (run.value?.deck ?? [])
    .map((id) => data.cards[id])
    .filter(Boolean)
    .sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || a.name.localeCompare(b.name)),
);
</script>

<template>
  <header v-if="run && screen !== 'menu'" class="topbar">
    <div class="act">
      <span v-if="debugScenario" class="debug-badge" v-tip="t('debug.badgeTip')">{{ t('debug.badge') }}</span>
      <b>{{ act.age }}</b>
      <span v-if="act.place" class="act-place">{{ act.place }}</span>
    </div>
    <div class="run-info">
      <span v-if="screen === 'combat' && combat" class="stat turn"><b>{{ t('combat.turn', { n: combat.turn }) }}</b></span>
      <!-- In a fight the Grit bar under the fisherman already shows this; skip it there. -->
      <span v-if="screen !== 'combat'" class="stat grit" v-tip="term('grit')">
        <span class="bar" aria-hidden="true"><i :style="{ width: `${Math.round((100 * run.hp) / run.maxHp)}%` }"></i></span>
        <b>{{ run.hp }}<span class="max">/{{ run.maxHp }}</span></b>
      </span>
      <span class="stat coins" v-tip="t('app.coins')">
        <GameIcon icon="🪙" />
        <b>{{ run.coins }}</b>
      </span>
      <button class="stat deck" v-tip="t('app.deckTip', { n: run.deck.length })" @click="deckDialog?.showModal()">🂠 <b>{{ run.deck.length }}</b></button>
      <span class="seed" v-tip="{ title: t('app.seedTitle') }">{{ t('app.seed', { n: seed }) }}</span>
      <button v-if="canReturnToShop" class="ghost" @click="screen === 'shop' ? game.leaveShop() : game.returnToShop()">
        {{ screen === 'shop' ? t('app.seeMap') : t('app.backToShop') }}
      </button>
      <button v-if="debugScenario" class="ghost" @click="game.endScenario">{{ t('debug.end') }}</button>
      <button v-else class="ghost" @click="game.toMenu">{{ t('app.menu') }}</button>
      <button class="ghost new-run" @click="askNewRun(newRun)">{{ t('app.newRun') }}</button>
    </div>
  </header>

  <main>
    <!-- Before a run: pick a starting build, then up to SESSION_SLOTS creatures from home to bring along. -->
    <BuildSelect v-if="screen === 'build'" :builds="builds" :data="data" @choose="game.chooseBuild" @back="game.toMenu" />
    <div v-else-if="screen === 'companions'" class="build-layout">
      <header class="companions-head">
        <button class="ghost" @click="game.toBuildSelect">{{ t('common.back') }}</button>
        <div>
          <h2>{{ t('companions.title') }}</h2>
          <p>{{ t('companions.hint', { n: SESSION_SLOTS }) }}</p>
        </div>
      </header>
      <div class="home-row">
        <Aquarium
          class="aquarium"
          :creatures="homeLeft"
          :bonds="homeLeft.map((c) => c.bond)"
          :data="data"
          action="bring"
          :bring-blocked="brought.length >= SESSION_SLOTS ? t('companions.slotsFull') : undefined"
          :extra-stars="homeExtraStars"
          :recovering="recovering"
          :title="t('aquarium.home')"
          icon="🏠"
          @bring="game.bring"
        />
        <div class="slots-column">
          <SessionSlots :brought="brought" :data="data" :extra-stars="homeExtraStars" @remove="game.unbring" @pick="picker?.open()" />
          <button class="start-fishing" @click="game.startRun">{{ t('companions.start') }}</button>
        </div>
      </div>
      <CompanionPicker ref="picker" :creatures="homeLeft" :brought="brought" :data="data" :extra-stars="homeExtraStars" @pick="game.bring" />
    </div>
    <MenuScreen
      v-else-if="screen === 'menu' || !run"
      :can-resume="!!savedGame"
      :home-aquarium="homeAquarium"
      :creature-book="creatureBook"
      :biggest-catch="biggestCatch"
      :unlocked="unlocked"
      :fishermen-met="fishermenMet"
      :logbook="logbook"
      :recovering="recovering"
      :data="data"
      @resume="game.resume"
      @buy-node="game.buyLogbookNode"
      @new-run="askNewRun(newRunFromMenu)"
      :import-transfer="game.importTransfer"
      @reset="game.resetProgress"
      @play-scenario="game.playScenario"
      @replay-tutorial="game.replayTutorials"
    />
    <!-- The bucket stays in view on the map and in shops, where selling pays for the shopping. -->
    <div v-else-if="screen === 'map' || screen === 'shop'" class="map-layout">
      <MapView v-if="screen === 'map'" :run="run" :data="data" @travel="game.travel" />
      <CreatureBook v-if="screen === 'map'" :data="data" :home-aquarium="homeAquarium.map((c) => c.id)" :discovered="creatureBook" :biggest="biggestCatch" />
      <ShopScreen v-else class="shop-panel" :run="run" :data="data" :visit="shopVisit" @buy="game.buy" @leave="game.leaveShop" @picking="shopPicking = $event" />
      <Aquarium
        v-show="screen !== 'shop' || !shopPicking"
        class="aquarium"
        :creatures="run.bucket"
        :capacity="run.bucketSize"
        :companions="run.companions.length"
        :bonds="run.companions.map((c) => c.bond)"
        :sell-bonus="runSellBonus(run, data)"
        :extra-stars="runExtraStars"
        :data="data"
        :title="t('aquarium.bucket')"
        icon="🪣"
        bait
        @sell="game.sell"
        @bait="game.bait"
      />
    </div>
    <CombatView
      v-else-if="screen === 'combat' && combat"
      :state="combat"
      :data="data"
      :run="run"
      :equipment="run.equipment"
      :spot="findNode(run.map, run.position)?.spot ?? undefined"
      :character="data.builds[run.build]?.character"
      :home-aquarium="homeAquarium"
      :creature-book="creatureBook"
      :unlocked="unlocked"
      :fishermen-met="fishermenMet"
      :release-reason="isReleaseFight(run) ? (findNode(run.map, run.position)?.releaseReason ?? t('combat.defaultRelease')) : null"
      @action="game.dispatch"
      @bait="game.bait"
      @claim-victory="game.claimVictory"
      @leave="game.leaveFight"
      @menu="game.toMenu"
    >
      <template v-if="debugScenario" #debug>
        <DebugCombatTools
          :state="combat"
          :data="data"
          :infinite-energy="infiniteEnergy"
          @update="game.setDebugCombat"
          @action="game.dispatch"
          @infinite-energy="infiniteEnergy = $event"
        />
      </template>
    </CombatView>
    <BucketFull
      v-else-if="screen === 'bucketFull'"
      :run="run"
      :data="data"
      @keep="game.keepWaiting"
      @sell="game.sellWaiting"
      @bait="game.baitWaiting"
    />
    <EventScreen v-else-if="screen === 'event' && eventId" :event-id="eventId" :run="run" :data="data" @choose="game.chooseEvent" />
    <FishermanScreen
      v-else-if="screen === 'fisherman'"
      :fisherman-id="findNode(run.map, run.position)?.fisherman ?? ''"
      :data="data"
      :creatures="[...homeAquarium, ...run.bucket]"
      :bucket="run.bucket"
      :unlocked="unlocked"
      @leave="game.leaveFisherman"
    />
    <section v-else-if="screen === 'leave'" class="complete">
      <div class="leave-icon"><GameIcon icon="🏠" /></div>
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
      :shells="shellsWon ? { won: shellsWon, total: logbook.shells } : null"
      :rerolls-at-start="REWARD_REROLLS_AT_START + progressionTotal(run.progression, data, 'rerollsAtStart')"
      :boss="run && justBeatBoss(run) ? { deck: run.deck, canRemove: run.bossRemoval, bucket: run.bucket.length } : null"
      @choose="game.chooseReward"
      @skip="game.skipCardReward"
      @reroll="game.rerollCardReward"
      @remove="game.removeBossCard"
      @end-run="game.endRunAfterBoss"
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
      <p v-if="shellsWon && runEnd === 'won'" class="shells-won"><GameIcon icon="golden-shell" /> {{ t('logbook.won', { n: shellsWon, total: logbook.shells }) }}</p>
      <p v-for="id in newlyUnlocked" :key="id" class="unlocked">
        <GameIcon icon="🎣" /> {{ t('complete.unlocked', { build: data.builds[id]?.name ?? id }) }}
      </p>
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

  <dialog ref="deckDialog" class="confirm deck-dialog" @click="$event.target === deckDialog && deckDialog?.close()">
    <h3>{{ t('app.deckTitle', { n: deckCards.length }) }}</h3>
    <div class="deck-cards">
      <CardView v-for="(card, i) in deckCards" :key="i" :card="card" :description="describeCard(card)" />
    </div>
    <footer>
      <button class="ghost" autofocus @click="deckDialog?.close()">{{ t('common.close') }}</button>
    </footer>
  </dialog>

  <!-- A card held under a finger, full screen. -->
  <CardZoom />
  <!-- Every hover text in the app (v-tip) is drawn here. -->
  <TooltipLayer />
  <TutorialOverlay v-if="tutorial" :key="tutorial" :steps="TUTORIALS[tutorial]" @done="game.tutorialDone(tutorial)" />
</template>

<style scoped>
/* The deck: wider than a confirmation, its cards in a grid that scrolls inside. */
.deck-dialog { width: min(900px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); }
.deck-dialog[open] { display: flex; flex-direction: column; }
.deck-cards {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  min-height: 0;
  padding: 6px 2px;
  overflow-y: auto;
}

/* Map on top, aquarium fills whatever height is left. */
.map-layout {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  padding-bottom: 12px;
}
.map-layout .aquarium { flex: 1; }
.map-layout .shop-panel { min-height: 0; padding-top: 2vh; }

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
.start-fishing { padding: 16px; border-radius: 12px; background: linear-gradient(180deg, #3ba85f, #2d8a4e); color: #fff; font-size: 1.15rem; font-weight: 800; box-shadow: 0 4px 16px rgb(45 138 78 / 0.35), inset 0 1px 0 rgb(255 255 255 / 0.2); }
.start-fishing:hover { background: #36a35d; }
.build-layout .aquarium { flex: 1; min-width: 0; }

.complete { display: flex; flex-direction: column; align-items: center; gap: 8px; padding-top: 15vh; }
.complete h2 { margin: 0; font-size: 2rem; }
.complete p { margin: 0; max-width: 520px; text-align: center; }
.leave-icon { font-size: 4rem; line-height: 1; filter: drop-shadow(0 6px 18px rgb(245 215 110 / 0.3)); }
.shells-won { color: var(--highlight); font-weight: 600; }
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
/* Short landscape screens: the shop beside the bucket, so its scene keeps the full height. */
@media (max-height: 500px) and (orientation: landscape) {
  .map-layout:has(> .shop-panel) { flex-direction: row; }
  .map-layout .shop-panel { flex: 1; min-width: 0; justify-content: center; padding-top: 0; }
}
</style>
