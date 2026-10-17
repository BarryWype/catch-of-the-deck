<script setup lang="ts">
import { computed, ref } from 'vue';
import { creatureTypeNames, describeCard, shopItemBlocked, type GameData, type RunState, type ShopItemDef, type ShopVisit } from '../engine';
import CardView from './CardView.vue';
import { t } from './i18n';

const props = defineProps<{ run: RunState; data: GameData; visit: ShopVisit }>();
const emit = defineEmits<{ buy: [itemId: string, cardIndex?: number]; leave: [] }>();

const tagNames = computed(() => creatureTypeNames(props.data));
/** The `removeCard` item waiting for the player to pick a card. */
const removing = ref<ShopItemDef | null>(null);

function effectText(item: ShopItemDef) {
  return item.effect.type === 'heal' ? t('shop.heal', { n: item.effect.amount }) : t('shop.removeCard');
}

function onBuy(item: ShopItemDef) {
  if (item.effect.type === 'removeCard') removing.value = item;
  else emit('buy', item.id);
}

function onPickCard(index: number) {
  if (!removing.value) return;
  emit('buy', removing.value.id, index);
  removing.value = null;
}
</script>

<template>
  <section class="shop">
    <div class="icon">🛒</div>
    <h2>{{ t('shop.title') }}</h2>
    <p class="wallet">{{ t('shop.wallet', { coins: run.coins, grit: run.hp, max: run.maxHp }) }}</p>

    <template v-if="removing">
      <p>{{ t('shop.chooseRemove', { coins: removing.price }) }}</p>
      <div class="deck">
        <CardView
          v-for="(id, i) in run.deck"
          :key="i"
          :card="data.cards[id]"
          :description="describeCard(data.cards[id], { tagNames })"
          @click="onPickCard(i)"
        />
      </div>
      <button class="ghost" @click="removing = null">{{ t('common.cancel') }}</button>
    </template>

    <template v-else>
      <div class="items">
        <div v-for="item in data.shop" :key="item.id" class="item">
          <span class="item-icon">{{ item.icon ?? '🎁' }}</span>
          <strong>{{ item.name }}</strong>
          <span class="text">{{ effectText(item) }}{{ item.limit ? ` ${t('shop.oncePerVisit')}` : '' }}</span>
          <button :disabled="!!shopItemBlocked(item, run, visit)" @click="onBuy(item)">🪙 {{ item.price }}</button>
          <span class="blocked">{{ shopItemBlocked(item, run, visit) ?? '' }}</span>
        </div>
      </div>
      <button class="ghost" @click="emit('leave')">{{ t('shop.leave') }}</button>
    </template>
  </section>
</template>

<style scoped>
.shop { display: flex; flex-direction: column; align-items: center; gap: 10px; padding-top: 8vh; text-align: center; }
.shop h2 { margin: 0; }
.icon { font-size: 4rem; line-height: 1; filter: drop-shadow(0 6px 18px rgb(245 215 110 / 0.3)); }
.wallet { margin: 0 0 12px; color: var(--muted); }
.items { display: flex; gap: 16px; flex-wrap: wrap; justify-content: center; }
.item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 200px;
  padding: 16px;
  border-radius: 14px;
  background: linear-gradient(180deg, #26304a, #1b2233);
  border: 1px solid var(--line);
  box-shadow: 0 4px 14px rgb(0 0 0 / 0.3);
  transition: transform 0.15s ease, border-color 0.15s ease;
}
@media (hover: hover) {
  .item:hover { transform: translateY(-3px); border-color: rgb(245 215 110 / 0.45); }
}
.item-icon { font-size: 2.4rem; }
.text { font-size: 0.85rem; color: var(--muted); min-height: 2.4em; }
.blocked { font-size: 0.75rem; color: var(--muted); min-height: 1em; }
.deck { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; max-width: 900px; }
</style>
