/**
 * service.ts — BlastService: application layer for blast radius computation.
 *
 * Onion layer: application — orchestrates repository + repoIntel facade;
 * no SQL here. Delegates data access to BlastRepository and
 * symbol/caller resolution to container.repoIntel.
 */
import type { Container } from '../../platform/container.js';
import type { BlastRadiusResult } from '@devdigest/shared';
import { NotFoundError } from '../../platform/errors.js';
import { BlastRepository } from './repository.js';

export class BlastService {
  private readonly repo: BlastRepository;

  constructor(private readonly container: Container) {
    this.repo = new BlastRepository(container.db);
  }

  async getForPr(prId: string, workspaceId: string): Promise<BlastRadiusResult> {
    const { pr, repo } = await this.repo.resolvePrAndRepo(prId, workspaceId);
    if (!pr) throw new NotFoundError('Pull request not found');
    if (!repo) throw new NotFoundError('Repo not found');

    const changedFiles = await this.repo.getChangedFilePaths(pr.id);
    if (changedFiles.length === 0) {
      return {
        changedSymbols: [],
        callers: [],
        impactedEndpoints: [],
        degraded: true,
        reason: 'no_data',
      };
    }

    const blastResult = await this.container.repoIntel.getBlastRadius(repo.id, changedFiles);
    const priorPrs = await this.repo.findPriorPrsTouchingSameFiles(repo.id, pr.id, changedFiles);

    return {
      changedSymbols: blastResult.changedSymbols,
      callers: blastResult.callers,
      impactedEndpoints: blastResult.impactedEndpoints,
      factsByFile: blastResult.factsByFile,
      priorPrs,
      degraded: blastResult.degraded,
      reason: blastResult.reason,
    };
  }
}
