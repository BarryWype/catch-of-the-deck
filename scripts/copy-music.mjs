// The music never goes through the Vite build: `npm run build` copies the MP3s into dist/music,
// next to the page, where music.ts streams them from a relative URL (Vite serves them in dev).
// The WAV/Ogg masters beside them stay out.
import { cpSync, mkdirSync, readdirSync } from 'node:fs';

const from = new URL('../src/audio/music/', import.meta.url);
const to = new URL('../dist/music/', import.meta.url);
mkdirSync(to, { recursive: true });
for (const file of readdirSync(from).filter((f) => f.endsWith('.mp3'))) cpSync(new URL(file, from), new URL(file, to));
console.log(`Copied ${readdirSync(to).length} music file(s) into dist/music.`);
