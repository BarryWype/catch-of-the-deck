import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

// In WSL, files on the Windows drive (/mnt/c/...) don't send change events when
// edited from Windows, so the dev server would keep serving stale modules.
// Polling fixes that.
const wslOnWindowsDrive = !!process.env.WSL_DISTRO_NAME && process.cwd().startsWith('/mnt/');

export default defineConfig({
  // Relative asset paths, so the build also works when Electron opens it from disk.
  base: './',
  // The menu music (src/audio/music) is desktop-only: Vite serves it in `electron:dev` (as
  // /music/…, where the menu plays it from), but the build leaves it out and stays small.
  // `npm run electron:build` copies it into dist/music itself (scripts/copy-music.mjs).
  publicDir: process.env.NODE_ENV === 'development' ? 'src/audio' : false,
  plugins: [vue()],
  server: {
    // Fixed, and away from Vite's default 5173 (often taken by ddev), so `electron:dev` can find it.
    port: 5190,
    strictPort: true,
    watch: wslOnWindowsDrive ? { usePolling: true, interval: 300 } : undefined,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    environment: 'node',
  },
});
