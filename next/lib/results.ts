import { createHash } from 'node:crypto';
import { findActivity } from './activities';
import { store } from './store';
import type { ResultRow } from './types';

export const RATE_LIMIT = { max: 300, minutes: 10 }; // per network address; a whole class may share one

const clip = (v: unknown, n: number) => String(v == null ? '' : v).slice(0, n);
const num = (v: unknown): number | null => {
  if (v === '' || v == null) return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};
const int = (v: unknown): number | null => { const x = num(v); return x == null ? null : Math.round(x); };

/** Same clipping rules as Code.gs saveResult. Returns null if the payload is unusable. */
export function buildResult(r: Record<string, unknown>, act: { id: string; title: string }, ipHash: string | null): ResultRow {
  const total = int(r.total), score = num(r.score);
  return {
    created: new Date().toISOString(),
    name: clip(r.name, 40).trim(), activity_id: act.id, activity_title: act.title, level: clip(r.level, 120),
    score, total, pct: total && score != null ? Math.round(score / total * 100) : null,
    first: int(r.first), second: int(r.second), review: int(r.review),
    errors: clip(r.errors, 3000), device: clip(r.device, 20), ip_hash: ipHash,
  };
}

export function hashIp(ip: string): string {
  return createHash('sha256').update('rru:' + ip).digest('hex').slice(0, 24); // the address itself is never stored
}

export type SaveOutcome = { status: number; body: { ok: boolean; error?: string } };

export async function saveResult(body: unknown, ip: string): Promise<SaveOutcome> {
  if (!body || typeof body !== 'object') return { status: 400, body: { ok: false, error: 'bad request' } };
  const r = body as Record<string, unknown>;
  const act = await findActivity(String(r.id || ''));
  if (!act) return { status: 404, body: { ok: false, error: 'unknown activity' } };
  const ipHash = hashIp(ip || 'unknown');
  const since = new Date(Date.now() - RATE_LIMIT.minutes * 60_000).toISOString();
  if (await store().countResultsSince(ipHash, since) >= RATE_LIMIT.max) {
    return { status: 429, body: { ok: false, error: 'too many results, try again later' } };
  }
  await store().insertResult(buildResult(r, act, ipHash));
  return { status: 200, body: { ok: true } };
}

/** Results in the shape web/teacher.html uses (same as Code.gs getResults). */
export async function teacherResults() {
  return (await store().listResults()).map((x) => ({
    t: Date.parse(x.created), name: x.name, activity: x.activity_title, id: x.activity_id, level: x.level,
    score: x.score ?? '', total: x.total ?? '', pct: x.pct ?? '', first: x.first ?? '', second: x.second ?? '',
    review: x.review ?? '', errors: x.errors, device: x.device,
  }));
}

const CSV_HEAD = ['Date & time', 'Name', 'Activity', 'Activity id', 'Level', 'Score', 'Out of', '%',
  'Right 1st try', 'Right 2nd try', 'To review', 'Errors', 'Device'];

/** CSV export (same columns as the old Sheet). Opens in Excel / Google Sheets. */
export async function resultsCsv(): Promise<string> {
  const cell = (v: unknown) => {
    let t = String(v ?? '');
    if (/^[=+\-@]/.test(t)) t = "'" + t; // a student name like "=HYPERLINK(...)" must not run as a formula
    return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  };
  const fmt = (iso: string) => new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' });
  const rows = (await store().listResults()).map((x) => [fmt(x.created), x.name, x.activity_title, x.activity_id, x.level,
    x.score, x.total, x.pct, x.first, x.second, x.review, x.errors, x.device]);
  return '﻿' + [CSV_HEAD, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
