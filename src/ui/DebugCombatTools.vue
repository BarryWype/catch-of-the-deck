<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  debugAddToHand,
  debugCatch,
  debugDraw,
  debugSetCreature,
  debugSetIntent,
  debugSetPlayer,
  debugSetStatus,
  isAlive,
  movesOf,
  SECOND_WIND_ID,
  STATUS_META,
  statusName,
  type CombatAction,
  type CombatState,
  type EnemyState,
  type GameData,
  type StatusId,
} from '../engine';
import { t, term } from './i18n';
import SideDrawer from './SideDrawer.vue';

/** The in-fight debug drawer, in a debug scenario only: every change goes through the engine's debug setters. */
const props = defineProps<{ state: CombatState; data: GameData; infiniteEnergy: boolean }>();
const emit = defineEmits<{ update: [CombatState]; action: [CombatAction]; infiniteEnergy: [boolean] }>();

const STATUSES = Object.keys(STATUS_META) as StatusId[];
const playing = computed(() => props.state.phase === 'playerTurn');
const player = computed(() => props.state.player);

const number = (event: Event) => Math.max(0, Math.round(Number((event.target as HTMLInputElement).value) || 0));
const update = (next: CombatState) => emit('update', next);

/** Per creature (and the player, under its id): the status being added and its stacks. */
const statusPick = ref<Record<string, { status: StatusId; stacks: number }>>({});
const pick = (id: string) => (statusPick.value[id] ??= { status: 'vulnerable', stacks: 1 });

const moves = (enemy: EnemyState) => [
  ...movesOf(enemy, props.data).map((m) => ({ id: m.id, name: m.name })),
  ...(enemy.boss ? [{ id: SECOND_WIND_ID, name: t('debug.secondWind') }] : []),
];
const statusList = (statuses: CombatState['player']['statuses']) => Object.entries(statuses) as [StatusId, number][];

const search = ref('');
const cardMatches = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return [];
  return Object.values(props.data.cards)
    .filter((c) => c.name.toLowerCase().includes(q) || (c.family && (props.data.families[c.family]?.name ?? c.family).toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 20);
});
const drawCount = ref(1);
</script>

<template>
  <SideDrawer side="left" icon="🛠" :title="t('debug.combatTitle')" :tab-offset="-90" :width="340">
    <div class="debug-tools">
      <p v-if="!playing" class="hint">{{ t('debug.fightOver') }}</p>
      <section>
        <h3>{{ player.name }}</h3>
        <div class="grid">
          <label>{{ term('grit') }}<input type="number" min="0" :value="player.hp" :disabled="!playing" @change="update(debugSetPlayer(state, { hp: number($event) }))" /></label>
          <label>{{ term('hold') }}<input type="number" min="0" :value="player.block" :disabled="!playing" @change="update(debugSetPlayer(state, { block: number($event) }))" /></label>
          <label>{{ term('patience') }}<input type="number" min="0" :value="player.patience" :disabled="!playing" @change="update(debugSetPlayer(state, { patience: number($event) }))" /></label>
          <label>{{ t('debug.energy') }}<input type="number" min="0" :value="player.energy" :disabled="!playing" @change="update(debugSetPlayer(state, { energy: number($event) }))" /></label>
        </div>
        <label class="check"><input type="checkbox" :checked="infiniteEnergy" @change="emit('infiniteEnergy', ($event.target as HTMLInputElement).checked)" /> {{ t('debug.infiniteEnergy') }}</label>
        <ul v-if="statusList(player.statuses).length" class="chips">
          <li v-for="[id, n] in statusList(player.statuses)" :key="id">
            <span>{{ statusName(id) }} {{ n }}</span>
            <button class="ghost" :aria-label="t('debug.remove')" :disabled="!playing" @click="update(debugSetStatus(state, player.id, id, 0))">✕</button>
          </li>
        </ul>
        <div class="row">
          <select v-model="pick(player.id).status" :aria-label="t('debug.status')"><option v-for="s in STATUSES" :key="s" :value="s">{{ statusName(s) }}</option></select>
          <input v-model.number="pick(player.id).stacks" type="number" :aria-label="t('debug.stacks')" />
          <button class="ghost" :disabled="!playing" @click="update(debugSetStatus(state, player.id, pick(player.id).status, pick(player.id).stacks))">{{ t('debug.set') }}</button>
        </div>
      </section>

      <section v-for="enemy in state.enemies" :key="enemy.id">
        <h3>{{ enemy.name }} <small v-if="!isAlive(enemy)">· {{ t('debug.caught') }}</small></h3>
        <template v-if="isAlive(enemy)">
          <div class="grid">
            <label>{{ t('debug.health', { max: enemy.maxHp }) }}<input type="number" min="0" :value="enemy.hp" :disabled="!playing" @change="update(debugSetCreature(state, enemy.id, { hp: number($event) }))" /></label>
            <label>{{ t('debug.will', { max: enemy.escapeAt }) }}<input type="number" min="0" :value="enemy.escape" :disabled="!playing" @change="update(debugSetCreature(state, enemy.id, { escape: number($event) }))" /></label>
          </div>
          <label>{{ t('debug.nextMove') }}
            <select :value="enemy.intent ?? ''" :disabled="!playing" @change="update(debugSetIntent(state, enemy.id, ($event.target as HTMLSelectElement).value, data))">
              <option v-for="m in moves(enemy)" :key="m.id" :value="m.id">{{ m.name }}</option>
            </select>
          </label>
          <ul v-if="statusList(enemy.statuses).length" class="chips">
            <li v-for="[id, n] in statusList(enemy.statuses)" :key="id">
              <span>{{ statusName(id) }} {{ n }}</span>
              <button class="ghost" :aria-label="t('debug.remove')" :disabled="!playing" @click="update(debugSetStatus(state, enemy.id, id, 0))">✕</button>
            </li>
          </ul>
          <div class="row">
            <select v-model="pick(enemy.id).status" :aria-label="t('debug.status')"><option v-for="s in STATUSES" :key="s" :value="s">{{ statusName(s) }}</option></select>
            <input v-model.number="pick(enemy.id).stacks" type="number" :aria-label="t('debug.stacks')" />
            <button class="ghost" :disabled="!playing" @click="update(debugSetStatus(state, enemy.id, pick(enemy.id).status, pick(enemy.id).stacks))">{{ t('debug.set') }}</button>
          </div>
          <div class="row">
            <button class="ghost" :disabled="!playing" @click="update(debugCatch(state, enemy.id, 'health'))">{{ t('debug.catchHealth') }}</button>
            <button class="ghost" :disabled="!playing" @click="update(debugCatch(state, enemy.id, 'will'))">{{ t('debug.catchWill') }}</button>
          </div>
        </template>
      </section>

      <section>
        <h3>{{ t('debug.cards') }}</h3>
        <input v-model="search" type="search" :placeholder="t('debug.searchCards')" :aria-label="t('debug.searchCards')" />
        <ul v-if="cardMatches.length" class="matches">
          <li v-for="c in cardMatches" :key="c.id">
            <button class="ghost" :disabled="!playing" @click="update(debugAddToHand(state, c.id, data))">+ {{ c.name }}</button>
          </li>
        </ul>
        <div class="row">
          <input v-model.number="drawCount" type="number" min="1" :aria-label="t('debug.drawCount')" />
          <button class="ghost" :disabled="!playing" @click="update(debugDraw(state, drawCount))">{{ t('debug.draw') }}</button>
        </div>
        <button class="ghost" :disabled="!playing" @click="emit('action', { type: 'endTurn' })">{{ t('debug.skipTurn') }}</button>
      </section>
    </div>
  </SideDrawer>
</template>
