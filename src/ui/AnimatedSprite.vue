<script setup lang="ts">
import { computed } from 'vue';
import type { AnimationClip } from './sprites';

/**
 * Plays an animation clip. Looping clips run forever; one-shot clips stop on
 * their last frame and emit `done`. Change `playKey` to restart.
 *
 * The whole sheet sits inside a one-frame window and slides by whole frames with a CSS
 * `steps()` animation on `transform`: no timers, no re-renders, nothing repainted.
 */
const props = withDefaults(defineProps<{ clip: AnimationClip; playKey?: number; size?: number }>(), {
  playKey: 0,
  size: 192,
});
const emit = defineEmits<{ done: [] }>();

const sheet = computed(() => {
  const { url, frames, rows, columns, row, fps, loop } = props.clip;
  const animated = frames > 1;
  return {
    // A new key restarts the animation (Vue replaces the element).
    key: `${url}|${row}|${props.playKey}`,
    style: {
      width: `${(columns ?? frames) * props.size}px`,
      height: `${rows * props.size}px`,
      backgroundImage: `url(${url})`,
      '--row': `${-row * props.size}px`,
      '--last': `${-(frames - 1) * props.size}px`,
      '--duration': `${frames / fps}s`,
      '--steps': frames,
      '--count': loop ? 'infinite' : 1,
    },
    animated,
  };
});

function onEnd() {
  if (!props.clip.loop) emit('done');
}
</script>

<template>
  <div class="animated-sprite" :style="{ width: `${size}px`, height: `${size}px` }" role="img">
    <!-- Keyed on the clip's url, row and playKey only: the parent builds a new clip object on every
         render, which must not restart a one-shot animation that already played. -->
    <div :key="sheet.key" class="sheet" :class="{ animated: sheet.animated }" :style="sheet.style" @animationend="onEnd" />
  </div>
</template>

<style scoped>
.animated-sprite { position: relative; flex-shrink: 0; overflow: hidden; }
.sheet {
  position: absolute;
  top: 0;
  left: 0;
  background-size: 100% 100%;
  background-repeat: no-repeat;
  image-rendering: pixelated;
  transform: translate(0, var(--row));
}
.sheet.animated { animation: sprite-frames var(--duration) steps(var(--steps), jump-none) var(--count) forwards; }
@keyframes sprite-frames {
  from { transform: translate(0, var(--row)); }
  to { transform: translate(var(--last), var(--row)); }
}
</style>
