import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { loginSchema, registroSchema, verificarSchema } from '@maxitexs/shared';
import {
  clearSessionCookie,
  destroySession,
  isAuthenticated,
  login,
  readSessionToken,
  requireAdmin,
  setSessionCookie,
} from '../modules/auth/service.js';
import * as sorteo from '../modules/sorteo/service.js';
import { AppError } from '../lib/errors.js';
import { subscribe } from '../realtime/bus.js';
import type { RealtimeEvent } from '@maxitexs/shared';

export function publicRoutes(): Router {
  const router = Router();

  const registroLimit = rateLimit({
    windowMs: 60_000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { mensaje: 'Demasiados intentos. Espera un momento.' },
  });

  const verificarLimit = rateLimit({
    windowMs: 60_000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { mensaje: 'Demasiadas consultas. Espera un momento.' },
  });

  router.get('/evento', (_req, res) => {
    res.json(sorteo.getEvento());
  });

  router.post('/registro/verificar', verificarLimit, async (req, res, next) => {
    try {
      const data = verificarSchema.parse(req.body);
      res.json(await sorteo.verificar(data.numero, data.telefono));
    } catch (e) {
      next(e);
    }
  });

  router.post('/registro', registroLimit, async (req, res, next) => {
    try {
      const data = registroSchema.parse(req.body);
      const result = await sorteo.registrar(data);
      res.status(201).json(result);
    } catch (e) {
      next(e);
    }
  });

  router.get('/totem/estado', async (_req, res, next) => {
    try {
      res.json(await sorteo.getTotemEstado());
    } catch (e) {
      next(e);
    }
  });

  router.get('/totem/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const send = (event: RealtimeEvent, id: number) => {
      // Totem only gets public-safe events
      if (
        event.type === 'participante.creado' ||
        event.type === 'totem.contador' ||
        event.type === 'totem.estado' ||
        event.type === 'sorteo.lanzado' ||
        event.type === 'sorteo.revelado' ||
        event.type === 'jornada.reiniciada'
      ) {
        res.write(`id: ${id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      }
    };

    const unsub = subscribe(send);
    const ping = setInterval(() => {
      res.write(`: ping\n\n`);
    }, 20_000);

    req.on('close', () => {
      clearInterval(ping);
      unsub();
    });
  });

  return router;
}

export function adminRoutes(): Router {
  const router = Router();

  const loginLimit = rateLimit({
    windowMs: 15 * 60_000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { mensaje: 'Demasiados intentos de acceso.' },
  });

  router.post('/login', loginLimit, async (req, res, next) => {
    try {
      const body = loginSchema.parse(req.body);
      const token = await login(body.usuario, body.password);
      if (!token) throw new AppError('UNAUTHORIZED', 'Usuario o contraseña incorrectos', 401);
      setSessionCookie(res, token);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  router.post('/logout', async (req, res) => {
    await destroySession(readSessionToken(req));
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  router.get('/me', async (req, res) => {
    res.json({ autenticado: await isAuthenticated(readSessionToken(req)) });
  });

  router.use(requireAdmin);

  router.get('/estado', async (_req, res, next) => {
    try {
      res.json(await sorteo.getAdminEstado());
    } catch (e) {
      next(e);
    }
  });

  router.get('/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const send = (event: RealtimeEvent, id: number) => {
      res.write(`id: ${id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    };
    const unsub = subscribe(send);
    const ping = setInterval(() => res.write(`: ping\n\n`), 20_000);
    req.on('close', () => {
      clearInterval(ping);
      unsub();
    });
  });

  router.post('/sorteo', async (_req, res, next) => {
    try {
      res.json(await sorteo.lanzarSorteo());
    } catch (e) {
      next(e);
    }
  });

  router.post('/sorteo/:id/entrega', async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1) {
        throw new AppError('VALIDATION', 'ID de sorteo inválido', 422);
      }
      res.json(await sorteo.confirmarEntrega(id));
    } catch (e) {
      next(e);
    }
  });

  router.post('/sorteo/:id/ausente', async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1) {
        throw new AppError('VALIDATION', 'ID de sorteo inválido', 422);
      }
      res.json(await sorteo.marcarAusenteYRelanzar(id));
    } catch (e) {
      next(e);
    }
  });

  router.post('/totem/captacion', async (_req, res, next) => {
    try {
      res.json(await sorteo.volverACaptacion());
    } catch (e) {
      next(e);
    }
  });

  router.post('/reiniciar', async (_req, res, next) => {
    try {
      res.json(await sorteo.reiniciar());
    } catch (e) {
      next(e);
    }
  });

  router.get('/exportar.csv', async (_req, res, next) => {
    try {
      const csv = await sorteo.exportCsv();
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="participantes-maxitexs-${new Date().toISOString().slice(0, 10)}.csv"`,
      );
      res.send(`\uFEFF${csv}`);
    } catch (e) {
      next(e);
    }
  });

  return router;
}
