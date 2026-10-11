import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

// In WSL, files on the Windows drive (/mnt/c/...) don't send change events when
// edited from Windows, so the dev server would keep serving stale modules.
// Polling fixes that.
const wslOnWindowsDrive = !!process.env.WSL_DISTRO_NAME && process.cwd().startsWith('/mnt/');

export default defineConfig({
  // Relative asset paths, so the build also works when Electron opens it from disk.
  base: './',
  plugins: [vue()],
  server: {
    // Fixed, and away from Vite's default 5173 (often taken by ddev), so `electron:dev` can find it.
    port: 5190,
    strictPort: true,
    watch: wslOnWindowsDrive ? { usePolling: true, interval: 300 } : undefined,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
