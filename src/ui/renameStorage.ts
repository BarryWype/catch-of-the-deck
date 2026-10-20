/**
 * The game was called Slay the Fish: browser data saved under its old prefix moves to the new one,
 * once, before anything reads it (main.ts imports this first). A value already under the new key
 * wins; the old key is removed, so a save deleted later can't come back.
 */
const OLD_PREFIX = 'slay-the-fish:';
const PREFIX = 'catch-of-the-deck:';

try {
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith(OLD_PREFIX)) continue;
    const renamed = PREFIX + key.slice(OLD_PREFIX.length);
    const value = localStorage.getItem(key);
    if (value !== null && localStorage.getItem(renamed) === null) localStorage.setItem(renamed, value);
    localStorage.removeItem(key);
  }
} catch {
  // Storage blocked: nothing to move.
}
