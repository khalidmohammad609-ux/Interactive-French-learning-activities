import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { buildResult } from '@/lib/results';
import type { ActivityRow } from '@/lib/types';

/** Runs supabase/schema.sql on a real Postgres (in-process) and inserts rows shaped exactly as the app writes them. */
describe('supabase/schema.sql', () => {
  it('creates the tables, runs twice safely, and accepts the app rows', async () => {
    const db = new PGlite();
    // Supabase has these already; stand-ins for the test.
    await db.exec(`create schema storage; create table storage.buckets (id text primary key, name text, public boolean);`);
    const sql = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
    await db.exec(sql);
    await db.exec(sql); // second run: no error

    const insert = async (table: string, obj: Record<string, unknown>) => {
      const keys = Object.keys(obj);
      await db.query(`insert into ${table} (${keys.map((k) => `"${k}"`).join(',')}) values (${keys.map((_, i) => '$' + (i + 1)).join(',')})`, Object.values(obj));
    };
    const now = new Date().toISOString();
    const act: ActivityRow = { id: 'up', title: 'T', emoji: '📘', topic: '', for: 'A1', source: 'upload', file_path: 'up.html', hidden: false, removed: false, video: '', short: '', updated: now, created: now };
    await insert('activities', act as unknown as Record<string, unknown>);
    await insert('activities', { ...act, id: 'gh', source: 'github', title: null, hidden: null, file_path: null });
    await expect(insert('activities', { ...act, id: 'bad', source: 'drive' })).rejects.toThrow();
    await expect(insert('activities', act as unknown as Record<string, unknown>)).rejects.toThrow(/duplicate|unique/);

    const r = buildResult({ name: 'Kavya', score: 7.5, total: 10, first: 7, second: 1, review: 2, errors: 'x', device: 'mobile' }, { id: 'up', title: 'T' }, 'abc');
    await insert('results', r as unknown as Record<string, unknown>);
    const rows = (await db.query<{ score: string; pct: number }>('select * from results')).rows;
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].score)).toBe(7.5);
    expect(rows[0].pct).toBe(75);

    const rls = (await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class where relname in ('activities','results')`)).rows;
    expect(rls.every((x) => x.relrowsecurity)).toBe(true);
    expect((await db.query('select * from storage.buckets where id = $1 and public = false', ['activities'])).rows).toHaveLength(1);
  });
});
