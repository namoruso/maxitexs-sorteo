import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, gt, eq } from 'drizzle-orm';
import type { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env.js';
import { db } from '../../db/client.js';
import { adminSesiones } from '../../db/schema.js';
import { AppError } from '../../lib/errors.js';

const COOKIE = 'mx_admin';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) {
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

export async function login(username: string, password: string): Promise<string | null> {
  const userOk = safeEqual(username, env.ADMIN_USER);
  const passOk = safeEqual(password, env.ADMIN_PASSWORD);
  if (!userOk || !passOk) return null;

  const token = randomBytes(32).toString('hex');
  const expira = new Date(Date.now() + env.SESSION_TTL_MS);
  await db.insert(adminSesiones).values({
    tokenHash: hashToken(token),
    expiraAt: expira,
  });
  return token;
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  await db.delete(adminSesiones).where(eq(adminSesiones.tokenHash, hashToken(token)));
}

export async function isAuthenticated(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const row = await db.query.adminSesiones.findFirst({
    where: and(
      eq(adminSesiones.tokenHash, hashToken(token)),
      gt(adminSesiones.expiraAt, new Date()),
    ),
  });
  return Boolean(row);
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    maxAge: env.SESSION_TTL_MS,
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE, { path: '/' });
}

export function readSessionToken(req: Request): string | undefined {
  return req.cookies?.[COOKIE] as string | undefined;
}

export async function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ok = await isAuthenticated(readSessionToken(req));
    if (!ok) throw new AppError('UNAUTHORIZED', 'No autenticado', 401);
    next();
  } catch (e) {
    next(e);
  }
}
