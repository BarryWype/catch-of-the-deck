/**
 * Sound effects are not implemented yet: this is only their volume setting (0–100, kept per
 * device like the music's), so the options slider has a home and the effects can pick it up
 * when they arrive.
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
