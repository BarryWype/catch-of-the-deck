<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

/**
 * Particle effects drawn on one <canvas> that fills its parent, instead of one DOM element per
 * particle:
 * - `bubbles`: bubbles rising through the water, forever.
 * - `streamers`: party streamers bursting out of the centre once (an egg hatching).
 * The canvas size is only read when it's resized (ResizeObserver), never while drawing. Drawing
 * pauses while the canvas is off screen or the tab is hidden, and doesn't run at all with
 * reduced motion.
 */
const props = withDefaults(defineProps<{ effect: 'bubbles' | 'streamers'; count?: number }>(), { count: 14 });

const canvas = ref<HTMLCanvasElement>();
let ctx: CanvasRenderingContext2D | null = null;
/** The canvas size in CSS pixels. */
let width = 0;
let height = 0;
let frame = 0;
let last = 0;
let elapsed = 0;
let visible = true;

/** A bubble: position as a share of the canvas, radius and speed in CSS pixels. */
interface Bubble {
  x: number;
  y: number;
  r: number;
  speed: number;
  wobble: number;
}
const BUBBLE_SPEED = [40, 90];
const bubbles: Bubble[] = Array.from({ length: props.count }, () => newBubble(Math.random()));

function newBubble(y = 1): Bubble {
  return {
    x: 0.02 + Math.random() * 0.96,
    y,
    r: 2 + Math.random() * 4,
    speed: BUBBLE_SPEED[0] + Math.random() * (BUBBLE_SPEED[1] - BUBBLE_SPEED[0]),
    wobble: Math.random() * Math.PI * 2,
  };
}

function drawBubbles(dt: number): boolean {
  if (!ctx) return false;
  ctx.lineWidth = 1;
  for (const b of bubbles) {
    b.y -= (b.speed * dt) / Math.max(1, height);
    if (b.y < -0.05) Object.assign(b, newBubble(1.05));
    const x = b.x * width + Math.sin(elapsed * 2 + b.wobble) * 3;
    const y = b.y * height;
    // Fades in at the bottom, and a little toward the surface.
    const alpha = Math.min(1, (1 - b.y) * 8) * (0.6 + 0.4 * b.y);
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.beginPath();
    ctx.arc(x, y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgb(255 255 255 / 0.15)';
    ctx.fill();
    ctx.strokeStyle = 'rgb(255 255 255 / 0.6)';
    ctx.stroke();
  }
  return true;
}

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
  const more = props.effect === 'bubbles' ? drawBubbles(dt) : drawStreamers();
  if (more) frame = requestAnimationFrame(tick);
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
