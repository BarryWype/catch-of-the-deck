// Card reward shares by fishing spot: `npm run reward-shares`. The work is in reward-shares.ts.
import { runnerImport } from 'vite';

await runnerImport(new URL('./reward-shares.ts', import.meta.url).pathname, { configFile: false, logLevel: 'error' });
