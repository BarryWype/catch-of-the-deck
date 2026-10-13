<script setup lang="ts">
import { computed } from 'vue';
import { isDebuff, STATUS_META, type StatusId, type Statuses } from '../engine';

const props = defineProps<{ statuses: Statuses }>();

const ICONS: Record<StatusId, string> = { strength: '💪', vulnerable: '💔', weak: '🥀', snared: '🕸️', poison: '☠️' };
const entries = computed(() => Object.entries(props.statuses) as Array<[StatusId, number]>);
</script>

<template>
  <div class="statuses">
    <span
      v-for="[id, amount] in entries"
      :key="id"
      class="status"
      :class="isDebuff(id, amount) ? 'debuff' : 'buff'"
      v-tip="{ title: `${STATUS_META[id].name} ${amount}`, body: STATUS_META[id].description }"
    >
      {{ ICONS[id] }}<b>{{ amount }}</b>
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
