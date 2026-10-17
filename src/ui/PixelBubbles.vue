<script setup lang="ts">
/**
 * Bubbles rising through the water: pixel-art sprites moved only by CSS animations (transform and
 * opacity), so nothing is drawn again while they rise, whatever the size of the tank. Each bubble
 * rides up on a wrapper only as big as itself: the animated element's compositor layer is the
 * element's own size, so the layers stay bubble-sized (a full-height one, as an earlier version
 * had, made a full-screen menu blend a full tank's worth of pixels per bubble, every frame).
 * The rise distance comes in cqh units, from the tank (a size container, see Aquarium.vue).
 */
const props = withDefaults(defineProps<{ count?: number }>(), { count: 14 });

/** Spread across the tank, each its own size, speed and start: fixed per slot, so a re-render changes nothing. */
const bubbles = Array.from({ length: props.count }, (_, i) => {
  const duration = 7 + ((i * 53) % 9);
  return {
    left: `${2 + ((i * 37) % 95)}%`,
    duration: `${duration}s`,
    delay: `-${((i * 29) % 100) / 10}s`,
    pixel: `${2 + (i % 3)}px`,
    wobble: `${1.4 + (i % 4) * 0.3}s`,
  };
});
</script>

<template>
  <div class="bubbles" aria-hidden="true">
    <span
      v-for="(b, i) in bubbles"
      :key="i"
      class="riser"
      :style="{ left: b.left, '--duration': b.duration, '--delay': b.delay, '--pixel': b.pixel, '--wobble': b.wobble }"
    >
      <span class="bubble" />
    </span>
  </div>
</template>

<style scoped>
.bubbles { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
/* Only as big as its bubble: the layer the compositor moves is bubble-sized, not tank-sized. */
.riser {
  position: absolute;
  bottom: 0;
  width: calc(6 * var(--pixel));
  height: calc(6 * var(--pixel));
  animation: rise var(--duration) linear var(--delay) infinite;
}
/* A 6×6 pixel bubble (a ring, a faint fill and a glint), scaled up crisp. */
.bubble {
  position: absolute;
  inset: 0;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 6 6' shape-rendering='crispEdges'%3E%3Crect x='1' y='1' width='4' height='4' fill='%23fff' fill-opacity='.15'/%3E%3Cpath d='M1 0h4v1H1zM0 1h1v4H0zM5 1h1v4H5zM1 5h4v1H1z' fill='%23fff' fill-opacity='.65'/%3E%3Crect x='2' y='2' width='1' height='1' fill='%23fff'/%3E%3C/svg%3E")
    center / 100% 100% no-repeat;
  image-rendering: pixelated;
  animation: wobble var(--wobble) ease-in-out infinite alternate;
}
@keyframes rise {
  0% { transform: translateY(4cqh); opacity: 0; }
  12% { opacity: 0.9; }
  80% { opacity: 0.8; }
  100% { transform: translateY(-100cqh); opacity: 0; }
}
@keyframes wobble {
  from { transform: translateX(-3px); }
  to { transform: translateX(3px); }
}
@media (prefers-reduced-motion: reduce) {
  .bubbles { display: none; }
}
</style>
