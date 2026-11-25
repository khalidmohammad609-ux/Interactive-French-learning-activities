import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ActivityRow, ResultRow, Store } from './types';

const BUCKET = 'activities';

/** Server-only store. Uses the secret key: row-level security blocks everyone else. */
export function supabaseStore(url: string, secretKey: string): Store {
  const db: SupabaseClient = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const ok = <T>(res: { data: T; error: { message: string } | null }): T => {
    if (res.error) throw new Error(res.error.message);
    return res.data;
  };
  return {
    async listActivityRows() {
      return ok(await db.from('activities').select('*').order('created', { ascending: true })) as ActivityRow[];
    },
    async insertActivityRow(row) {
      const res = await db.from('activities').insert(row);
      if (res.error) {
        if ((res.error as { code?: string }).code === '23505') return false; // id already taken
        throw new Error(res.error.message);
      }
      return true;
    },
    async updateActivityRow(id, patch) {
      ok(await db.from('activities').update(patch).eq('id', id));
    },
    async insertResult(r) {
      ok(await db.from('results').insert(r));
    },
    async listResults() {
      const all: ResultRow[] = [];
      for (let from = 0; ; from += 1000) { // Supabase returns at most 1000 rows per request
        const page = ok(await db.from('results')
          .select('id,created,name,activity_id,activity_title,level,score,total,pct,first,second,review,errors,device')
          .order('id', { ascending: true }).range(from, from + 999)) as ResultRow[];
        all.push(...page);
        if (page.length < 1000) return all;
      }
    },
    async countResultsSince(ipHash, sinceIso) {
      const res = await db.from('results').select('id', { count: 'exact', head: true })
        .eq('ip_hash', ipHash).gte('created', sinceIso);
      if (res.error) throw new Error(res.error.message);
      return res.count || 0;
    },
    async putFile(path, html) {
      ok(await db.storage.from(BUCKET).upload(path, new Blob([html], { type: 'text/html' }),
        { upsert: true, contentType: 'text/html; charset=utf-8' }));
    },
    async getFile(path) {
      const blob = ok(await db.storage.from(BUCKET).download(path)) as Blob;
      return await blob.text();
    },
    async ping() {
      ok(await db.from('activities').select('id', { head: true, count: 'exact' }));
    },
  };
}
