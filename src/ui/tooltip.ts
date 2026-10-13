import { shallowRef, type Directive } from 'vue';

/**
 * Hover text for any element: `v-tip="'Coins'"` or `v-tip="{ title, detail, body, hint }"`.
 * Shown instantly on hover or keyboard focus by the single <TooltipLayer> (in App.vue), in the
 * map-node style, instead of the browser's slow native `title` tooltip.
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

const onEnter = (e: Event) => show(e.currentTarget as Element);
const onLeave = (e: Event) => hide(e.currentTarget as Element);

export const vTip: Directive<Element, TipValue> = {
  mounted(el, { value }) {
    contents.set(el, value);
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    el.addEventListener('focusin', onEnter);
    el.addEventListener('focusout', onLeave);
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
  },
};

declare module 'vue' {
  interface GlobalDirectives {
    vTip: typeof vTip;
  }
}
