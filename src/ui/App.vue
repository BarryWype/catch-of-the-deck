<script setup lang="ts">
import { SESSION_SLOTS } from '../engine';
import Aquarium from './Aquarium.vue';
import BuildSelect from './BuildSelect.vue';
import CombatView from './CombatView.vue';
import EggTray from './EggTray.vue';
import EventScreen from './EventScreen.vue';
import MapView from './MapView.vue';
import MenuScreen from './MenuScreen.vue';
import RewardScreen from './RewardScreen.vue';
import SessionSlots from './SessionSlots.vue';
import ShopScreen from './ShopScreen.vue';
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
const { data, seed, run, combat, screen, rewardChoices, eventId, shopVisit, savedGame, homeAquarium, creatureBook, eggs, newEggs, brought, homeLeft, runEnd } = game;

function newRun() {
  game.newRun(randomSeed());
}

/** The first run from the menu honours `?seed=`; later ones are random. */
let firstRun = true;
function newRunFromMenu() {
  game.newRun(firstRun ? initialSeed() : randomSeed());
  firstRun = false;
}
</script>

<template>
  <header class="topbar">
    <h1>Spire Slice</h1>
    <div v-if="screen !== 'menu'" class="run-info">
      <template v-if="run && screen !== 'build'">
        <span>{{ data.builds[run.build]?.name }}</span>
        <span>Floor {{ run.floor }}</span>
        <span>❤️ {{ combat?.player.hp ?? run.hp }}/{{ run.maxHp }}</span>
        <span title="Coins">🪙 {{ run.coins }}</span>
        <span>🂠 Deck {{ run.deck.length }}</span>
      </template>
      <span class="seed" title="Open with ?seed=N in the URL to replay this run">Seed {{ seed }}</span>
      <button class="ghost" @click="game.toMenu">Menu</button>
      <button class="ghost" @click="newRun">New run</button>
    </div>
  </header>

  <main>
    <MenuScreen
      v-if="screen === 'menu'"
      :can-resume="!!savedGame"
      :home-aquarium="homeAquarium"
      :creature-book="creatureBook"
      :data="data"
      @resume="game.resume"
      @new-run="newRunFromMenu"
      @reset="game.resetProgress"
    />
    <div v-else-if="screen === 'build' || !run" class="build-layout">
      <BuildSelect class="build-choices" :data="data" @choose="game.chooseBuild" />
      <div class="home-row">
        <Aquarium
          class="aquarium"
          :creatures="homeLeft.map((c) => c.id)"
          :bonds="homeLeft.map((c) => c.bond)"
          :data="data"
          action="bring"
          :bring-blocked="brought.length >= SESSION_SLOTS ? 'All session slots are taken.' : undefined"
          title="Home aquarium"
          icon="🏠"
          @bring="game.bring"
        />
        <SessionSlots :brought="brought" :data="data" @remove="game.unbring" />
      </div>
    </div>
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
        title="Bucket"
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
      @action="game.dispatch"
      @claim-victory="game.claimVictory"
      @leave="game.leaveFight"
      @restart="newRun"
    />
    <EventScreen v-else-if="screen === 'event' && eventId" :event-id="eventId" :run="run" :data="data" @choose="game.chooseEvent" />
    <section v-else-if="screen === 'leave'" class="complete">
      <div class="leave-icon">🏠</div>
      <h2>Head home?</h2>
      <p>
        This ends your run here. The {{ run.bucket.length }} creature{{ run.bucket.length === 1 ? '' : 's' }} in your
        bucket {{ run.bucket.length === 1 ? 'joins' : 'join' }} your home aquarium.
      </p>
      <div class="complete-actions">
        <button class="ghost" @click="game.cancelLeave">Go back</button>
        <button @click="game.finishSession">Head home</button>
      </div>
    </section>
    <RewardScreen v-else-if="screen === 'reward'" :choices="rewardChoices" :data="data" @choose="game.chooseReward" />
    <section v-else-if="screen === 'complete'" class="complete">
      <template v-if="runEnd !== 'fled'">
        <h2>{{ runEnd === 'won' ? 'Run complete!' : 'Heading home' }}</h2>
        <p v-if="runEnd === 'won'">You beat every boss of the coast, from kid to elder, with {{ run.hp }} HP left.</p>
        <p v-else>You call it a day halfway along the shore, with {{ run.hp }} HP left.</p>
        <p>
          🪣 → 🏠 {{ run.bucket.length }} creature{{ run.bucket.length === 1 ? '' : 's' }} from your bucket
          {{ run.bucket.length === 1 ? 'joins' : 'join' }} your home aquarium.
        </p>
      </template>
      <template v-else>
        <h2>The boss got away</h2>
        <p>Your run ends here, and your bucket stays behind.</p>
      </template>
      <p v-if="newEggs" class="new-eggs">🥚 {{ newEggs === 1 ? 'An egg was' : `${newEggs} eggs were` }} laid in your home aquarium!</p>
      <div class="complete-actions">
        <button class="ghost" @click="game.toMenu">Back to the menu</button>
        <button @click="newRun">Start a new run</button>
      </div>
    </section>
  </main>

  <!-- Only between runs, where the home aquarium is: not over the map's bucket or the cards. -->
  <EggTray v-if="['menu', 'build', 'complete'].includes(screen)" :eggs="eggs" :data="data" @hatch="game.hatchEgg" />
</template>

<style scoped>

/* Map on top, aquarium fills whatever height is left. */
.map-layout {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: calc(100vh - 64px);
  padding-bottom: 12px;
}
.map-layout .aquarium { flex: 1; }
.map-layout .shop-panel { flex-shrink: 0; padding-top: 2vh; }

/* Build choices on top (scrolling if needed), the aquarium on the bottom half. */
.build-layout {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: calc(100vh - 64px);
  padding-bottom: 12px;
}
.build-layout .build-choices { flex: 1; min-height: 0; overflow-y: auto; }
.build-layout .home-row { display: flex; flex: 0 0 50vh; gap: 12px; }
.build-layout .aquarium { flex: 1; min-width: 0; }

.complete { display: flex; flex-direction: column; align-items: center; gap: 8px; padding-top: 15vh; }
.complete h2 { margin: 0; font-size: 2rem; }
.complete p { margin: 0; max-width: 520px; text-align: center; }
.leave-icon { font-size: 4rem; line-height: 1; }
.new-eggs { color: var(--highlight); font-weight: 600; }
.complete-actions { display: flex; gap: 8px; margin-top: 12px; }
</style>
