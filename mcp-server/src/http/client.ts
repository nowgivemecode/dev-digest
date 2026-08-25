import { config } from '../config.js';

export class DevDigestClient {
  private readonly base: string;
  constructor() { this.base = config.apiUrl; }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.base}${path}`);
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
    return res.json() as Promise<T>;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
    return res.json() as Promise<T>;
  }

  listAgents() { return this.get<unknown[]>('/agents'); }
  listRepos() { return this.get<unknown[]>('/repos'); }
  listPulls(repoId: string) { return this.get<unknown[]>(`/repos/${repoId}/pulls`); }
  triggerReview(pullId: string, body: { agentId?: string; all?: boolean }) { return this.post<{ runId: string }>(`/pulls/${pullId}/review`, body); }
  listRuns(pullId: string) { return this.get<Array<{ id: string; status: string; ranAt?: string }>>(`/pulls/${pullId}/runs`); }
  getRunStatus(runId: string) { return this.get<{ status: string; error?: string }>(`/runs/${runId}`); }
  getRunTrace(runId: string) { return this.get<unknown>(`/runs/${runId}/trace`); }
  getConventions(repoId: string) { return this.get<unknown[]>(`/repos/${repoId}/conventions`); }
  getBlastRadius(pullId: string) { return this.get<unknown>(`/pulls/${pullId}/blast`); }
}

export function createClient(): DevDigestClient {
  return new DevDigestClient();
}
