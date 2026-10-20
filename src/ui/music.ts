/**
 * The game's music, MP3s that stream from dist/music (`npm run build` copies them there, outside the
 * bundle). One track plays at a time: each screen with a theme starts it when it mounts, and the
 * next screen's track (or `stopTheme`) replaces it. The music starts off: while it is off the
 * current theme is only remembered, and turning it on starts it. A browser refuses sound until the
 * player's first click or key, so a track it blocks starts then.
 */
import { ref } from 'vue';

const TRACKS = {
  /** “Gem Waltz” composition and arrangement by Haley Halcyon. */
  menu: 'music/menu.mp3',
  /** Map theme by Alexandr Zhelanov, https://soundcloud.com/alexandr-zhelanov */
  map: 'music/map.mp3',
  fight: 'music/fight.mp3',
  boss: 'music/boss.mp3',
};

let theme: keyof typeof TRACKS | undefined;
let current: HTMLAudioElement | undefined;

/** Whether the music plays, kept per device like the volume; off until the player turns it on. */
const ON_KEY = 'catch-of-the-deck:music-on';
function readOn() {
  try {
    return localStorage.getItem(ON_KEY) === 'true';
  } catch {
    return false;
  }
}
export const musicOn = ref(readOn());

export function setMusicOn(on: boolean) {
  musicOn.value = on;
  try {
    localStorage.setItem(ON_KEY, String(on));
  } catch {
    // Storage blocked: the setting lasts only this visit.
  }
  stopAudio();
  if (on && theme) startAudio(theme);
}

/** The music volume, 0–100, kept per device (like the debug panel) and set from the options. */
const VOLUME_KEY = 'catch-of-the-deck:music-volume';
function readVolume() {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    return Math.max(0, Math.min(100, raw === null ? 50 : Number(raw)));
  } catch {
    return 50;
  }
}
let volume = readVolume();

/**
 * The gain for a volume setting (0–100), for the music and the effects. Ears hear loudness on a log
 * scale, so the setting is squared: 50 plays 12 dB down, 20 plays 28 dB down.
 */
export const gain = (percent: number) => (percent / 100) ** 2;

export function musicVolume() {
  return volume;
}

export function setMusicVolume(percent: number) {
  volume = Math.max(0, Math.min(100, percent));
  if (current) current.volume = gain(volume);
  try {
    localStorage.setItem(VOLUME_KEY, String(volume));
  } catch {
    // Storage blocked: the setting lasts only this visit.
  }
}

export function playTheme(track: keyof typeof TRACKS) {
  theme = track;
  stopAudio();
  if (musicOn.value) startAudio(track);
}

export function stopTheme() {
  theme = undefined;
  stopAudio();
}

function startAudio(track: keyof typeof TRACKS) {
  const audio = new Audio(TRACKS[track]);
  current = audio;
  audio.loop = true;
  audio.volume = gain(volume);
  audio.play().catch(() => {
    const resume = () => {
      if (current === audio) audio.play().catch(() => {});
    };
    document.addEventListener('pointerup', resume, { once: true });
    document.addEventListener('keydown', resume, { once: true });
  });
}

function stopAudio() {
  current?.pause();
  current = undefined;
}
