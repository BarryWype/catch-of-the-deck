import { computed, ref, shallowRef, watch } from 'vue';
import { gameData } from './i18n';
import {
  addCardToDeck,
  baitCatch,
  rerollReward,
  removeCardAfterBoss,
  rewardOptions,
  skipReward,
  applyEventChoice,
  buyShopItem,
  findNode,
  applyAction,
  bringCatchHome,
  buyNode,
  catchesOf,
  finishCombat,
  keepCatch,
  recordSizes,
  sellCatch,
  restAtHome,
  restingBondLevel,
  injuredCompanions,
  recoverCompanions,
  shellsEarned,
  SESSION_SLOTS,
  takeFromHome,
  createRun,
  enterNextLevel,
  isLastLevel,
  applyWithInfiniteEnergy,
  debugCreature,
  startScenario,
  fishermenToMeet,
  newUnlocks,
  unlockedBuilds,
  visitFisherman,
  isReleaseFight,
  visitTreasure,
  recordEncounter,
  isMapComplete,
  visitLeave,
  fightFamilies,
  rollCardRewards,
  sellCreature,
  travelTo,
  useAsBait,
  useAsBaitInFight,
  visitEvent,
  visitShop,
  takeRelic,
  skipRelics,
  type CatchSize,
  type CombatAction,
  type CombatState,
  type DebugScenario,
  type Discovery,
  type HomeCreature,
  type Logbook,
  type RecoveringCreature,
  type RunState,
  type ShopVisit,
} from '../engine';
import {
  applyTransfer,
  clearProfile,
  clearSavedGame,
  loadProfile,
  loadSavedGame,
  PROFILE_VERSION,
  SAVE_VERSION,
  writeProfile,
  writeSavedGame,
  type Profile,
  type SavedGame,
  type TransferContents,
} from './saveStore';

export type Screen = 'menu' | 'build' | 'companions' | 'map' | 'combat' | 'bucketFull' | 'event' | 'fisherman' | 'shop' | 'leave' | 'reward' | 'complete';

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
  /** The store being visited, and what was bought there, on the shop screen. */
  const shopVisit = ref<ShopVisit>({ store: 'tackle', bought: {} });
  /** The run that Resume would pick up, if any. */
  const savedGame = shallowRef<SavedGame | null>(null);
  loadSavedGame().then((save) => (savedGame.value = save));
  /** Creatures brought home from won runs, with their bond; shown on the menu and companions screens. */
  const homeAquarium = ref<HomeCreature[]>([]);
  /** Every creature met so far, seen or captured; shown in the creature book. */
  const creatureBook = shallowRef<Readonly<Record<string, Discovery>>>({});
  /** The biggest of each species ever caught, in the creature book. */
  const biggestCatch = shallowRef<Readonly<Record<string, CatchSize>>>({});
  /** Builds unlocked through fishermen's quests, and the fishermen met (whose quests are open). */
  const unlocked = ref<string[]>([]);
  const fishermenMet = ref<string[]>([]);
  /** Golden shells to spend in the Logbook, and its nodes bought (which every new run starts with). */
  const logbook = ref<Logbook>({ shells: 0, unlocked: [] });
  /** Companions back injured from runs that ended badly: they rejoin the home aquarium after enough map nodes. */
  const recovering = ref<RecoveringCreature[]>([]);
  /** The tutorials already shown (TutorialOverlay.vue). All of them until the profile is read, so none flashes up for a returning player. */
  const tutorialsSeen = ref<string[]>(['map', 'fight']);
  function setProfile(profile: Profile) {
    homeAquarium.value = profile.homeAquarium;
    creatureBook.value = profile.creatureBook;
    biggestCatch.value = profile.biggestCatch;
    unlocked.value = profile.unlockedBuilds;
    fishermenMet.value = profile.fishermenMet;
    logbook.value = { shells: profile.goldenShells, unlocked: profile.logbook };
    recovering.value = profile.recovering;
    tutorialsSeen.value = profile.tutorials;
  }
  loadProfile().then(setProfile);

  /** A tutorial played to its end or skipped: it won't show again. */
  function tutorialDone(id: string) {
    if (tutorialsSeen.value.includes(id)) return;
    tutorialsSeen.value = [...tutorialsSeen.value, id];
    saveProfile();
  }
  /** From the options: every tutorial shows again, on its screen. */
  function replayTutorials() {
    tutorialsSeen.value = [];
    saveProfile();
  }
  /** The builds a run can start with. */
  const builds = computed(() => unlockedBuilds(gameData, unlocked.value));
  /** The finish node the player clicked, waiting for them to confirm on the leave screen. */
  const leaveNodeId = ref<string | null>(null);
  /** On the end screen, how the run ended. Only `fled` leaves the bucket behind. */
  const runEnd = ref<'won' | 'left' | 'fled'>('won');

  /**
   * The debug scenario being played (see README → Debug panel), null otherwise. It plays in a
   * sandbox: nothing is saved, and `realProfile` is put back when it ends.
   */
  const debugScenario = shallowRef<DebugScenario | null>(null);
  /** Debug only: cards cost no energy. */
  const infiniteEnergy = ref(false);
  let realProfile: {
    home: HomeCreature[];
    book: typeof creatureBook.value;
    biggest: typeof biggestCatch.value;
    unlocked: string[];
    met: string[];
    logbook: Logbook;
    recovering: RecoveringCreature[];
  } | null = null;

  function saveProfile() {
    if (debugScenario.value) return;
    writeProfile({
      version: PROFILE_VERSION,
      homeAquarium: homeAquarium.value,
      creatureBook: { ...creatureBook.value },
      biggestCatch: { ...biggestCatch.value },
            unlockedBuilds: unlocked.value,
      fishermenMet: fishermenMet.value,
      goldenShells: logbook.value.shells,
      logbook: logbook.value.unlocked,
      recovering: recovering.value,
      tutorials: tutorialsSeen.value,
    });
  }

  /**
   * A run that didn't end well sends its companions home injured (`injuredCompanions`); one that
   * did no node sends them straight back.
   */
  function injure(finished: RunState) {
    const { recovering: still, back } = recoverCompanions([...recovering.value, ...injuredCompanions(finished)], 0);
    recovering.value = still;
    homeAquarium.value = [...homeAquarium.value, ...back];
  }

  /** A map node stepped on: injured companions rest one node, and those done resting come home. */
  function restInjured() {
    if (!recovering.value.length) return;
    const { recovering: still, back } = recoverCompanions(recovering.value, 1);
    recovering.value = still;
    homeAquarium.value = [...homeAquarium.value, ...back];
    saveProfile();
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

  /** Builds the last run unlocked, for the end screen. */
  const newlyUnlocked = ref<string[]>([]);

  /**
   * Every run end (not an abandoned one): creatures that stayed home bond a little, a successful
   * run brings its bucket home and unlocks the builds whose quests are now met (a lost one only its
   * creatures in life jackets, its other companions coming back injured, and either brings the
   * parcels posted home).
   */
  function endRun(finished: RunState, success: boolean) {
    let home = restAtHome(homeAquarium.value, gameData, restingBondLevel(finished.progression, gameData));
    home = bringCatchHome(home, finished, gameData, success);
    homeAquarium.value = home;
    if (!success) injure(finished);
    home = homeAquarium.value;
    newlyUnlocked.value = success ? newUnlocks(gameData, unlocked.value, fishermenMet.value, home, finished.questsShown) : [];
    unlocked.value = [...unlocked.value, ...newlyUnlocked.value];
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
    if (debugScenario.value || !run.value || screen.value === 'menu' || screen.value === 'build' || screen.value === 'companions') return;
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
    shellsWon.value = 0;
  }

  /** Delete all progression: the saved run and the profile (home aquarium, creature book, Logbook). Can't be undone. */
  function resetProgress() {
    run.value = null;
    combat.value = null;
    savedGame.value = null;
    homeAquarium.value = [];
    unlocked.value = [];
    fishermenMet.value = [];
    logbook.value = { shells: 0, unlocked: [] };
    recovering.value = [];
    tutorialsSeen.value = [];
    broughtSlots.value = [];
    creatureBook.value = {};
    biggestCatch.value = {};
    clearSavedGame();
    clearProfile();
  }

  /**
   * Replace this device's progress with what a transfer code brought, and show it straight away.
   * Refused (false) while a debug scenario plays: the sandbox must not write the real files.
   */
  function importTransfer(contents: TransferContents): boolean {
    if (debugScenario.value) return false;
    applyTransfer(contents);
    run.value = null;
    combat.value = null;
    broughtSlots.value = [];
    savedGame.value = contents.save;
    setProfile(contents.profile);
    screen.value = 'menu';
    return true;
  }

  /** Back to the landing menu; the run stays saved. A debug scenario ends there. */
  function toMenu() {
    if (debugScenario.value) endScenario();
    screen.value = 'menu';
  }

  /** The build and starting item picked on the build screen, used when the run starts. */
  const chosenBuild = ref<{ buildId: string; itemId: string | undefined }>();

  function newRun(newSeed: number) {
    if (debugScenario.value) endScenario();
    // The saved run is abandoned: its companions come back injured.
    if (savedGame.value) {
      injure(savedGame.value.run);
      saveProfile();
      savedGame.value = null;
      clearSavedGame();
    }
    seed.value = newSeed;
    run.value = null;
    combat.value = null;
    broughtSlots.value = [];
    // Choose a build, unless only one is unlocked.
    if (builds.value.length > 1) screen.value = 'build';
    else chooseBuild(builds.value[0].id, undefined);
  }

  /** Next, choose who to bring along (skipped when the home aquarium is empty). */
  function chooseBuild(buildId: string, itemId: string | undefined) {
    chosenBuild.value = { buildId, itemId };
    if (homeAquarium.value.length) screen.value = 'companions';
    else startRun();
  }

  /** Back from the companions screen: to the build screen, or the menu when it was skipped. */
  function toBuildSelect() {
    screen.value = builds.value.length > 1 ? 'build' : 'menu';
  }

  function startRun() {
    const { buildId, itemId } = chosenBuild.value ?? { buildId: builds.value[0].id, itemId: undefined };
    // The brought creatures leave the home aquarium now: like the rest of the bucket, they only
    // come back if the run is successful.
    run.value = createRun(seed.value, gameData, buildId, brought.value, itemId, fishermenToMeet(gameData, unlocked.value), logbook.value.unlocked);
    if (brought.value.length) {
      homeAquarium.value = homeLeft.value;
      broughtSlots.value = [];
      saveProfile();
    }
    screen.value = 'map';
  }

  /**
   * Debug only: play `scenario` in the sandbox, with its profile (or a copy of the real one), from
   * its start node.
   */
  function playScenario(scenario: DebugScenario) {
    if (!debugScenario.value) {
      realProfile = {
        home: homeAquarium.value,
        book: creatureBook.value,
        biggest: biggestCatch.value,
                unlocked: unlocked.value,
        met: fishermenMet.value,
        logbook: logbook.value,
        recovering: recovering.value,
      };
    }
    debugScenario.value = scenario;
    const profile = scenario.profile;
    if (profile) {
      homeAquarium.value = profile.home.map((c) => debugCreature(c, gameData));
      unlocked.value = [...profile.unlocked];
      fishermenMet.value = [...profile.fishermenMet];
      logbook.value = { shells: profile.shells ?? 0, unlocked: [...(profile.progression ?? [])] };
      recovering.value = [];
    }
    const started = startScenario(scenario, gameData, logbook.value.unlocked);
    shellsWon.value = 0;
    seed.value = started.run.seed;
    run.value = started.run;
    combat.value = started.combat ?? null;
    eventId.value = started.eventId ?? null;
    if (started.visit) shopVisit.value = started.visit;
    rewardChoices.value = [];
    if (started.kind === 'fisherman') {
      const id = findNode(started.run.map, started.run.position)?.fisherman;
      if (id && !fishermenMet.value.includes(id)) fishermenMet.value = [...fishermenMet.value, id];
    }
    screen.value = started.kind === 'fight' ? 'combat' : started.kind === 'treasure' ? 'event' : started.kind;
  }

  /** Leave the debug scenario: the real profile is back, untouched, and the menu shows. */
  function endScenario() {
    if (realProfile) {
      homeAquarium.value = realProfile.home;
      creatureBook.value = realProfile.book;
      biggestCatch.value = realProfile.biggest;
      unlocked.value = realProfile.unlocked;
      fishermenMet.value = realProfile.met;
      logbook.value = realProfile.logbook;
      recovering.value = realProfile.recovering;
      realProfile = null;
    }
    debugScenario.value = null;
    infiniteEnergy.value = false;
    run.value = null;
    combat.value = null;
    eventId.value = null;
    screen.value = 'menu';
  }

  /** Debug only: the fight as the in-fight tools changed it. */
  function setDebugCombat(state: CombatState) {
    if (!debugScenario.value || !combat.value) return;
    combat.value = state;
    if (state.phase === 'lost' && run.value) endRun(run.value, false);
  }

  function travel(nodeId: string) {
    if (!run.value) return;
    if (nodeId === run.value.position) return returnToShop();
    const kind = findNode(run.value.map, nodeId)?.kind;
    if (kind === 'leave') {
      leaveNodeId.value = nodeId;
      screen.value = 'leave';
      return;
    }
    restInjured();
    if (kind === 'shop') {
      const visit = visitShop(run.value, nodeId, gameData);
      run.value = visit.run;
      shopVisit.value = visit.visit;
      screen.value = 'shop';
      return;
    }
    if (kind === 'fisherman') {
      run.value = visitFisherman(run.value, nodeId, gameData);
      // His quest opens now, whatever happens to this run.
      const id = findNode(run.value.map, nodeId)?.fisherman;
      if (id && !fishermenMet.value.includes(id)) {
        fishermenMet.value = [...fishermenMet.value, id];
        saveProfile();
      }
      screen.value = 'fisherman';
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

  /** Done talking with the fisherman: back to the map. */
  function leaveFisherman() {
    screen.value = 'map';
  }

  function dispatch(action: CombatAction) {
    if (!combat.value) return;
    combat.value = debugScenario.value && infiniteEnergy.value ? applyWithInfiniteEnergy(combat.value, action, gameData) : applyAction(combat.value, action, gameData);
    if (combat.value.phase === 'lost' && run.value) endRun(run.value, false);
  }

  /** Golden shells the last fight won earned (a mini-boss or boss), for its reward or end screen. */
  const shellsWon = ref(0);

  /** Buy a Logbook node with golden shells. */
  function buyLogbookNode(id: string) {
    logbook.value = buyNode(logbook.value, id, gameData);
    saveProfile();
  }

  function claimVictory() {
    if (!run.value || !combat.value || combat.value.phase !== 'won') return;
    // Kept straight away, however the run ends.
    shellsWon.value = shellsEarned(run.value, combat.value);
    if (shellsWon.value) {
      logbook.value = { ...logbook.value, shells: logbook.value.shells + shellsWon.value };
      saveProfile();
    }
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

  /** The bucket's creature at `slot` becomes bait: its cards join the deck, or the hand during a fight. */
  function bait(slot: number) {
    if (!run.value) return;
    if (screen.value === 'combat' && combat.value) {
      const made = useAsBaitInFight(run.value, combat.value, slot, gameData);
      run.value = made.run;
      combat.value = made.combat;
    } else {
      run.value = useAsBait(run.value, slot, gameData);
    }
  }

  /** Bucket full: the first waiting catch goes into the bucket, once the player has made room. */
  function keepWaiting() {
    if (run.value) afterBucketFull(keepCatch(run.value));
  }

  /** Bucket full: the first waiting catch is sold. */
  function sellWaiting() {
    if (run.value) afterBucketFull(sellCatch(run.value, gameData));
  }

  /** Bucket full: the first waiting catch is used as bait. */
  function baitWaiting() {
    if (run.value) afterBucketFull(baitCatch(run.value, gameData));
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

  /** `pick`: the deck card or bucket slot the choice acts on, when it needs one (`eventChoicePick`). */
  function chooseEvent(choiceIndex: number, pick?: number) {
    if (!run.value || !eventId.value) return;
    const result = applyEventChoice(run.value, eventId.value, choiceIndex, gameData, pick);
    eventId.value = null;
    shellsWon.value = 0;
    if (result.combat) {
      run.value = result.run;
      combat.value = result.combat;
      screen.value = 'combat';
    } else if (result.cardReward) {
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

  /** Buy a store item; `choice` is the deck card or the bucket slot it acts on, if any. */
  function buy(itemId: string, choice?: number) {
    if (!run.value) return;
    const result = buyShopItem(run.value, shopVisit.value, itemId, gameData, choice);
    run.value = result.run;
    shopVisit.value = result.visit;
  }

  function leaveShop() {
    screen.value = 'map';
  }

  /**
   * Still standing on the shop's node (the map was only looked at, or the shop left without moving
   * on): its visit, with what was bought, can be reopened.
   */
  const canReturnToShop = computed(() => {
    if (!run.value || (screen.value !== 'map' && screen.value !== 'shop')) return false;
    const node = findNode(run.value.map, run.value.position);
    return node?.kind === 'shop' && (node.store ?? 'tackle') === shopVisit.value.store;
  });

  function returnToShop() {
    if (canReturnToShop.value) screen.value = 'shop';
  }

  /** Confirmed: move onto the finish node, which ends the run and brings the bucket home. */
  function finishSession() {
    if (!run.value || !leaveNodeId.value) return;
    restInjured();
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

  /** Take one of the relics on offer (`relicChoices`, shown over the map), or leave them. */
  function takeRelicChoice(id: string) {
    if (run.value) run.value = takeRelic(run.value, id);
  }
  function skipRelicChoice() {
    if (run.value) run.value = skipRelics(run.value);
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
    chooseBuild,
    toBuildSelect,
    startRun,
    travel,
    claimVictory,
    leaveFight,
    chooseReward,
    takeRelicChoice,
    skipRelicChoice,
    rewardLeft,
    skipCardReward,
    removeBossCard,
    endRunAfterBoss,
    rerollCardReward,
    chooseEvent,
    buy,
    leaveShop,
    canReturnToShop,
    returnToShop,
    finishSession,
    cancelLeave,
    sell,
    bait,
    keepWaiting,
    sellWaiting,
    baitWaiting,
    newRun,
    builds,
    unlocked,
    fishermenMet,
    logbook,
    recovering,
    tutorialsSeen,
    tutorialDone,
    replayTutorials,
    shellsWon,
    buyLogbookNode,
    newlyUnlocked,
    leaveFisherman,
    debugScenario,
    infiniteEnergy,
    playScenario,
    endScenario,
    setDebugCombat,
    savedGame,
    homeAquarium,
    creatureBook,
    biggestCatch,
    brought,
    homeLeft,
    bring,
    unbring,
    runEnd,
    resume,
    toMenu,
    resetProgress,
    importTransfer,
  };
}
