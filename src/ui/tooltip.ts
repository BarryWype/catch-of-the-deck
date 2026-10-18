import { shallowRef, type Directive } from 'vue';

/**
 * Hover text for any element: `v-tip="'Coins'"` or `v-tip="{ title, detail, body, hint }"`.
 * Shown instantly on hover or keyboard focus (and, on touch, by holding a finger on it or tapping
 * it, see below) by the single <TooltipLayer> (in App.vue), in the map-node style, instead of the
 * browser's slow native `title` tooltip.
 */
export type TipContent =
  | string
  | {
      /** Bold first line. */
      title?: string;
      /** Small muted line under the title. */
      detail?: string;
      /** A longer explanation, wrapped. */
      body?: string;
      /** Small green line, e.g. "Your gear is strong against these". */
      hint?: string;
    };
export type TipValue = TipContent | null | undefined | false;

export interface ActiveTip {
  anchor: Element;
  content: Exclude<TipContent, string>;
}

/** The id of the tooltip element, for `aria-describedby`. */
export const TOOLTIP_ID = 'app-tooltip';

/** The tooltip currently shown, if any. */
export const activeTip = shallowRef<ActiveTip | null>(null);

const contents = new WeakMap<Element, TipValue>();

function normalize(value: TipValue): ActiveTip['content'] | null {
  if (!value) return null;
  if (typeof value === 'string') return { title: value };
  return value.title || value.detail || value.body || value.hint ? value : null;
}

function show(anchor: Element) {
  const content = normalize(contents.get(anchor));
  if (!content) return;
  activeTip.value = { anchor, content };
  anchor.setAttribute('aria-describedby', TOOLTIP_ID);
}

function hide(anchor: Element) {
  if (activeTip.value?.anchor === anchor) activeTip.value = null;
  anchor.removeAttribute('aria-describedby');
}

// --- Touch: no hover on a phone. Holding a finger on anything shows its tip until it lifts (and
// the tap it would have been is cancelled); a quick tap on something you don't tap to act (a
// status, an intent, a keyword) shows its tip until the next tap. The mouse and focus events
// browsers fake after a tap are ignored, so tips don't get stuck open.

const LONG_PRESS_MS = 450;
/** A finger that moves this far is scrolling or dragging, not pressing. */
const PRESS_MOVE_PX = 10;
/** Taps on these do something: a quick tap does that, only holding shows the tip. A creature a
 * card is aimed at (`.targetable`, CombatView) joins them, so tapping it plays the card without
 * opening its tip. */
const ACTS = 'button, a, input, select, [role="button"], .card, .fish, .combatant.targetable';

let lastTouch = 0;
const recentTouch = () => Date.now() - lastTouch < 800;
let press: { anchor: Element; x: number; y: number; at: number; timer: ReturnType<typeof setTimeout>; shown: boolean } | null = null;
/** A tip opened by a quick tap, closed by the next tap anywhere else. */
let tapped: Element | null = null;

function clearPress() {
  if (press) clearTimeout(press.timer);
  press = null;
}

/** The click that ends a long press only showed a tip: it does nothing else. */
function swallowNextClick(anchor: Element) {
  const swallow = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
  };
  anchor.addEventListener('click', swallow, { capture: true, once: true });
  setTimeout(() => anchor.removeEventListener('click', swallow, { capture: true }), 700);
}

function onPointerDown(e: Event) {
  const event = e as PointerEvent;
  if (event.pointerType === 'mouse') return;
  // Nested tips: the innermost one (the first to hear it) wins.
  if (press?.at === event.timeStamp) return;
  clearPress();
  const anchor = event.currentTarget as Element;
  const pending = { anchor, x: event.clientX, y: event.clientY, at: event.timeStamp, shown: false, timer: setTimeout(() => {}, 0) };
  pending.timer = setTimeout(() => {
    pending.shown = true;
    show(anchor);
  }, LONG_PRESS_MS);
  press = pending;
}

let listening = false;
function listenForTouch() {
  if (listening) return;
  listening = true;
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType !== 'mouse') lastTouch = Date.now();
      if (tapped && !tapped.contains(e.target as Node)) {
        hide(tapped);
        tapped = null;
      }
    },
    { capture: true },
  );
  window.addEventListener('pointermove', (e) => {
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > PRESS_MOVE_PX) {
      if (press.shown) hide(press.anchor);
      clearPress();
    }
  });
  window.addEventListener('pointerup', (e) => {
    if (!press || e.pointerType === 'mouse') return;
    const { anchor, shown } = press;
    clearPress();
    if (shown) {
      hide(anchor);
      swallowNextClick(anchor);
    } else if (!anchor.closest(ACTS)) {
      if (activeTip.value?.anchor === anchor) {
        hide(anchor);
        tapped = null;
      } else {
        show(anchor);
        tapped = activeTip.value?.anchor === anchor ? anchor : null;
      }
    }
  });
  window.addEventListener('pointercancel', () => {
    if (press?.shown) hide(press.anchor);
    clearPress();
  });
  // A long press would otherwise open the phone's own menu.
  window.addEventListener('contextmenu', (e) => {
    if (recentTouch()) e.preventDefault();
  });
}

const onEnter = (e: Event) => {
  if (!recentTouch()) show(e.currentTarget as Element);
};
const onLeave = (e: Event) => {
  if (!recentTouch()) hide(e.currentTarget as Element);
};

export const vTip: Directive<Element, TipValue> = {
  mounted(el, { value }) {
    contents.set(el, value);
    listenForTouch();
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    el.addEventListener('focusin', onEnter);
    el.addEventListener('focusout', onLeave);
    el.addEventListener('pointerdown', onPointerDown);
    // No "copy / look up" bubble on iOS when holding a finger down to read a tip.
    (el as HTMLElement).style?.setProperty('-webkit-touch-callout', 'none');
  },
  updated(el, { value, oldValue }) {
    contents.set(el, value);
    // Keep an open tooltip in sync when its text changes (e.g. a counter going up).
    if (activeTip.value?.anchor !== el || JSON.stringify(value) === JSON.stringify(oldValue)) return;
    const content = normalize(value);
    if (content) activeTip.value = { anchor: el, content };
    else hide(el);
  },
  beforeUnmount(el) {
    hide(el);
    el.removeEventListener('mouseenter', onEnter);
    el.removeEventListener('mouseleave', onLeave);
    el.removeEventListener('focusin', onEnter);
    el.removeEventListener('focusout', onLeave);
    el.removeEventListener('pointerdown', onPointerDown);
    if (press?.anchor === el) clearPress();
    if (tapped === el) tapped = null;
  },
};

declare module 'vue' {
  interface GlobalDirectives {
    vTip: typeof vTip;
  }
}
