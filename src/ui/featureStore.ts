import { FEATURES, type Features } from '../engine';

/**
 * The fight-variety features this device plays with (the debug panel's Features), in
 * localStorage: `FEATURES`, with the panel's changes on top. No Vue here: `i18n.ts` reads it while
 * building the game data at startup.
 */
const FEATURES_KEY = 'catch-of-the-deck:features';

export function readFeatures(): Features {
  try {
    const saved = JSON.parse(localStorage.getItem(FEATURES_KEY) ?? '{}');
    return Object.fromEntries(Object.entries(FEATURES).map(([id, on]) => [id, typeof saved?.[id] === 'boolean' ? saved[id] : on])) as unknown as Features;
  } catch {
    return { ...FEATURES };
  }
}

/** Turn features on or off. The game data is built once at startup, so the page reloads. */
export function writeFeatures(features: Features) {
  try {
    localStorage.setItem(FEATURES_KEY, JSON.stringify(features));
  } catch {
    // Storage blocked: nothing to remember.
  }
  location.reload();
}
