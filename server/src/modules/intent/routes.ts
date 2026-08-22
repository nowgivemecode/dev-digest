import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { PrIntentResult } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { getIntent } from './service.js';

/**
 * Intent module routes.
 *
 *   GET /pulls/:id/intent → PrIntentResult | null
 *
 * Returns null (not 404) when no intent has been classified yet for the PR.
 */
export default async function intentRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;

  app.get(
    '/pulls/:id/intent',
    { schema: { params: IdParams } },
    async (req): Promise<PrIntentResult | null> => {
      const { workspaceId } = await getContext(container, req);
      return getIntent(container, workspaceId, req.params.id);
    },
  );
}
