import { beforeEach, describe, expect, it } from 'vitest';
import { FILES } from '@/lib/content.generated';
import { TEACHER_WORDING, beforeBodyEnd, headStart, safeJson } from '@/lib/html';
import { activityHtml, homeHtml, teacherHtml } from '@/lib/pages';
import { setStore } from '@/lib/store';
import { memoryStore } from '@/lib/store-memory';
import { updateActivity } from '@/lib/activities';

beforeEach(() => setStore(memoryStore()));

describe('shared files still fit this app (fails if web/*.html changes in a way that breaks it)', () => {
  it('every Apps Script wording replacement is still found in teacher.html', () => {
    for (const [from] of TEACHER_WORDING) expect(FILES['web/teacher.html'], from).toContain(from);
  });
  it('home and teacher pages have the DATA placeholder', () => {
    expect(FILES['web/home.html']).toContain('/*__DATA__*/');
    expect(FILES['web/teacher.html']).toContain('/*__DATA__*/');
  });
  it('teacher.html only calls functions the adapter knows', () => {
    const called = new Set([...FILES['web/teacher.html'].matchAll(/call\('(\w+)'/g)].map((m) => m[1]));
    called.add('getResults');
    expect([...called].sort()).toEqual(['addActivity', 'getActivities', 'getActivitySource', 'getResults', 'updateActivity']);
  });
  it('bridge.js only calls saveResult', () => {
    expect([...FILES['web/bridge.js'].matchAll(/\.(\w+)\(r\);?\s*\n/g)].map((m) => m[1])).toContain('saveResult');
  });
});

describe('html helpers', () => {
  it('safeJson cannot close a <script>', () => expect(safeJson({ t: '</script><b>' })).not.toContain('</script>'));
  it('inserts in the right places', () => {
    expect(headStart('<html><head><title>x</title></head><body></body></html>', 'S')).toBe('<html><head>S<title>x</title></head><body></body></html>');
    expect(beforeBodyEnd('<body>a</BODY>', 'B')).toBe('<body>aB</BODY>');
    expect(beforeBodyEnd('no body', 'B')).toBe('no bodyB');
  });
});

describe('pages', () => {
  it('student page lists visible activities and links with ?a=', async () => {
    const html = await homeHtml('https://x.app');
    expect(html).toContain('window.DATA=');
    expect(html).toContain('"url":"https://x.app/"');
    expect(html).toContain('je-te-presente');
    expect(html).toContain('rel="manifest"');
    await updateActivity('imparfait', { hidden: true });
    expect(await homeHtml('https://x.app')).not.toContain('"imparfait"');
  });
  it('student page never leaks video links or files', async () => {
    await updateActivity('imparfait', { video: 'https://youtu.be/SECRETVID' });
    const html = await homeHtml('https://x.app');
    expect(html).not.toContain('SECRETVID');
    expect(html).not.toContain('.html"');
  });
  it('activity page: adapter first, then the page, then RRU_ACTIVITY + bridge before </body>', async () => {
    await updateActivity('imparfait', { video: 'https://youtu.be/abcdefgh' });
    const p = (await activityHtml('imparfait'))!;
    const h = p.html;
    const shim = h.indexOf('google.script.run=runner'), report = h.search(/function report\s*\(/), act = h.indexOf('window.RRU_ACTIVITY='),
      bridge = h.indexOf('Results bridge'), end = h.toLowerCase().lastIndexOf('</body>');
    expect(shim).toBeGreaterThan(-1);
    expect(shim).toBeLessThan(report);
    expect(report).toBeLessThan(act);
    expect(act).toBeLessThan(bridge);
    expect(bridge).toBeLessThan(end);
    expect(h).toContain('youtu.be/abcdefgh');
  });
  it('unknown and removed activities give null (404)', async () => {
    expect(await activityHtml('nope')).toBeNull();
    await updateActivity('imparfait', { removed: true });
    expect(await activityHtml('imparfait')).toBeNull();
  });
  it('master page: CSV link instead of Sheet, no key, new wording, sign out', async () => {
    const h = await teacherHtml('https://x.app');
    expect(h).toContain('"sheet":"/api/teacher/export"');
    expect(h).toContain('"key":""');
    expect(h).toContain('📊 Export results (CSV)');
    expect(h).not.toContain('Open the Sheet');
    expect(h).toContain('/logout');
    expect(h.indexOf('google.script.run=runner')).toBeLessThan(h.indexOf('window.DATA='));
  });
});
