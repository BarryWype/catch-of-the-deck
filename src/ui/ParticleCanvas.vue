<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

/**
 * Party streamers bursting out of the centre once (an egg hatching), drawn on one <canvas> that
 * fills its parent. The canvas size is only read when it's resized (ResizeObserver), never while
 * drawing. Drawing pauses while the canvas is off screen or the tab is hidden, and doesn't run at
 * all with reduced motion. (The aquarium's bubbles are PixelBubbles: CSS only, never redrawn.)
 */

const canvas = ref<HTMLCanvasElement>();
let ctx: CanvasRenderingContext2D | null = null;
/** The canvas size in CSS pixels. */
let width = 0;
let height = 0;
let frame = 0;
let last = 0;
let elapsed = 0;
let visible = true;

/** Streamers shoot out from the edge of the creature past the halo, stretching, then fade. */
const STREAMER_COLOURS = ['#f5d76e', '#ef7f7f', '#6fd0dc', '#b48cff', '#7fd18f'];
const STREAMER_DURATION = 1.4;
const streamers = Array.from({ length: 20 }, (_, i) => ({
  angle: ((i * 18 + (i % 3) * 5) * Math.PI) / 180,
  length: 40 + ((i * 37) % 50),
  colour: STREAMER_COLOURS[i % STREAMER_COLOURS.length],
}));

function drawStreamers(): boolean {
  if (!ctx) return false;
  const t = Math.min(1, elapsed / STREAMER_DURATION);
  const eased = 1 - (1 - t) ** 3;
  const distance = 80 + 150 * eased;
  ctx.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
  ctx.lineCap = 'round';
  ctx.lineWidth = 5;
  for (const s of streamers) {
    const length = s.length * (0.2 + 0.8 * eased);
    const dx = Math.sin(s.angle);
    const dy = -Math.cos(s.angle);
    ctx.strokeStyle = s.colour;
    ctx.beginPath();
    ctx.moveTo(width / 2 + dx * distance, height / 2 + dy * distance);
    ctx.lineTo(width / 2 + dx * (distance + length), height / 2 + dy * (distance + length));
    ctx.stroke();
  }
  return t < 1;
}

function tick(now: number) {
  frame = 0;
  if (!ctx || !visible) return;
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
  last = now;
  elapsed += dt;
  ctx.clearRect(0, 0, width, height);
  if (drawStreamers()) frame = requestAnimationFrame(tick);
}

function start() {
  if (!frame && visible && ctx) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
}
function stop() {
  cancelAnimationFrame(frame);
  frame = 0;
}

const resize = new ResizeObserver(([entry]) => {
  const el = canvas.value;
  if (!el || !ctx) return;
  width = entry.contentRect.width;
  height = entry.contentRect.height;
  const dpr = window.devicePixelRatio || 1;
  el.width = Math.round(width * dpr);
  el.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  start();
});
const onScreen = new IntersectionObserver(([entry]) => {
  visible = entry.isIntersecting && document.visibilityState === 'visible';
  if (visible) start();
  else stop();
});
const onVisibility = () => {
  visible = document.visibilityState === 'visible';
  if (visible) start();
  else stop();
};

onMounted(() => {
  if (!canvas.value || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  ctx = canvas.value.getContext('2d');
  resize.observe(canvas.value);
  onScreen.observe(canvas.value);
  document.addEventListener('visibilitychange', onVisibility);
});
onBeforeUnmount(() => {
  stop();
  resize.disconnect();
  onScreen.disconnect();
  document.removeEventListener('visibilitychange', onVisibility);
});
</script>

<template>
  <canvas ref="canvas" class="particles" aria-hidden="true" />
</template>

<style scoped>
.particles { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
</style>
