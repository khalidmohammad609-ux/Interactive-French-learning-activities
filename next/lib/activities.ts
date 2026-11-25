import { FILES } from './content.generated';
import { store } from './store';
import type { Activity, ActivityRow, GithubActivity } from './types';

export function githubList(): GithubActivity[] {
  return JSON.parse(FILES['activities/activities.json'] || '[]');
}

const s = (v: string | null | undefined) => (v == null ? '' : String(v));

/**
 * Same rule as Code.gs activities_():
 * GitHub list (activities.json) + database rows.
 * - source=upload rows are activities added from the master page;
 * - source=github rows only override title/emoji/topic/for/video/short/hidden/removed of a GitHub activity
 *   (empty or null = no change);
 * - same id on both sides: the most recently updated one wins.
 */
export function merge(gh: GithubActivity[], rows: ActivityRow[], includeRemoved: boolean): Activity[] {
  const map = new Map<string, Activity>();
  const order: string[] = [];
  for (const a of gh) {
    if (!map.has(a.id)) order.push(a.id);
    map.set(a.id, {
      id: a.id, title: a.title, emoji: s(a.emoji), topic: s(a.topic), for: s(a.for), source: 'github', file: a.file,
      hidden: !!a.hidden, removed: false, updated: s(a.updated), video: s(a.video), short: s(a.short),
    });
  }
  for (const r of rows.filter((x) => x.source === 'upload')) {
    const g = map.get(r.id);
    const gTime = g && g.updated ? Date.parse(g.updated) || 0 : 0;
    if (!g || Date.parse(r.updated) >= gTime) {
      if (!map.has(r.id)) order.push(r.id);
      map.set(r.id, {
        id: r.id, title: s(r.title), emoji: s(r.emoji), topic: s(r.topic), for: s(r.for), source: 'upload',
        filePath: s(r.file_path), hidden: !!r.hidden, removed: !!r.removed, updated: r.updated,
        video: s(r.video), short: s(r.short),
      });
    }
  }
  for (const r of rows.filter((x) => x.source === 'github')) {
    const a = map.get(r.id);
    if (!a || a.source !== 'github') continue;
    for (const k of ['title', 'emoji', 'topic', 'for', 'video', 'short'] as const) {
      if (r[k] != null && r[k] !== '') a[k] = r[k] as string;
    }
    if (r.hidden != null) a.hidden = r.hidden;
    a.removed = !!r.removed;
  }
  return order.map((id) => map.get(id)!).filter((a) => includeRemoved || !a.removed);
}

export async function activities(includeRemoved: boolean): Promise<Activity[]> {
  return merge(githubList(), await store().listActivityRows(), includeRemoved);
}

export async function findActivity(id: string, includeRemoved = false): Promise<Activity | undefined> {
  return (await activities(includeRemoved)).find((a) => a.id === id);
}

export async function activitySource(a: Activity): Promise<string> {
  if (a.source === 'upload') return store().getFile(a.filePath!);
  const f = FILES['activities/' + a.file];
  if (f == null) throw new Error('Missing file activities/' + a.file);
  return f;
}

export function slug(t: string): string {
  return String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
}

export type NewActivity = { id?: string; title?: string; emoji?: string; topic?: string; for?: string; hidden?: boolean };

/** Teacher upload: file to Storage, row to `activities`. Mirrors Code.gs addActivity. */
export async function addActivity(meta: NewActivity, html: string): Promise<Activity[]> {
  html = String(html || '');
  if (html.length < 50 || !/<html|<body|<script|<div/i.test(html)) throw new Error('This does not look like an HTML page.');
  if (html.length > 3_000_000) throw new Error('This page is too big (over 3 MB).');
  const title = String(meta.title || '').trim().slice(0, 120) || 'Untitled activity';
  const taken = new Set((await activities(true)).map((a) => a.id));
  const base = slug(meta.id || title) || 'activity';
  const now = new Date().toISOString();
  for (let n = 1; n < 200; n++) {
    const id = n === 1 ? base : base + '-' + n;
    if (taken.has(id)) continue;
    const path = id + '-' + Date.now() + '.html';
    await store().putFile(path, html);
    const inserted = await store().insertActivityRow({
      id, title, emoji: String(meta.emoji || '📘').slice(0, 8), topic: String(meta.topic || '').slice(0, 200),
      for: String(meta.for || '').slice(0, 80), source: 'upload', file_path: path, hidden: !!meta.hidden,
      removed: false, video: '', short: '', updated: now, created: now,
    });
    if (inserted) return activities(true);
    taken.add(id); // someone took it at the same moment: try the next one
  }
  throw new Error('Could not find a free id for this activity.');
}

const TEXT_FIELDS = ['title', 'emoji', 'topic', 'for', 'video', 'short'] as const;

/** Teacher edit: title / emoji / topic / for / video / short / hidden / removed. Mirrors Code.gs updateActivity. */
export async function updateActivity(id: string, patch: Record<string, unknown>): Promise<Activity[]> {
  const act = (await activities(true)).find((a) => a.id === id);
  if (!act) throw new Error('Activity not found.');
  const p: Partial<ActivityRow> = {};
  for (const k of TEXT_FIELDS) if (k in patch) p[k] = String(patch[k] ?? '').slice(0, 500);
  if ('hidden' in patch) p.hidden = !!patch.hidden;
  if ('removed' in patch) p.removed = !!patch.removed;
  const rows = await store().listActivityRows();
  const row = rows.find((r) => r.id === id && r.source === act.source);
  if (act.source === 'upload') p.updated = new Date().toISOString();
  if (row) {
    await store().updateActivityRow(id, p);
  } else { // first change to a GitHub activity
    const now = new Date().toISOString();
    const ok = await store().insertActivityRow({
      id, title: null, emoji: null, topic: null, for: null, source: 'github', file_path: null, hidden: null,
      removed: false, video: null, short: null, updated: now, created: now, ...p,
    });
    if (!ok) throw new Error('An uploaded activity already uses the id "' + id + '". Ask Claude to rename one of them.');
  }
  return activities(true);
}

/** What the student page needs (no file paths, no video links). */
export function publicAct(a: Activity) {
  return { id: a.id, title: a.title, emoji: a.emoji, topic: a.topic, for: a.for, video: !!(a.video || a.short) };
}

/**
 * What the master page (web/teacher.html) expects. It was written for Apps Script, where uploads were
 * Drive files: it shows « 📁 » for source 'drive' and prints fileId in Upgrade requests.
 */
export function teacherAct(a: Activity) {
  const { filePath, ...rest } = a;
  return a.source === 'upload' ? { ...rest, source: 'drive', fileId: filePath } : rest;
}
