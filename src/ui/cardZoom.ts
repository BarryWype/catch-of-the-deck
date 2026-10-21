import { shallowRef } from 'vue';
import type { CardDef } from '../engine';
import { clearPress, LONG_PRESS_MS, PRESS_MOVE_PX } from './tooltip';

/**
 * Holding a finger on a card shows it full screen, for reading its text (CardZoom.vue, in App.vue),
 * until the next tap. On a card, the hold zooms it instead of opening the tip of what's under the
 * finger; the zoomed card's own tips open with a hold as usual. Touch only: a mouse has hover.
 */
export interface ZoomedCard {
  card: CardDef;
  description?: string;
  cost?: number;
}

/** The card shown full screen, if any. */
export const zoomedCard = shallowRef<ZoomedCard | null>(null);

let press: { x: number; y: number; timer: ReturnType<typeof setTimeout>; shown: boolean } | null = null;
/** The click that ends the hold only opened the zoom: until then, clicks do nothing. */
let quietUntil = 0;

function clear() {
  if (press) clearTimeout(press.timer);
  press = null;
}

let listening = false;
function listen() {
  if (listening) return;
  listening = true;
  window.addEventListener('pointermove', (e) => {
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > PRESS_MOVE_PX) clear();
  });
  window.addEventListener('pointerup', () => {
    if (press?.shown) quietUntil = Date.now() + 400;
    clear();
  });
  window.addEventListener('pointercancel', clear);
  window.addEventListener(
    'click',
    (e) => {
      if (Date.now() >= quietUntil) return;
      quietUntil = 0;
      e.preventDefault();
      e.stopPropagation();
    },
    { capture: true },
  );
}

/** A finger went down on a card: `read` gives what to show if it's still there after a moment. */
export function pressCard(event: PointerEvent, read: () => ZoomedCard) {
  if (event.pointerType === 'mouse' || zoomedCard.value) return;
  listen();
  clearPress();
  clear();
  const pending = { x: event.clientX, y: event.clientY, shown: false, timer: setTimeout(() => {}, 0) };
  pending.timer = setTimeout(() => {
    pending.shown = true;
    zoomedCard.value = read();
  }, LONG_PRESS_MS);
  press = pending;
}
