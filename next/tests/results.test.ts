import { beforeEach, describe, expect, it } from 'vitest';
import { setStore, store } from '@/lib/store';
import { memoryStore } from '@/lib/store-memory';
import { RATE_LIMIT, buildResult, resultsCsv, saveResult, teacherResults } from '@/lib/results';

beforeEach(() => setStore(memoryStore()));

describe('buildResult (same clipping as Code.gs saveResult)', () => {
  const act = { id: 'imparfait', title: "L'imparfait" };
  it('clips long fields and computes %', () => {
    const r = buildResult({ name: 'x'.repeat(100), level: 'l'.repeat(200), errors: 'e'.repeat(5000), device: 'd'.repeat(50), score: 7.5, total: 10, first: 7, second: 1, review: 2 }, act, 'h');
    expect(r.name.length).toBe(40);
    expect(r.level.length).toBe(120);
    expect(r.errors.length).toBe(3000);
    expect(r.device.length).toBe(20);
    expect(r).toMatchObject({ pct: 75, score: 7.5, total: 10, activity_title: "L'imparfait", activity_id: 'imparfait' });
  });
  it('bad numbers become empty, not NaN', () => {
    const r = buildResult({ score: 'abc', total: '' }, act, null);
    expect(r).toMatchObject({ score: null, total: null, pct: null });
  });
  it('the activity title comes from the server, not from the student', () => {
    expect(buildResult({ title: 'HACK' }, act, null).activity_title).toBe("L'imparfait");
  });
});

describe('saveResult', () => {
  it('saves a result for a real activity', async () => {
    const out = await saveResult({ id: 'imparfait', name: 'Kavya', score: 8, total: 10 }, '1.2.3.4');
    expect(out.status).toBe(200);
    const rows = await teacherResults();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'Kavya', id: 'imparfait', pct: 80 });
    expect(typeof rows[0].t).toBe('number');
    expect('ip_hash' in rows[0]).toBe(false);
  });
  it('rejects unknown activities and junk', async () => {
    expect((await saveResult({ id: 'nope' }, '1.2.3.4')).status).toBe(404);
    expect((await saveResult(null, '1.2.3.4')).status).toBe(400);
    expect((await saveResult('text', '1.2.3.4')).status).toBe(400);
  });
  it('rate limit per network address, others unaffected', async () => {
    for (let i = 0; i < RATE_LIMIT.max; i++) await saveResult({ id: 'imparfait' }, '9.9.9.9');
    expect((await saveResult({ id: 'imparfait' }, '9.9.9.9')).status).toBe(429);
    expect((await saveResult({ id: 'imparfait' }, '8.8.8.8')).status).toBe(200);
  });
  it('the address itself is never stored', async () => {
    await saveResult({ id: 'imparfait' }, '5.6.7.8');
    const raw = await store().listResults();
    expect(JSON.stringify(raw)).not.toContain('5.6.7.8');
  });
});

describe('CSV export', () => {
  it('has the Sheet columns, quotes commas/newlines and defuses formulas', async () => {
    await saveResult({ id: 'imparfait', name: '=HYPERLINK("x")', errors: 'a, b\nc', score: 1, total: 2 }, '1.1.1.1');
    const csv = await resultsCsv();
    expect(csv.startsWith('﻿Date & time,Name,Activity')).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"a, b\nc"');
  });
});
