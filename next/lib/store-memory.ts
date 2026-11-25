import type { ActivityRow, ResultRow, Store } from './types';

/** In-memory store for tests and LOCAL_MODE. Same behaviour as the Supabase store. */
export function memoryStore(): Store {
  const acts: ActivityRow[] = [];
  const results: ResultRow[] = [];
  const files = new Map<string, string>();
  let nextId = 1;
  return {
    async listActivityRows() { return acts.map((a) => ({ ...a })).sort((a, b) => a.created.localeCompare(b.created)); },
    async insertActivityRow(row) {
      if (acts.some((a) => a.id === row.id)) return false;
      acts.push({ ...row });
      return true;
    },
    async updateActivityRow(id, patch) {
      const a = acts.find((x) => x.id === id);
      if (a) Object.assign(a, patch);
    },
    async insertResult(r) { results.push({ ...r, id: nextId++ }); },
    async listResults() { return results.map((r) => ({ ...r })); },
    async countResultsSince(ipHash, sinceIso) {
      return results.filter((r) => r.ip_hash === ipHash && r.created >= sinceIso).length;
    },
    async putFile(path, html) { files.set(path, html); },
    async getFile(path) {
      const f = files.get(path);
      if (f == null) throw new Error('File not found: ' + path);
      return f;
    },
    async ping() {},
  };
}
