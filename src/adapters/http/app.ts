import express, { type NextFunction, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import { z, ZodError } from 'zod';
import type { CatalogService } from '../../application/catalog-service.js';

const segment = z.enum(['PRE_PAGO', 'CONTROLE', 'POS_PAGO', 'FIBRA']);
const ddd = z.string().regex(/^\d{2}$/, 'DDD deve ter 2 dígitos');

const searchSchema = z.object({
  ddd: ddd.optional(),
  segment: segment.optional(),
  maxPrice: z.coerce.number().positive().optional(),
  text: z.string().min(2).max(60).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  after: z.string().optional(),
});

const offerSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(3),
  segment,
  monthlyPrice: z.number().positive(),
  dataGb: z.number().min(0),
  ddds: z.array(ddd).default([]),
  benefits: z.array(z.string()).default([]),
  active: z.boolean().default(true),
  validUntil: z.coerce.date().nullable().default(null),
});

/** Only the back-office (role CATALOG_ADMIN) may publish offers; reads are public. */
function requireRole(secret: string, role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = req.header('authorization')?.replace(/^Bearer /, '');
    if (!token) return res.status(401).json({ code: 'UNAUTHENTICATED' });
    try {
      const claims = jwt.verify(token, secret, { algorithms: ['HS256'] }) as { roles?: string[] };
      if (!claims.roles?.includes(role)) return res.status(403).json({ code: 'FORBIDDEN' });
      return next();
    } catch {
      return res.status(401).json({ code: 'INVALID_TOKEN' });
    }
  };
}

export function createApp(catalog: CatalogService, jwtSecret: string) {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ status: 'UP' }));

  app.get('/offers', async (req, res, next) => {
    try {
      res.json(await catalog.search(searchSchema.parse(req.query)));
    } catch (e) {
      next(e);
    }
  });

  app.get('/offers/compare', async (req, res, next) => {
    try {
      const ids = z.string().parse(req.query.ids).split(',').slice(0, 5);
      res.json(await catalog.compare(ids));
    } catch (e) {
      next(e);
    }
  });

  app.get('/regions/:ddd/summary', async (req, res, next) => {
    try {
      res.json(await catalog.summary(ddd.parse(req.params.ddd)));
    } catch (e) {
      next(e);
    }
  });

  app.put('/offers/:id', requireRole(jwtSecret, 'CATALOG_ADMIN'), async (req, res, next) => {
    try {
      const offer = offerSchema.parse({ ...req.body, id: req.params.id });
      await catalog.publish(offer);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      return res.status(400).json({ code: 'VALIDATION', issues: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`) });
    }
    console.error(err);
    return res.status(500).json({ code: 'INTERNAL' });
  });

  return app;
}
