import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
loadDotenv({ path: path.join(root, '.env') });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgresql://maxitexs:maxitexs@localhost:5432/maxitexs_sorteo'),
  PUBLIC_URL: z.string().optional(),
  RAILWAY_PUBLIC_DOMAIN: z.string().optional(),
  EVENT_NAME: z.string().default("Jornada Maxitex’s 2026"),
  EVENT_DATE: z.string().optional(),
  PREMIO: z.string().default('Premio'),
  ADMIN_USER: z.string().default('admin'),
  ADMIN_PASSWORD: z.string().min(6).default('maxitexs2026'),
  SESSION_SECRET: z.string().min(16).optional(),
  SESSION_TTL_MS: z.coerce.number().int().positive().default(12 * 60 * 60 * 1000),
  SORTEO_ANIM_MS: z.coerce.number().int().positive().default(8000),
  TOTEM_ONLINE_MS: z.coerce.number().int().positive().default(10_000),
  TZ: z.string().default('America/Caracas'),
  WEB_DIST: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('[config] Invalid environment:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const e = parsed.data;
const isProd = e.NODE_ENV === 'production';
const onRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);

function publicUrl(): string {
  if (e.PUBLIC_URL) return e.PUBLIC_URL.replace(/\/$/, '');
  if (e.RAILWAY_PUBLIC_DOMAIN) return `https://${e.RAILWAY_PUBLIC_DOMAIN.replace(/\/$/, '')}`;
  return 'http://localhost:5173';
}

function sessionSecret(): string {
  if (e.SESSION_SECRET && e.SESSION_SECRET.length >= 16) return e.SESSION_SECRET;
  if (isProd || onRailway) {
    console.warn(
      '[config] SESSION_SECRET missing — generating ephemeral secret. Set it in Railway Variables.',
    );
  }
  return `dev-${cryptoRandom()}`;
}

function cryptoRandom(): string {
  return randomBytes(32).toString('hex');
}

export const env = {
  ...e,
  isProd,
  onRailway,
  publicUrl: publicUrl(),
  sessionSecret: sessionSecret(),
  eventDate:
    e.EVENT_DATE ??
    new Date().toLocaleDateString('es-VE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: e.TZ,
    }),
  webDist:
    e.WEB_DIST ??
    path.resolve(root, 'apps/web/dist'),
  root,
};

if ((isProd || onRailway) && e.ADMIN_PASSWORD === 'maxitexs2026') {
  console.warn('[config] ADMIN_PASSWORD is still the default — change it before the event.');
}

// Ensure process TZ matches Venezuela for cron / Date formatting
process.env.TZ = e.TZ;
