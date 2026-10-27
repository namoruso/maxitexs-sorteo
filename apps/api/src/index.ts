import { env } from './config/env.js';
import { pool } from './db/client.js';
import { createApp } from './http/app.js';
import { startMidnightJob } from './jobs/midnight.js';
import { startRealtimeBus } from './realtime/bus.js';

async function main() {
  await startRealtimeBus();
  startMidnightJob();

  const app = createApp();
  const server = app.listen(env.PORT, env.HOST, () => {
    console.log(`[maxitexs-sorteo] listening on http://${env.HOST}:${env.PORT}`);
    console.log(`[maxitexs-sorteo] public URL (QR) → ${env.publicUrl}`);
    console.log(`[maxitexs-sorteo] TZ=${env.TZ} · premio="${env.PREMIO}"`);
    console.log(`[maxitexs-sorteo] totem    → ${env.publicUrl}/totem`);
    console.log(`[maxitexs-sorteo] registro → ${env.publicUrl}/registro`);
    console.log(`[maxitexs-sorteo] admin    → ${env.publicUrl}/admin`);
  });

  const shutdown = (signal: string) => {
    console.log(`[maxitexs-sorteo] ${signal}, shutting down…`);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((e) => {
  console.error('[fatal]', e);
  process.exit(1);
});
