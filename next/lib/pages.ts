import { FILES } from './content.generated';
import { activities, activitySource, findActivity, publicAct, teacherAct } from './activities';
import { RUN_SHIM, TEACHER_WORDING, beforeBodyEnd, headStart, pwaTags, safeJson } from './html';

const VERSION = '2.0';
const REPO = 'https://github.com/khalidmohammad609-ux/Interactive-French-learning-activities';

/** Student list (web/home.html), same as Code.gs homePage_. */
export async function homeHtml(origin: string): Promise<string> {
  const data = { url: origin + '/', activities: (await activities(false)).filter((a) => !a.hidden).map(publicAct) };
  const html = FILES['web/home.html'].replace('/*__DATA__*/', 'window.DATA=' + safeJson(data) + ';');
  return headStart(html, pwaTags('/manifest.webmanifest'));
}

/** One activity with the results bridge, same as Code.gs activityPage_. Null if it doesn't exist. */
export async function activityHtml(id: string): Promise<{ html: string; title: string } | null> {
  const a = await findActivity(id);
  if (!a) return null;
  const html = headStart(await activitySource(a), RUN_SHIM);
  const bridge = '<script>window.RRU_ACTIVITY=' + safeJson({ id: a.id, title: a.title, video: a.video, short: a.short }) + ';</script>\n' +
    '<script>' + FILES['web/bridge.js'] + '</script>\n';
  return { html: beforeBodyEnd(html, bridge), title: a.title };
}

/** Master page (web/teacher.html), same as Code.gs teacherPage_. Caller checks the login first. */
export async function teacherHtml(origin: string): Promise<string> {
  let standard = null;
  try { standard = JSON.parse(FILES['web/standard.json']); } catch { /* page copes without it */ }
  const data = {
    url: origin + '/', key: '', version: VERSION, sheet: '/api/teacher/export', repo: REPO, standard,
    activities: (await activities(true)).map(teacherAct),
  };
  let html = FILES['web/teacher.html'];
  for (const [from, to] of TEACHER_WORDING) html = html.split(from).join(to);
  html = html.replace('/*__DATA__*/', 'window.DATA=' + safeJson(data) + ';');
  html = headStart(html, RUN_SHIM + pwaTags('/teacher.webmanifest'));
  const signOut = '<a href="/logout" style="position:fixed;right:12px;bottom:12px;z-index:50;font:700 13px system-ui,sans-serif;' +
    'background:#fff;color:#7a5b4e;border:2px solid #e9a8cf;border-radius:999px;padding:5px 12px;text-decoration:none">🚪 Sign out</a>';
  return beforeBodyEnd(html, signOut);
}
