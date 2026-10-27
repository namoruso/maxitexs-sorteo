import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { env } from '../config/env.js';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../drizzle');

async function main() {
  const client = new pg.Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "_migrations" (
        id text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const id = file.replace(/\.sql$/, '');
      const exists = await client.query('SELECT 1 FROM _migrations WHERE id = $1', [id]);
      if (exists.rowCount) {
        console.log(`[migrate] skip ${id}`);
        continue;
      }
      const sql = readFileSync(path.join(dir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (id) VALUES ($1)', [id]);
        await client.query('COMMIT');
        console.log(`[migrate] applied ${id}`);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }

    // Ensure active jornada exists
    const j = await client.query(
      `SELECT id FROM jornadas WHERE cerrada_at IS NULL ORDER BY id DESC LIMIT 1`,
    );
    if (!j.rowCount) {
      await client.query(
        `INSERT INTO jornadas (nombre) VALUES ($1)`,
        [env.EVENT_NAME],
      );
      console.log('[migrate] created initial jornada');
    }

    await client.query(
      `INSERT INTO totem_estado (id, estado) VALUES (1, 'captacion') ON CONFLICT (id) DO NOTHING`,
    );
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('[migrate] failed', e);
  process.exit(1);
});
