import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { EvalCaseInput } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { NotFoundError } from '../../platform/errors.js';
import { EvalsService } from './service.js';

const AgentCaseParams = z.object({
  id: z.string().uuid(),
  caseId: z.string().uuid(),
});

/**
 * Evals module routes.
 *
 *   POST   /agents/:id/eval-cases            body: EvalCaseInput     → EvalCase (201)
 *   GET    /agents/:id/eval-cases            → EvalCase[] (200)
 *   GET    /agents/:id/eval-cases/:caseId    → EvalCase (200)
 *   PUT    /agents/:id/eval-cases/:caseId    body: EvalCaseInput     → EvalCase (200)
 *   DELETE /agents/:id/eval-cases/:caseId    → 204
 *   POST   /agents/:id/eval-runs             body: { version_label? } → EvalRunResult[] (200)
 *   POST   /agents/:id/eval-cases/:caseId/runs → EvalRunResult (200)
 *   GET    /agents/:id/eval-runs             → EvalRunRecord[] (200)
 *   GET    /evals/dashboard                  → EvalDashboard (200)
 */
export default async function evalsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new EvalsService(app.container);

  // POST /agents/:id/eval-cases — create an eval case for an agent
  app.post(
    '/agents/:id/eval-cases',
    { schema: { params: IdParams, body: EvalCaseInput } },
    async (req, reply) => {
      const { workspaceId } = await getContext(app.container, req);
      // Verify agent belongs to workspace
      const agent = await app.container.agentsRepo.getById(workspaceId, req.params.id);
      if (!agent) throw new NotFoundError('Agent not found');

      const evalCase = await service.createCase(req.body, workspaceId);
      reply.status(201);
      return evalCase;
    },
  );

  // GET /agents/:id/eval-cases — list eval cases for an agent
  app.get('/agents/:id/eval-cases', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const agent = await app.container.agentsRepo.getById(workspaceId, req.params.id);
    if (!agent) throw new NotFoundError('Agent not found');

    return service.listCases(req.params.id);
  });

  // GET /agents/:id/eval-cases/:caseId — get a single eval case
  app.get(
    '/agents/:id/eval-cases/:caseId',
    { schema: { params: AgentCaseParams } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const agent = await app.container.agentsRepo.getById(workspaceId, req.params.id);
      if (!agent) throw new NotFoundError('Agent not found');

      const evalCase = await service.getCaseForAgent(req.params.caseId, req.params.id);
      if (!evalCase) throw new NotFoundError('Eval case not found');
      return evalCase;
    },
  );

  // PUT /agents/:id/eval-cases/:caseId — update an eval case
  app.put(
    '/agents/:id/eval-cases/:caseId',
    { schema: { params: AgentCaseParams, body: EvalCaseInput } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const agent = await app.container.agentsRepo.getById(workspaceId, req.params.id);
      if (!agent) throw new NotFoundError('Agent not found');

      const owned = await service.getCaseForAgent(req.params.caseId, req.params.id);
      if (!owned) throw new NotFoundError('Eval case not found');

      return service.updateCase(req.params.caseId, req.body);
    },
  );

  // DELETE /agents/:id/eval-cases/:caseId — delete an eval case
  app.delete(
    '/agents/:id/eval-cases/:caseId',
    { schema: { params: AgentCaseParams } },
    async (req, reply) => {
      const { workspaceId } = await getContext(app.container, req);
      const agent = await app.container.agentsRepo.getById(workspaceId, req.params.id);
      if (!agent) throw new NotFoundError('Agent not found');

      const owned = await service.getCaseForAgent(req.params.caseId, req.params.id);
      if (!owned) throw new NotFoundError('Eval case not found');

      await service.deleteCase(req.params.caseId);
      reply.status(204);
      return null;
    },
  );

  // POST /agents/:id/eval-runs — run all eval cases for an agent
  app.post(
    '/agents/:id/eval-runs',
    {
      schema: {
        params: IdParams,
        body: z.object({ version_label: z.string().optional() }),
      },
    },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const agent = await app.container.agentsRepo.getById(workspaceId, req.params.id);
      if (!agent) throw new NotFoundError('Agent not found');

      return service.runAllCases(req.params.id, workspaceId);
    },
  );

  // POST /agents/:id/eval-cases/:caseId/runs — run a single eval case
  app.post(
    '/agents/:id/eval-cases/:caseId/runs',
    { schema: { params: AgentCaseParams } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const agent = await app.container.agentsRepo.getById(workspaceId, req.params.id);
      if (!agent) throw new NotFoundError('Agent not found');

      return service.runSingleCase(req.params.caseId, workspaceId);
    },
  );

  // GET /agents/:id/eval-runs — list all runs for an agent
  app.get('/agents/:id/eval-runs', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const agent = await app.container.agentsRepo.getById(workspaceId, req.params.id);
    if (!agent) throw new NotFoundError('Agent not found');

    return service.listRuns(req.params.id);
  });

  // GET /evals/dashboard — workspace-wide dashboard
  app.get('/evals/dashboard', async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.getDashboard(workspaceId);
  });
}
