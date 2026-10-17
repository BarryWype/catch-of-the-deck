import { computed, ref, shallowRef, watch } from 'vue';
import { gameData } from './i18n';
import {
  addCardToDeck,
  rerollReward,
  removeCardAfterBoss,
  rewardOptions,
  skipReward,
  applyEventChoice,
  buyShopItem,
  findNode,
  applyAction,
  bringCatchHome,
  catchesOf,
  finishCombat,
  hatchling,
  keepCatch,
  recordSizes,
  sellCatch,
  restAtHome,
  layEggs,
  SESSION_SLOTS,
  takeFromHome,
  createRun,
  enterNextLevel,
  isLastLevel,
  buildLevelMap,
  START_NODE_ID,
  startingBuilds,
  isReleaseFight,
  visitTreasure,
  recordEncounter,
  isMapComplete,
  visitLeave,
  fightFamilies,
  rollCardRewards,
  sellCreature,
  travelTo,
  visitEvent,
  visitShop,
  type CatchSize,
  type CombatAction,
  type CombatState,
  type Discovery,
  type HomeCreature,
  type RunState,
  type ShopVisit,
} from '../engine';
import {
  clearProfile,
  clearSavedGame,
  loadProfile,
  loadSavedGame,
  PROFILE_VERSION,
  SAVE_VERSION,
  writeProfile,
  writeSavedGame,
  type SavedGame,
} from './saveStore';

export type Screen = 'menu' | 'companions' | 'map' | 'combat' | 'bucketFull' | 'event' | 'shop' | 'leave' | 'reward' | 'complete';

/**
 * Thin glue between Vue and the engine: holds the current immutable states in
 * refs and swaps them for whatever the engine returns. No game rules here.
 */
export function useGame(initialSeed: number) {
  const seed = ref(initialSeed);
  /** null until a starting build is chosen. */
  const run = shallowRef<RunState | null>(null);
  const combat = shallowRef<CombatState | null>(null);
  const screen = ref<Screen>('menu');
  const rewardChoices = ref<string[]>([]);
  /** The event being played, on the event screen. */
  const eventId = ref<string | null>(null);
  /** Purchases during the current shop visit, on the shop screen. */
  const shopVisit = ref<ShopVisit>({ bought: {} });
  /** The run that Resume would pick up, if any. */
  const savedGame = shallowRef<SavedGame | null>(null);
  loadSavedGame().then((save) => (savedGame.value = save));
  /** Creatures brought home from won runs or hatched, with their bond; shown on the menu and companions screens. */
  const homeAquarium = ref<HomeCreature[]>([]);
  /** Every creature met so far, seen or captured; shown in the creature book. */
  const creatureBook = shallowRef<Readonly<Record<string, Discovery>>>({});
  /** The biggest of each species ever caught, in the creature book. */
  const biggestCatch = shallowRef<Readonly<Record<string, CatchSize>>>({});
  /** Eggs laid in the home aquarium, waiting to be clicked: the creature id inside each. */
  const eggs = ref<string[]>([]);
  loadProfile().then((profile) => {
    homeAquarium.value = profile.homeAquarium;
    creatureBook.value = profile.creatureBook;
    biggestCatch.value = profile.biggestCatch;
    eggs.value = profile.eggs;
  });
  /** The finish node the player clicked, waiting for them to confirm on the leave screen. */
  const leaveNodeId = ref<string | null>(null);
  /** On the end screen, how the run ended. Only `fled` leaves the bucket behind. */
  const runEnd = ref<'won' | 'left' | 'fled'>('won');

  function saveProfile() {
    writeProfile({
      version: PROFILE_VERSION,
      homeAquarium: homeAquarium.value,
      creatureBook: { ...creatureBook.value },
      biggestCatch: { ...biggestCatch.value },
      eggs: eggs.value,
    });
  }

  // Fill the creature book as soon as a fight starts, and again once it's won.
  watch(combat, (state) => {
    if (!state) return;
    const book = recordEncounter(creatureBook.value, state, !!run.value && isReleaseFight(run.value));
    if (book === creatureBook.value) return;
    creatureBook.value = book;
    saveProfile();
  });

  /** The fight is over: its catches' sizes go in the creature book, then the run carries its outcome. */
  function finishFight(current: RunState, ended: CombatState): RunState {
    const biggest = recordSizes(biggestCatch.value, catchesOf(current, ended));
    if (biggest !== biggestCatch.value) {
      biggestCatch.value = biggest;
      saveProfile();
    }
    return finishCombat(current, ended, gameData);
  }

  /** On the companions screen: indices in `homeAquarium` of the creatures picked to start the run in the bucket. */
  const broughtSlots = ref<number[]>([]);
  /** The picked creatures, and the home aquarium without them, as the companions screen shows them. */
  const picked = computed(() => takeFromHome(homeAquarium.value, broughtSlots.value));
  const brought = computed(() => picked.value.brought);
  const homeLeft = computed(() => picked.value.home);

  /** Pick the creature at `slot` of `homeLeft` to bring along, if a session slot is free. */
  function bring(slot: number) {
    const index = homeAquarium.value.findIndex((c) => c === homeLeft.value[slot]);
    if (index >= 0 && broughtSlots.value.length < SESSION_SLOTS) broughtSlots.value = [...broughtSlots.value, index];
  }

  /** Put the creature in session slot `index` back in the home aquarium. */
  function unbring(index: number) {
    broughtSlots.value = broughtSlots.value.filter((_, i) => i !== index);
  }

  /** How many eggs were laid when the last run ended, for the end screens. */
  const newEggs = ref(0);

  /**
   * Every run end (not an abandoned one): creatures that stayed home bond a little, a successful
   * run brings its bucket home, then pairs may lay an egg (so new catches can breed straight away).
   */
  function endRun(finished: RunState, success: boolean) {
    let home = restAtHome(homeAquarium.value, gameData);
    if (success) home = bringCatchHome(home, finished, gameData);
    const laid = layEggs(home, finished, gameData);
    homeAquarium.value = home;
    eggs.value = [...eggs.value, ...laid];
    newEggs.value = laid.length;
    saveProfile();
  }

  /** The egg at `index` has hatched: its creature joins the home aquarium. */
  function hatchEgg(index: number) {
    const id = eggs.value[index];
    if (id === undefined) return;
    eggs.value = eggs.value.filter((_, i) => i !== index);
    homeAquarium.value = [...homeAquarium.value, hatchling(id, gameData)];
    saveProfile();
  }

  /** End the run successfully: the bucket joins the home aquarium. */
  function bringHome(finished: RunState, how: 'won' | 'left') {
    run.value = finished;
    endRun(finished, true);
    runEnd.value = how;
    screen.value = 'complete';
  }

  // Autosave after every change; a lost or finished run deletes the save.
  watch([run, combat, screen, rewardChoices, eventId, shopVisit], () => {
    if (!run.value || screen.value === 'menu' || screen.value === 'companions') return;
    if (screen.value === 'complete' || combat.value?.phase === 'lost') {
      savedGame.value = null;
      clearSavedGame();
      return;
    }
    savedGame.value = {
      version: SAVE_VERSION,
      seed: seed.value,
      // The finish-the-session prompt is only a confirmation; resuming goes back to the map.
      screen: screen.value === 'leave' ? 'map' : screen.value,
      run: run.value,
      combat: combat.value,
      rewardChoices: rewardChoices.value,
      eventId: eventId.value,
      shopVisit: shopVisit.value,
    };
    writeSavedGame(savedGame.value);
  });

  /** Pick the saved run up exactly where it was left. */
  function resume() {
    const save = savedGame.value;
    if (!save) return;
    seed.value = save.seed;
    run.value = save.run;
    combat.value = save.combat;
    rewardChoices.value = save.rewardChoices;
    eventId.value = save.eventId;
    shopVisit.value = save.shopVisit;
    screen.value = save.screen;
  }

  /** Delete all progression: the saved run and the profile (home aquarium, eggs, creature book). Can't be undone. */
  function resetProgress() {
    run.value = null;
    combat.value = null;
    savedGame.value = null;
    homeAquarium.value = [];
    broughtSlots.value = [];
    creatureBook.value = {};
    biggestCatch.value = {};
    eggs.value = [];
    clearSavedGame();
    clearProfile();
  }

  /** Back to the landing menu; the run stays saved. */
  function toMenu() {
    screen.value = 'menu';
  }

  function newRun(newSeed: number) {
    seed.value = newSeed;
    run.value = null;
    combat.value = null;
    broughtSlots.value = [];
    // Next, choose who to bring along (skipped when the home aquarium is empty).
    if (homeAquarium.value.length) screen.value = 'companions';
    else startRun();
  }

  /** Every run starts with the first build: there's no build choice for now. */
  function startRun() {
    // The brought creatures leave the home aquarium now: like the rest of the bucket, they only
    // come back if the run is successful.
    run.value = createRun(seed.value, gameData, startingBuilds(gameData)[0].id, brought.value);
    if (brought.value.length) {
      homeAquarium.value = homeLeft.value;
      broughtSlots.value = [];
      saveProfile();
    }
    screen.value = 'map';
  }

  /**
   * Debug only (the menu's dev buttons): a fresh run with the first build, put on level
   * `levelIndex` next to its mini-boss or boss, and straight into that fight.
   */
  function debugStartAt(levelIndex: number, kind: 'miniBoss' | 'boss', newSeed: number) {
    seed.value = newSeed;
    combat.value = null;
    const fresh = createRun(newSeed, gameData, startingBuilds(gameData)[0].id);
    const map = buildLevelMap(gameData, levelIndex, fresh);
    const nodes = map.columns.flat();
    const target = nodes.find((n) => n.kind === kind)!;
    const before = nodes.find((n) => n.next.includes(target.id))!;
    run.value = { ...fresh, level: levelIndex, map, position: before.id, visited: [START_NODE_ID, before.id] };
    travel(target.id);
  }

  function travel(nodeId: string) {
    if (!run.value) return;
    const kind = findNode(run.value.map, nodeId)?.kind;
    if (kind === 'leave') {
      leaveNodeId.value = nodeId;
      screen.value = 'leave';
      return;
    }
    if (kind === 'shop') {
      run.value = visitShop(run.value, nodeId);
      shopVisit.value = { bought: {} };
      screen.value = 'shop';
      return;
    }
    if (kind === 'treasure') {
      const visit = visitTreasure(run.value, nodeId, gameData);
      run.value = visit.run;
      eventId.value = visit.eventId;
      screen.value = 'event';
      return;
    }
    if (kind === 'event') {
      const visit = visitEvent(run.value, nodeId, gameData);
      run.value = visit.run;
      if (visit.combat) {
        combat.value = visit.combat;
        screen.value = 'combat';
      } else {
        eventId.value = visit.eventId;
        screen.value = 'event';
      }
      return;
    }
    const result = travelTo(run.value, nodeId, gameData);
    run.value = result.run;
    combat.value = result.combat;
    screen.value = 'combat';
  }

  function dispatch(action: CombatAction) {
    if (!combat.value) return;
    combat.value = applyAction(combat.value, action, gameData);
    if (combat.value.phase === 'lost' && run.value) endRun(run.value, false);
  }

  function claimVictory() {
    if (!run.value || !combat.value || combat.value.phase !== 'won') return;
    let finished = finishFight(run.value, combat.value);
    const families = fightFamilies(combat.value, gameData);
    combat.value = null;
    if (isMapComplete(finished)) {
      // A level's boss is beaten: on to the next level, or the run is won.
      if (isLastLevel(finished, gameData)) {
        bringHome(finished, 'won');
        return;
      }
      finished = enterNextLevel(finished, gameData);
    }
    const rewards = rollCardRewards(finished, gameData, { families });
    run.value = rewards.run;
    rewardChoices.value = rewards.choices;
    screen.value = finished.waiting.length ? 'bucketFull' : 'reward';
  }

  function sell(slot: number) {
    if (run.value) run.value = sellCreature(run.value, slot, gameData);
  }

  /** Bucket full: the first waiting catch takes the place of the creature at `slot`, which is sold. */
  function keepWaiting(slot: number) {
    if (run.value) afterBucketFull(keepCatch(run.value, slot, gameData));
  }

  /** Bucket full: the first waiting catch is sold. */
  function sellWaiting() {
    if (run.value) afterBucketFull(sellCatch(run.value, gameData));
  }

  /** Once no catch is waiting, on to the fight's card reward, or the map after a fight a creature fled. */
  function afterBucketFull(next: RunState) {
    run.value = next;
    if (!next.waiting.length) screen.value = rewardChoices.value.length ? 'reward' : 'map';
  }

  /** After a creature got away: carry HP over, no reward. */
  function leaveFight() {
    if (!run.value || !combat.value || combat.value.phase !== 'fled') return;
    run.value = finishFight(run.value, combat.value);
    combat.value = null;
    rewardChoices.value = [];
    // A boss getting away ends the run without a win: the bucket stays behind.
    runEnd.value = 'fled';
    if (isMapComplete(run.value)) {
      endRun(run.value, false);
      screen.value = 'complete';
    } else {
      screen.value = run.value.waiting.length ? 'bucketFull' : 'map';
    }
  }

  function chooseEvent(choiceIndex: number) {
    if (!run.value || !eventId.value) return;
    const result = applyEventChoice(run.value, eventId.value, choiceIndex, gameData);
    eventId.value = null;
    if (result.cardReward) {
      // No fight: every family's cards.
      const rewards = rollCardRewards(result.run, gameData, { families: [] });
      run.value = rewards.run;
      rewardChoices.value = rewards.choices;
      screen.value = 'reward';
    } else {
      run.value = result.run;
      screen.value = 'map';
    }
  }

  function buy(itemId: string, cardIndex?: number) {
    if (!run.value) return;
    const result = buyShopItem(run.value, shopVisit.value, itemId, gameData, cardIndex);
    run.value = result.run;
    shopVisit.value = result.visit;
  }

  function leaveShop() {
    screen.value = 'map';
  }

  /** Confirmed: move onto the finish node, which ends the run and brings the bucket home. */
  function finishSession() {
    if (!run.value || !leaveNodeId.value) return;
    bringHome(visitLeave(run.value, leaveNodeId.value), 'left');
    leaveNodeId.value = null;
  }

  /** Not yet: back to the map without moving. */
  function cancelLeave() {
    leaveNodeId.value = null;
    screen.value = 'map';
  }

  function chooseReward(cardId: string) {
    if (run.value) run.value = addCardToDeck(run.value, cardId, gameData);
    screen.value = 'map';
  }

  /** Skips (this level, Eel companions) and rerolls (the run's and the companions') of the card reward left. */
  const rewardLeft = computed(() => (run.value ? rewardOptions(run.value, gameData) : { skips: 0, rerolls: 0 }));

  function skipCardReward() {
    if (!run.value) return;
    run.value = skipReward(run.value, gameData);
    screen.value = 'map';
  }

  function rerollCardReward() {
    if (!run.value) return;
    const rerolled = rerollReward(run.value, gameData, rewardChoices.value);
    run.value = rerolled.run;
    rewardChoices.value = rerolled.choices;
  }

  /** After a boss, on its card reward: remove a card for free, then still choose the reward. */
  function removeBossCard(cardIndex: number) {
    if (run.value) run.value = removeCardAfterBoss(run.value, cardIndex);
  }

  /** After a boss, on its card reward: head home now, as from a leave node. */
  function endRunAfterBoss() {
    if (run.value) bringHome(run.value, 'left');
  }

  return {
    data: gameData,
    seed,
    run,
    combat,
    screen,
    rewardChoices,
    eventId,
    shopVisit,
    dispatch,
    startRun,
    travel,
    claimVictory,
    leaveFight,
    chooseReward,
    rewardLeft,
    skipCardReward,
    removeBossCard,
    endRunAfterBoss,
    rerollCardReward,
    chooseEvent,
    buy,
    leaveShop,
    finishSession,
    cancelLeave,
    sell,
    keepWaiting,
    sellWaiting,
    newRun,
    debugStartAt,
    savedGame,
    homeAquarium,
    creatureBook,
    biggestCatch,
    eggs,
    newEggs,
    brought,
    homeLeft,
    bring,
    unbring,
    hatchEgg,
    runEnd,
    resume,
    toMenu,
    resetProgress,
  };
}
