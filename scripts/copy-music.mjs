// The menu music ships with the desktop app only, so it never goes through the Vite build and
// the web bundle stays small. `npm run electron:build` copies it into dist/music, next to the
// page, where the menu plays it from a relative URL (Vite serves it in `electron:dev` instead).
import { cpSync, mkdirSync, readdirSync } from 'node:fs';

const from = new URL('../src/audio/music/', import.meta.url);
const to = new URL('../dist/music/', import.meta.url);
mkdirSync(to, { recursive: true });
for (const file of readdirSync(from)) cpSync(new URL(file, from), new URL(file, to));
console.log(`Copied ${readdirSync(to).length} music file(s) into dist/music.`);
