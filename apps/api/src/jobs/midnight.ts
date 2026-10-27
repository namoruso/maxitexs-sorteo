import cron from 'node-cron';
import { env } from '../config/env.js';
import { reiniciar } from '../modules/sorteo/service.js';

/** Auto-close jornada at local midnight (America/Caracas). */
export function startMidnightJob(): void {
  cron.schedule(
    '0 0 * * *',
    async () => {
      try {
        const r = await reiniciar();
        console.log(`[job] midnight jornada reset → ${r.jornada_id}`);
      } catch (e) {
        console.error('[job] midnight reset failed', e);
      }
    },
    { timezone: env.TZ },
  );
  console.log(`[job] midnight reset scheduled (TZ=${env.TZ})`);
}
