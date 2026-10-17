/**
 * The game's music, shipped with the desktop app only (the web build leaves the files out of the
 * bundle; `npm run electron:build` copies them into dist/music). One track plays at a time: each
 * screen with a theme starts it when it mounts, and the next screen's track (or `stopTheme`)
 * replaces it. Nothing ever plays in a browser: it has no `window.desktop`, so it never loads.
 */
const TRACKS = {
  /** “Gem Waltz” composition and arrangement by Haley Halcyon. */
  menu: 'music/menu.wav',
  /** Map theme by Alexandr Zhelanov, https://soundcloud.com/alexandr-zhelanov */
  map: 'music/map.ogg',
  fight: 'music/fight.ogg',
  boss: 'music/boss.wav',
};

let current: HTMLAudioElement | undefined;

/** The music volume, 0–100, kept per device (like the debug panel) and set from the options. */
const VOLUME_KEY = 'slay-the-fish:music-volume';
function readVolume() {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    return Math.max(0, Math.min(100, raw === null ? 50 : Number(raw)));
  } catch {
    return 50;
  }
}
let volume = readVolume();

export function musicVolume() {
  return volume;
}

export function setMusicVolume(percent: number) {
  volume = Math.max(0, Math.min(100, percent));
  if (current) current.volume = volume / 100;
  try {
    localStorage.setItem(VOLUME_KEY, String(volume));
  } catch {
    // Storage blocked: the setting lasts only this visit.
  }
}

export function playTheme(track: keyof typeof TRACKS) {
  stopTheme();
  if (!window.desktop) return;
  current = new Audio(TRACKS[track]);
  current.loop = true;
  current.volume = volume / 100;
  current.play().catch(() => {}); // No file, or playback refused: the screen stays quiet.
}

export function stopTheme() {
  current?.pause();
  current = undefined;
}
