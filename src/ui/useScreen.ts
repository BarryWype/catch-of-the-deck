import { onBeforeUnmount, ref, type Ref } from 'vue';

/** A small screen: a phone, or any window this narrow or this short. Matches `--compact` in style.css. */
export const COMPACT_QUERY = '(max-width: 700px), (max-height: 500px)';
/** A finger rather than a mouse: bigger tap targets. */
export const TOUCH_QUERY = '(pointer: coarse)';

/** Whether a media query matches, kept up to date while the component lives. */
export function useMedia(query: string): Ref<boolean> {
  const list = window.matchMedia(query);
  const matches = ref(list.matches);
  const update = () => (matches.value = list.matches);
  list.addEventListener('change', update);
  onBeforeUnmount(() => list.removeEventListener('change', update));
  return matches;
}
