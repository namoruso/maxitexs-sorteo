import type { RealtimeEvent } from '@maxitexs/shared';
import { SSE_CHANNEL } from '@maxitexs/shared';
import { pool } from '../db/client.js';

type Listener = (event: RealtimeEvent, id: number) => void;

const listeners = new Set<Listener>();
let seq = 0;
let listening = false;

export async function startRealtimeBus(): Promise<void> {
  if (listening) return;
  const client = await pool.connect();
  await client.query(`LISTEN ${SSE_CHANNEL}`);
  listening = true;

  client.on('notification', (msg) => {
    if (msg.channel !== SSE_CHANNEL || !msg.payload) return;
    try {
      const event = JSON.parse(msg.payload) as RealtimeEvent;
      seq += 1;
      for (const l of listeners) l(event, seq);
    } catch (e) {
      console.error('[realtime] bad payload', e);
    }
  });

  client.on('error', (e) => {
    console.error('[realtime] listener error', e);
    listening = false;
  });

  console.log(`[realtime] LISTEN ${SSE_CHANNEL}`);
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function publish(event: RealtimeEvent): Promise<void> {
  // Deliver via Postgres NOTIFY so every API instance (including this one) fans out once
  await pool.query(`SELECT pg_notify($1, $2)`, [SSE_CHANNEL, JSON.stringify(event)]);
}

export function currentSeq(): number {
  return seq;
}
