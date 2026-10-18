// The audio never goes through the Vite build: `npm run build` copies the music into dist/music
// and the sound effects into dist/sfx, next to the page, where music.ts and sfx.ts stream them
// from relative URLs (Vite serves them in dev). The WAV/Ogg masters beside them stay out.
import { cpSync, mkdirSync, readdirSync } from 'node:fs';

const musicFrom = new URL('../src/audio/music/', import.meta.url);
const musicTo = new URL('../dist/music/', import.meta.url);
mkdirSync(musicTo, { recursive: true });
for (const file of readdirSync(musicFrom).filter((f) => f.endsWith('.mp3'))) cpSync(new URL(file, musicFrom), new URL(file, musicTo));

const sfxFrom = new URL('../src/audio/sfx/', import.meta.url);
const sfxTo = new URL('../dist/sfx/', import.meta.url);
mkdirSync(sfxTo, { recursive: true });
for (const file of readdirSync(sfxFrom).filter((f) => f.endsWith('.wav'))) cpSync(new URL(file, sfxFrom), new URL(file, sfxTo));

console.log(`Copied ${readdirSync(musicTo).length} music and ${readdirSync(sfxTo).length} sfx file(s) into dist.`);
