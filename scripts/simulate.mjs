// Plays many runs with a bot and prints balance stats: `npm run simulate -- --runs 300`.
// The bot and the report are in simulate.ts; Vite runs it straight from the TypeScript sources.
import { runnerImport } from 'vite';

await runnerImport(new URL('./simulate.ts', import.meta.url).pathname, { configFile: false, logLevel: 'error' });
