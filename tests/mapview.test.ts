import { describe, expect, it, vi } from 'vitest';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';

// MapView's module tree reads these at import and setup; the test has no DOM.
let touchMatches = false;
vi.stubGlobal('window', {
  innerHeight: 800,
  matchMedia: () => ({ matches: touchMatches, addEventListener: () => {}, removeEventListener: () => {} }),
});
vi.stubGlobal('document', { documentElement: {} });
vi.stubGlobal('navigator', { language: 'en' });
vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} });

/** The map's HTML, rendered as on a pointer that is (not) a finger. */
async function renderMap(touch: boolean) {
  touchMatches = touch;
  const { default: MapView } = await import('../src/ui/MapView.vue');
  const { createRun } = await import('../src/engine');
  const { gameData } = await import('../src/content');
  // `v-tip` is a client directive; the server render only needs it to resolve to nothing.
  const app = createSSRApp({ render: () => h(MapView, { run: createRun(1, gameData, 'rod'), data: gameData }) });
  app.directive('tip', { getSSRProps: () => ({}) });
  return renderToString(app);
}

const count = (html: string, cls: string) => (html.match(new RegExp(`class="${cls}"`, 'g')) ?? []).length;

describe('MapView node markers', () => {
  it('show their letter and symbol on touch screens just as on desktop', async () => {
    const desktop = await renderMap(false);
    const touch = await renderMap(true);
    // The fixture must actually contain lettered nodes, or the test proves nothing.
    expect(count(desktop, 'code')).toBeGreaterThan(0);
    expect(count(desktop, 'symbol')).toBeGreaterThan(0);
    expect(count(touch, 'code')).toBe(count(desktop, 'code'));
    expect(count(touch, 'symbol')).toBe(count(desktop, 'symbol'));
  });
});
