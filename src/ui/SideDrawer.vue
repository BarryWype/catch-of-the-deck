<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { t } from './i18n';

/**
 * A tab on the left or right edge of the screen that opens a full-height drawer from that side.
 * `tabOffset` moves the tab up (negative) or down from the middle of the edge, so tabs can stack.
 * The `header` slot goes after the title; the default slot is the drawer's content.
 */
const props = withDefaults(defineProps<{ side?: 'left' | 'right'; icon: string; title: string; tabOffset?: number; width?: number }>(), {
  side: 'right',
  tabOffset: 0,
  width: 620,
});

const open = ref(false);
const closeButton = ref<HTMLButtonElement>();

async function show() {
  open.value = true;
  await nextTick();
  closeButton.value?.focus();
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false;
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));

defineExpose({ close: () => (open.value = false) });
</script>

<template>
  <button
    class="tab"
    :class="side"
    :style="{ top: `calc(50% + ${props.tabOffset}px)` }"
    :aria-label="t('drawer.open', { title })"
    v-tip="title"
    @click="show"
  >
    {{ icon }}
  </button>
  <div class="scrim" :class="{ open }" @click="open = false" />
  <aside
    class="drawer"
    :class="[side, { open }]"
    :style="{ width: `min(${width}px, 92vw)` }"
    role="dialog"
    aria-modal="true"
    :aria-label="title"
    :inert="!open"
  >
    <header>
      <h2>{{ icon }} {{ title }}</h2>
      <slot name="header" />
      <button ref="closeButton" class="ghost close" :aria-label="t('drawer.close', { title })" @click="open = false">✕</button>
    </header>
    <div class="content">
      <slot />
    </div>
  </aside>
</template>

<style scoped>
.tab {
  position: absolute;
  z-index: 2;
  transform: translateY(-50%);
  padding: 12px 10px;
  font-size: 1.6rem;
  line-height: 1;
}
.tab.right { right: 0; border-radius: 12px 0 0 12px; }
.tab.left { left: 0; border-radius: 0 12px 12px 0; }
.scrim {
  position: absolute;
  inset: 0;
  z-index: 3;
  background: rgb(5 8 12 / 0.55);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s ease;
}
.scrim.open { opacity: 1; pointer-events: auto; }
.drawer {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 4;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  transition: transform 0.25s ease;
}
.drawer.right { right: 0; box-shadow: -8px 0 24px rgb(0 0 0 / 0.45); transform: translateX(100%); }
.drawer.left { left: 0; box-shadow: 8px 0 24px rgb(0 0 0 / 0.45); transform: translateX(-100%); }
.drawer.open { transform: translateX(0); }
.drawer header { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-bottom: 1px solid #2c3a4a; }
.drawer h2 { margin: 0; font-size: 1.2rem; }
.close { margin-left: auto; padding: 4px 10px; }
.content { flex: 1; min-height: 0; overflow-y: auto; }

@media (prefers-reduced-motion: reduce) {
  .drawer, .scrim { transition: none; }
}
</style>
