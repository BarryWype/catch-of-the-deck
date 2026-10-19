<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { GameData } from '../engine';
import { t } from './i18n';
import {
  collectTransferPart,
  exportTransferCode,
  importTransferCode,
  splitTransferCode,
  TransferError,
  type TransferContents,
} from './saveStore';

/**
 * Moves the save and profile between devices (see ARCHITECTURE.md → Persistence → Transfer):
 * Send shows the transfer code as QR codes (its parts in turn) and as text; Receive scans them
 * with the camera or takes a pasted code, then asks before replacing this device's progress.
 */
/** `apply` replaces this device's progress, false when it refused. */
const props = defineProps<{ data: GameData; apply: (contents: TransferContents) => boolean }>();
const emit = defineEmits<{ close: [] }>();

const tab = ref<'send' | 'receive'>('send');

// Send: the code, and its parts cycling on the canvas.
const code = ref('');
const parts = ref<string[]>([]);
const shown = ref(0);
const canvas = ref<HTMLCanvasElement>();
const codeBox = ref<HTMLTextAreaElement>();
const copied = ref(false);
let cycle: ReturnType<typeof setInterval> | undefined;
let qrcode: typeof import('qrcode-generator') | undefined;

/** One pixel per module, with the 4-module quiet zone; CSS scales it up without smoothing. */
function drawPart() {
  const el = canvas.value;
  const part = parts.value[shown.value];
  if (!el || !qrcode || !part) return;
  const qr = qrcode(0, 'L');
  qr.addData(part, 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  el.width = el.height = n + 8;
  const ctx = el.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, n + 8, n + 8);
  ctx.fillStyle = '#000';
  for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) if (qr.isDark(row, col)) ctx.fillRect(col + 4, row + 4, 1, 1);
}

onMounted(async () => {
  const [lib, exported] = await Promise.all([import('qrcode-generator'), exportTransferCode()]);
  qrcode = lib.default;
  code.value = exported;
  parts.value = splitTransferCode(exported);
  drawPart();
  if (parts.value.length > 1) {
    cycle = setInterval(() => {
      shown.value = (shown.value + 1) % parts.value.length;
      drawPart();
    }, 400);
  }
});
// The canvas is gone while on Receive: draw again when Send comes back.
watch(tab, (now) => now === 'send' && requestAnimationFrame(drawPart));

async function copy() {
  try {
    await navigator.clipboard.writeText(code.value);
  } catch {
    codeBox.value?.select();
    document.execCommand('copy');
  }
  copied.value = true;
  setTimeout(() => (copied.value = false), 2000);
}

/** The system share sheet (AirDrop, Messages, Mail…), on devices that have one: how a phone sends its code to a computer without a camera. */
const canShare = typeof navigator.share === 'function';
async function share() {
  try {
    await navigator.share({ title: t('transfer.title'), text: code.value });
  } catch (e) {
    // Closing the sheet isn't a failure; anything else falls back to copying.
    if ((e as Error).name !== 'AbortError') copy();
  }
}

// Receive: the camera, the pasted code, and what they brought.
const video = ref<HTMLVideoElement>();
const scanning = ref(false);
const scanned = ref<string[]>([]);
const scanTotal = ref(0);
const pasted = ref('');
const error = ref('');
const incoming = ref<TransferContents | null>(null);
const done = ref(false);
let stream: MediaStream | null = null;
let scanTimer: ReturnType<typeof setTimeout> | undefined;

/** BarcodeDetector isn't in TypeScript's DOM types yet. */
declare const BarcodeDetector: {
  new (options: { formats: string[] }): { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> };
  getSupportedFormats(): Promise<string[]>;
};

/** Reads a QR from the video: the browser's BarcodeDetector where it reads QRs, jsQR otherwise. */
async function qrReader(): Promise<(video: HTMLVideoElement) => Promise<string | null>> {
  if (typeof BarcodeDetector !== 'undefined' && (await BarcodeDetector.getSupportedFormats()).includes('qr_code')) {
    const detector = new BarcodeDetector({ formats: ['qr_code'] });
    return async (v) => (await detector.detect(v))[0]?.rawValue ?? null;
  }
  const jsQR = (await import('jsqr')).default;
  const frame = document.createElement('canvas');
  const ctx = frame.getContext('2d', { willReadFrequently: true })!;
  return async (v) => {
    // At most 800px wide: jsQR's time grows with the area.
    const scale = Math.min(1, 800 / v.videoWidth);
    frame.width = Math.round(v.videoWidth * scale);
    frame.height = Math.round(v.videoHeight * scale);
    ctx.drawImage(v, 0, 0, frame.width, frame.height);
    const image = ctx.getImageData(0, 0, frame.width, frame.height);
    return jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })?.data ?? null;
  };
}

async function startScan() {
  error.value = '';
  scanned.value = [];
  scanTotal.value = 0;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  } catch (e) {
    error.value = t((e as Error).name === 'NotAllowedError' ? 'transfer.error.cameraDenied' : 'transfer.error.cameraMissing');
    return;
  }
  scanning.value = true;
  const read = await qrReader();
  if (!video.value || !stream) return stopScan();
  video.value.srcObject = stream;
  await video.value.play().catch(() => {});
  const tick = async () => {
    if (!scanning.value || !video.value) return;
    const text = video.value.readyState >= 2 ? await read(video.value).catch(() => null) : null;
    if (text) {
      const result = collectTransferPart(scanned.value, text);
      scanned.value = result.parts;
      scanTotal.value = result.total;
      if (result.code) {
        stopScan();
        return load(result.code);
      }
    }
    scanTimer = setTimeout(tick, 120);
  };
  tick();
}

function stopScan() {
  scanning.value = false;
  clearTimeout(scanTimer);
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  if (video.value) video.value.srcObject = null;
}

async function load(text: string) {
  error.value = '';
  try {
    incoming.value = await importTransferCode(text);
  } catch (e) {
    error.value = t(`transfer.error.${e instanceof TransferError ? e.reason : 'corrupt'}`);
  }
}

/** What the confirmation lists. */
const summary = computed(() => {
  const contents = incoming.value;
  if (!contents) return [];
  const { profile, save } = contents;
  return [
    t('transfer.home', { n: profile.homeAquarium.length }),
    t('transfer.eggs', { n: profile.eggs.length }),
    t('transfer.discovered', { n: Object.keys(profile.creatureBook).length }),
    save ? t('transfer.run', { level: props.data.levels[save.run.level]?.name ?? '', floor: save.run.floor }) : t('transfer.noRun'),
  ];
});

function confirmImport() {
  if (!incoming.value) return;
  if (props.apply(incoming.value)) {
    done.value = true;
    pasted.value = '';
  } else error.value = t('transfer.error.sandbox');
  incoming.value = null;
}

watch(tab, stopScan);
onBeforeUnmount(() => {
  stopScan();
  clearInterval(cycle);
});
</script>

<template>
  <section class="transfer" @keydown.esc="emit('close')">
    <div class="panel">
      <header>
        <button class="ghost" @click="emit('close')">{{ t('common.back') }}</button>
        <h2>{{ t('transfer.title') }}</h2>
      </header>
      <nav class="tabs" role="tablist">
        <button role="tab" :aria-selected="tab === 'send'" :class="{ active: tab === 'send' }" @click="tab = 'send'">{{ t('transfer.send') }}</button>
        <button role="tab" :aria-selected="tab === 'receive'" :class="{ active: tab === 'receive' }" @click="tab = 'receive'">{{ t('transfer.receive') }}</button>
      </nav>

      <div v-if="tab === 'send'" class="side">
        <p class="hint">{{ t('transfer.sendHint') }}</p>
        <canvas ref="canvas" class="qr" :aria-label="t('transfer.title')" />
        <p class="hint part">{{ parts.length > 1 ? t('transfer.part', { n: shown + 1, total: parts.length }) : ' ' }}</p>
        <textarea ref="codeBox" class="code" readonly rows="3" :value="code" @focus="($event.target as HTMLTextAreaElement).select()" />
        <div class="actions">
          <button v-if="canShare" :disabled="!code" @click="share">{{ t('transfer.share') }}</button>
          <button :class="{ ghost: canShare }" :disabled="!code" @click="copy">{{ copied ? t('transfer.copied') : t('transfer.copy') }}</button>
        </div>
      </div>

      <div v-else class="side">
        <p v-if="done" class="done">{{ t('transfer.done') }}</p>
        <template v-if="incoming">
          <h3>{{ t('transfer.confirmTitle') }}</h3>
          <p class="hint">{{ t('transfer.confirmText') }}</p>
          <ul class="summary">
            <li v-for="line in summary" :key="line">{{ line }}</li>
          </ul>
          <footer>
            <button class="ghost" @click="incoming = null">{{ t('common.cancel') }}</button>
            <button class="danger" @click="confirmImport">{{ t('transfer.confirm') }}</button>
          </footer>
        </template>
        <template v-else>
          <video v-show="scanning" ref="video" class="camera" muted playsinline />
          <p v-if="scanning" class="hint">{{ scanTotal > 1 ? t('transfer.progress', { n: scanned.filter(Boolean).length, total: scanTotal }) : t('transfer.scanning') }}</p>
          <button v-if="!scanning" @click="startScan">{{ t('transfer.scan') }}</button>
          <button v-else class="ghost" @click="stopScan">{{ t('transfer.stopScan') }}</button>
          <p v-if="error" class="error" role="alert">{{ error }}</p>
          <label class="paste">
            <span>{{ t('transfer.pasteLabel') }}</span>
            <textarea v-model="pasted" class="code" rows="3" spellcheck="false" autocomplete="off" />
          </label>
          <button :disabled="!pasted.trim()" @click="load(pasted)">{{ t('transfer.load') }}</button>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.transfer { position: absolute; inset: 0; z-index: 30; display: grid; place-items: start center; padding: 24px 16px; overflow-y: auto; background: rgb(12 19 32 / 0.92); }
.panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: min(100%, 440px);
  padding: 20px 24px;
  border-radius: 16px;
  background: var(--panel);
  border: 1px solid #2c3a4a;
}
header { display: flex; align-items: center; gap: 12px; }
header h2 { margin: 0; font-size: 1.4rem; }
.tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.tabs button { background: rgb(15 18 25 / 0.6); color: var(--muted); }
.tabs button.active { background: var(--highlight); color: #1a1a1a; }
.side { display: flex; flex-direction: column; align-items: stretch; gap: 10px; }
.side h3 { margin: 0; }
.hint { margin: 0; color: var(--muted); font-size: 0.9rem; text-align: center; }
.part { font-variant-numeric: tabular-nums; }
/* Crisp modules: the canvas is one pixel per module, scaled up without smoothing. */
.qr { align-self: center; width: min(100%, 340px, 80dvh); aspect-ratio: 1; image-rendering: pixelated; background: #fff; border-radius: 6px; }
.camera { width: 100%; max-height: 50dvh; border-radius: 8px; background: #000; object-fit: cover; }
.code { width: 100%; box-sizing: border-box; padding: 8px; border-radius: 8px; border: 1px solid #2c3a4a; background: #111826; color: var(--text); font: 0.75rem/1.3 ui-monospace, monospace; resize: vertical; word-break: break-all; }
.paste { display: flex; flex-direction: column; gap: 6px; font-size: 0.9rem; }
.summary { margin: 0; padding-left: 20px; line-height: 1.6; }
.actions { display: flex; gap: 8px; }
.actions button { flex: 1; }
footer { display: flex; justify-content: flex-end; gap: 8px; }
.error { margin: 0; color: #ff8a80; font-size: 0.9rem; }
.done { margin: 0; color: var(--highlight); text-align: center; }

@media (max-width: 700px), (max-height: 500px) {
  .transfer { padding: 12px; }
  .panel { padding: 14px 16px; gap: 10px; }
}
</style>
