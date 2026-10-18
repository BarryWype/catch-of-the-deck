/**
 * The game's sound effects, streamed like the music: Vite serves them in dev (as /sfx/…), and
 * `npm run build` copies them into dist/sfx (scripts/copy-audio.mjs). The volume (0–100) is kept
 * per device like the music's, and set from the options.
 */
const VOLUME_KEY = 'slay-the-fish:sfx-volume';
function readVolume() {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    return Math.max(0, Math.min(100, raw === null ? 100 : Number(raw)));
  } catch {
    return 100;
  }
}
let volume = readVolume();

export function sfxVolume() {
  return volume;
}

export function setSfxVolume(percent: number) {
  volume = Math.max(0, Math.min(100, percent));
  try {
    localStorage.setItem(VOLUME_KEY, String(volume));
  } catch {
    // Storage blocked: the setting lasts only this visit.
  }
}

/** Plays an effect (a file in src/audio/sfx) once, at the set volume. */
export function playSfx(file: string) {
  const audio = new Audio(`sfx/${file}`);
  audio.volume = volume / 100;
  // Before the player's first click or key a browser blocks the sound: that one is lost.
  audio.play().catch(() => {});
}
