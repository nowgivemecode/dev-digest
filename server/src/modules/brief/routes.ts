/**
 * routes.ts — Brief module Fastify plugin.
 *
 * POST /pulls/:id/brief          — lazy compute-if-absent (cache hits are free, NF-04)
 * POST /pulls/:id/brief/recompute — always re-computes (rate limited: 10/min)
 *
 * Onion layer: presentation — thin handlers: getContext → one service call → reply.
 * No business logic here.
 */
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { PrBriefRecordSchema } from '../../vendor/shared/contracts/pr-brief.js';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { BriefService } from './service.js';

export default async function briefRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();

  // ---- POST: lazy compute + return stored brief --------------------------------
  // No rate limit — cache hits cost no LLM calls (NF-04).
  app.post(
    '/pulls/:id/brief',
    {
      schema: {
        params: IdParams,
        response: { 200: PrBriefRecordSchema },
      },
    },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const service = new BriefService(app.container, req.log);
      return service.getOrCompute(workspaceId, req.params.id);
    },
  );

  // ---- POST: force recompute ---------------------------------------------------
  // Rate-limited — each call fans out to an LLM.
  app.post(
    '/pulls/:id/brief/recompute',
    {
      schema: {
        params: IdParams,
        response: { 200: PrBriefRecordSchema },
      },
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
          // AC-13: scope the rate limit by workspaceId, not by IP, so each
          // workspace gets its own 10/min bucket regardless of shared egress IPs.
          keyGenerator: async (req) => {
            const ctx = await getContext(app.container, req).catch(() => null);
            return ctx?.workspaceId ?? req.ip ?? 'unknown';
          },
        },
      },
    },
    async (req, reply) => {
      const { workspaceId } = await getContext(app.container, req);
      const service = new BriefService(app.container, req.log);
      const record = await service.recompute(workspaceId, req.params.id);
      reply.status(200);
      return record;
    },
  );
}
