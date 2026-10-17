<script setup lang="ts">
import GameIcon from './GameIcon.vue';
import { computed } from 'vue';
import { isDebuff, statusDescription, statusName, type StatusId, type Statuses } from '../engine';

const props = defineProps<{ statuses: Statuses }>();

const ICONS: Record<StatusId, string> = { strength: 'muscle', vulnerable: '💔', weak: 'muscle-down', snared: 'net-blue', venom: 'venom4', slow: 'trap1', cowed: '😨', intimidated: '🦷', lured: 'lure1', distracted: '✨', dazzled: '🌈', windUp: '⚠️',
  burrowed: '🕳️', tangled: '🪢', numbFingers: '🥶', pinchedHand: '🤏', skittish: '😬', spines: 'thorn', baitGrabbed: 'worm' };
const entries = computed(() => Object.entries(props.statuses) as Array<[StatusId, number]>);
</script>

<template>
  <div class="statuses">
    <span
      v-for="[id, amount] in entries"
      :key="id"
      class="status"
      :class="isDebuff(id, amount) ? 'debuff' : 'buff'"
      v-tip="{ title: `${statusName(id)} ${amount}`, body: statusDescription(id) }"
    >
      <GameIcon :icon="ICONS[id]" /><b>{{ amount }}</b>
    </span>
  </div>
</template>

<style scoped>
.statuses { display: flex; gap: 4px; min-height: 22px; flex-wrap: wrap; justify-content: center; }
.status {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 0.8rem;
  cursor: help;
}
.buff { background: #234a2e; }
.debuff { background: #4a2347; }
</style>
