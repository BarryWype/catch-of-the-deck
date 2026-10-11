<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { AnimationClip } from './sprites';

/**
 * Plays an animation clip. Looping clips run forever; one-shot clips stop on
 * their last frame and emit `done`. Change `playKey` to restart.
 */
const props = withDefaults(defineProps<{ clip: AnimationClip; playKey?: number; size?: number }>(), {
  playKey: 0,
  size: 192,
});
const emit = defineEmits<{ done: [] }>();

const frame = ref(0);
let timer: ReturnType<typeof setInterval> | undefined;

function play() {
  clearInterval(timer);
  frame.value = 0;
  const { fps, loop, frames } = props.clip;
  timer = setInterval(() => {
    if (frame.value < frames - 1) frame.value++;
    else if (loop) frame.value = 0;
    else {
      clearInterval(timer);
      emit('done');
    }
  }, 1000 / fps);
}

// Separate sources, compared one by one: the parent builds a new clip object on every render,
// which must not restart a one-shot animation that already played.
watch([() => props.clip.url, () => props.clip.row, () => props.playKey], play, { immediate: true });
onBeforeUnmount(() => clearInterval(timer));

const style = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  backgroundImage: `url(${props.clip.url})`,
  backgroundSize: `${(props.clip.columns ?? props.clip.frames) * props.size}px ${props.clip.rows * props.size}px`,
  backgroundPosition: `-${frame.value * props.size}px -${props.clip.row * props.size}px`,
}));
</script>

<template>
  <div class="animated-sprite" :style="style" role="img" />
</template>

<style scoped>
.animated-sprite { image-rendering: pixelated; background-repeat: no-repeat; flex-shrink: 0; }
</style>
