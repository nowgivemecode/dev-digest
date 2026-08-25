import type { DevDigestClient } from '../http/client.js';

export async function resolveRepoId(client: DevDigestClient, repo: string): Promise<{ repoId: string } | { error: string }> {
  const repos = await client.listRepos() as Array<{ id: string; name: string; fullName?: string }>;
  const match = repos.find(r => r.name === repo || r.fullName === repo || r.id === repo);
  if (!match) return { error: `Repository "${repo}" not found. Available: ${repos.map(r => r.name).join(', ')}` };
  return { repoId: match.id };
}

export async function resolvePullId(client: DevDigestClient, repo: string, prNumber: number): Promise<{ pullId: string } | { error: string }> {
  const resolved = await resolveRepoId(client, repo);
  if ('error' in resolved) return resolved;
  const pulls = await client.listPulls(resolved.repoId) as Array<{ id: string; number: number }>;
  const pr = pulls.find(p => p.number === prNumber);
  if (!pr) return { error: `PR #${prNumber} not found in repo "${repo}".` };
  return { pullId: pr.id };
}
