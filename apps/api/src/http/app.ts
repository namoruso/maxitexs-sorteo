import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { env } from '../config/env.js';
import { adminRoutes, publicRoutes } from './routes.js';
import { errorHandler } from './errorHandler.js';

export function createApp(): express.Application {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Dev: Vite on :5173; Prod: same origin
  app.use(
    cors({
      origin: env.isProd ? false : ['http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '64kb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, premio: env.PREMIO, publicUrl: env.publicUrl });
  });

  app.use('/api', publicRoutes());
  app.use('/api/admin', adminRoutes());

  // Serve built SPA only — never the whole monorepo root
  const webDist = env.webDist;
  if (fs.existsSync(webDist)) {
    app.use(
      express.static(webDist, {
        index: false,
        setHeaders(res, filePath) {
          if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-store');
        },
      }),
    );
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      // Never SPA-fallback for source / secret-looking paths
      if (/\.(env|ts|tsx|js\.map|json|md|sql|lock)$/i.test(req.path)) {
        res.status(404).end();
        return;
      }
      res.sendFile(path.join(webDist, 'index.html'), (err) => {
        if (err) next();
      });
    });
  }

  app.use(errorHandler);
  return app;
}
