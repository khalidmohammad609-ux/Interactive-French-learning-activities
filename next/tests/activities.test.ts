import { beforeEach, describe, expect, it } from 'vitest';
import { setStore } from '@/lib/store';
import { memoryStore } from '@/lib/store-memory';
import { activities, addActivity, merge, slug, teacherAct, updateActivity, githubList, activitySource } from '@/lib/activities';
import type { ActivityRow, GithubActivity } from '@/lib/types';

const row = (p: Partial<ActivityRow>): ActivityRow => ({
  id: 'x', title: null, emoji: null, topic: null, for: null, source: 'github', file_path: null, hidden: null,
  removed: false, video: null, short: null, updated: '2026-11-20T00:00:00Z', created: '2026-11-20T00:00:00Z', ...p,
});
const gh: GithubActivity[] = [
  { id: 'a', title: 'A', emoji: '🤝', topic: 'tA', for: 'A1', file: 'a.html', updated: '2026-11-19' },
  { id: 'b', title: 'B', file: 'b.html', updated: '2026-11-19', hidden: true },
];

describe('merge (same rules as Code.gs activities_)', () => {
  it('keeps the GitHub list as it is when there are no rows', () => {
    const m = merge(gh, [], false);
    expect(m.map((a) => a.id)).toEqual(['a', 'b']);
    expect(m[1].hidden).toBe(true);
  });
  it('github rows override only filled fields; null hidden keeps the file value', () => {
    const m = merge(gh, [row({ id: 'a', title: 'New A', topic: '', hidden: null }), row({ id: 'b', hidden: false })], false);
    expect(m[0]).toMatchObject({ title: 'New A', topic: 'tA', emoji: '🤝', hidden: false });
    expect(m[1].hidden).toBe(false);
  });
  it('removed activities are left out unless asked for', () => {
    const rows = [row({ id: 'a', removed: true })];
    expect(merge(gh, rows, false).map((a) => a.id)).toEqual(['b']);
    expect(merge(gh, rows, true).find((a) => a.id === 'a')!.removed).toBe(true);
  });
  it('uploads are added after GitHub ones; same id: newest wins', () => {
    const up = row({ id: 'c', title: 'C', source: 'upload', file_path: 'c.html' });
    expect(merge(gh, [up], false).map((a) => a.id)).toEqual(['a', 'b', 'c']);
    const newer = merge(gh, [row({ id: 'a', title: 'Upload A', source: 'upload', file_path: 'p', updated: '2026-11-25T00:00:00Z' })], false);
    expect(newer[0]).toMatchObject({ title: 'Upload A', source: 'upload' });
    const older = merge(gh, [row({ id: 'a', title: 'Upload A', source: 'upload', file_path: 'p', updated: '2026-11-01T00:00:00Z' })], false);
    expect(older[0]).toMatchObject({ title: 'A', source: 'github' });
  });
  it('github override rows for unknown ids are ignored', () => {
    expect(merge(gh, [row({ id: 'zzz', title: 'ghost' })], true).map((a) => a.id)).toEqual(['a', 'b']);
  });
});

describe('teacher actions on the store', () => {
  beforeEach(() => setStore(memoryStore()));
  const page = '<!DOCTYPE html><html><body><div>Une activité</div><script>function report(){}</script></body></html>';

  it('slug strips accents', () => expect(slug("L'été à Paris !")).toBe('l-ete-a-paris'));

  it('the real activities.json is readable and every file exists', async () => {
    const list = githubList();
    expect(list.length).toBeGreaterThan(0);
    for (const a of await activities(true)) expect((await activitySource(a)).length).toBeGreaterThan(1000);
  });

  it('adds an upload with a free id, stores the file, and reads it back', async () => {
    const first = await addActivity({ title: 'Je te présente…' }, page); // slug clashes with nothing? "je-te-presente" exists on GitHub
    const added = first.find((a) => a.source === 'upload')!;
    expect(added.id).toBe('je-te-presente-2');
    expect(await activitySource(added)).toBe(page);
    const again = await addActivity({ title: 'Je te présente…' }, page);
    expect(again.filter((a) => a.source === 'upload').map((a) => a.id)).toEqual(['je-te-presente-2', 'je-te-presente-3']);
  });

  it('refuses things that are not HTML pages', async () => {
    await expect(addActivity({ title: 'x' }, 'hello')).rejects.toThrow(/HTML/);
  });

  it('first change to a GitHub activity creates an override row; later changes update it', async () => {
    let list = await updateActivity('imparfait', { hidden: true });
    expect(list.find((a) => a.id === 'imparfait')!.hidden).toBe(true);
    list = await updateActivity('imparfait', { title: 'Imparfait 2', video: 'https://youtu.be/abcdefgh' });
    const a = list.find((x) => x.id === 'imparfait')!;
    expect(a).toMatchObject({ title: 'Imparfait 2', hidden: true, video: 'https://youtu.be/abcdefgh', source: 'github' });
    list = await updateActivity('imparfait', { removed: true });
    expect((await activities(false)).some((x) => x.id === 'imparfait')).toBe(false);
    list = await updateActivity('imparfait', { removed: false });
    expect((await activities(false)).some((x) => x.id === 'imparfait')).toBe(true);
  });

  it('unknown activity → error', async () => {
    await expect(updateActivity('nope', { hidden: true })).rejects.toThrow(/not found/);
  });

  it('master page sees uploads as « drive » with fileId (what teacher.html expects)', async () => {
    const list = await addActivity({ title: 'Upload' }, page);
    const t = teacherAct(list.find((a) => a.source === 'upload')!);
    expect(t).toMatchObject({ source: 'drive' });
    expect(typeof (t as { fileId?: string }).fileId).toBe('string');
    expect('filePath' in t).toBe(false);
  });
});
