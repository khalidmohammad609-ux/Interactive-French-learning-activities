/**
 * RRU French activities — results collector (Dr. Mohammad Khalid)
 *
 * This file is pasted ONCE into script.google.com. Everything students and the
 * teacher see (activities, home page, teacher page) is loaded live from GitHub,
 * so updates pushed to the repository go online without redeploying.
 *
 * Links (after Deploy → Web app):
 *   <web app URL>                 → list of activities (for students)
 *   <web app URL>?a=<activity id> → one activity; each finished level is saved
 *   <web app URL>?page=teacher&key=<your key> → your master page (results)
 */

// ---- Settings ---------------------------------------------------------------
const GITHUB_OWNER  = 'khalidmohammad609-ux';
const GITHUB_REPO   = 'Interactive-French-learning-activities';
const GITHUB_BRANCH = 'main';
const CACHE_SECONDS = 300;                       // GitHub files are re-read every 5 min
const SHEET_NAME    = 'Results';
const HEADERS = ['Date & time', 'Name', 'Activity', 'Activity id', 'Level', 'Score',
                 'Out of', '%', 'Right 1st try', 'Right 2nd try', 'To review', 'Errors', 'Device'];

// ---- One-time setup: run this once from the editor (▶ Run → setup) ----------
function setup() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('SHEET_ID');
  if (!id) {
    const ss = SpreadsheetApp.create('French activities — results');
    const sh = ss.getSheets()[0];
    sh.setName(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#ffe3d3');
    id = ss.getId();
    props.setProperty('SHEET_ID', id);
  }
  if (!props.getProperty('TEACHER_KEY')) {
    props.setProperty('TEACHER_KEY', Utilities.getUuid().replace(/-/g, '').slice(0, 12));
  }
  Logger.log('Results Sheet: https://docs.google.com/spreadsheets/d/' + id);
  Logger.log('Now click Deploy → New deployment → Web app, then run showMyLinks.');
}

// Run after deploying: prints your links in the log.
function showMyLinks() {
  const url = ScriptApp.getService().getUrl();
  const key = PropertiesService.getScriptProperties().getProperty('TEACHER_KEY');
  if (!url) { Logger.log('Deploy the web app first (Deploy → New deployment → Web app).'); return; }
  Logger.log('Students (all activities): ' + url);
  Logger.log('YOUR master page (keep private): ' + url + '?page=teacher&key=' + key);
}

// ---- Web app ----------------------------------------------------------------
function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.page === 'teacher') return teacherPage_(p.key);
    if (p.a) return activityPage_(p.a);
    return homePage_();
  } catch (err) {
    return HtmlService.createHtmlOutput(
      '<div style="font:16px sans-serif;padding:24px"><h2>😕 This page could not load</h2><p>' +
      escapeHtml_(String(err && err.message || err)) + '</p><p>Please try again in a minute.</p></div>')
      .setTitle('French activities');
  }
}

function activityPage_(id) {
  const list = activities_();
  const act = list.find(function (x) { return x.id === id; });
  if (!act) throw new Error('No activity called "' + id + '".');
  let html = gh_('activities/' + act.file);
  const bridge = '<script>window.RRU_ACTIVITY=' + safeJson_({ id: act.id, title: act.title }) + ';</script>\n' +
                 '<script>' + gh_('web/bridge.js') + '</script>\n';
  const k = html.toLowerCase().lastIndexOf('</body>');
  html = k >= 0 ? html.slice(0, k) + bridge + html.slice(k) : html + bridge;
  return out_(html, act.title);
}

function homePage_() {
  const html = gh_('web/home.html').replace('/*__DATA__*/', 'window.DATA=' + safeJson_({
    url: ScriptApp.getService().getUrl(),
    activities: activities_().filter(function (a) { return !a.hidden; })
  }) + ';');
  return out_(html, 'French activities · RRU');
}

function teacherPage_(key) {
  if (!checkKey_(key)) {
    return out_('<div style="font:16px sans-serif;padding:24px"><h2>🔒 Teacher page</h2><p>This link is not valid.</p></div>', 'Teacher');
  }
  const props = PropertiesService.getScriptProperties();
  const html = gh_('web/teacher.html').replace('/*__DATA__*/', 'window.DATA=' + safeJson_({
    url: ScriptApp.getService().getUrl(),
    key: key,
    sheet: 'https://docs.google.com/spreadsheets/d/' + props.getProperty('SHEET_ID'),
    repo: 'https://github.com/' + GITHUB_OWNER + '/' + GITHUB_REPO,
    activities: activities_()
  }) + ';');
  return out_(html, 'Master page · results');
}

function out_(html, title) {
  return HtmlService.createHtmlOutput(html)
    .setTitle(title)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ---- Called from the pages (google.script.run) ------------------------------

/** Saves one finished level. Called silently by bridge.js. */
function saveResult(r) {
  r = r || {};
  const clip = function (v, n) { return String(v == null ? '' : v).slice(0, n); };
  const num = function (v) { const x = Number(v); return isFinite(x) ? x : ''; };
  const act = activities_().find(function (x) { return x.id === r.id; });
  if (!act) return { ok: false };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet_();
    const total = num(r.total), score = num(r.score);
    sh.appendRow([
      new Date(), clip(r.name, 40), act.title, act.id, clip(r.level, 120), score, total,
      total ? Math.round(score / total * 100) : '', num(r.first), num(r.second), num(r.review),
      clip(r.errors, 3000), clip(r.device, 20)
    ]);
  } finally {
    lock.releaseLock();
  }
  return { ok: true };
}

/** Results for the master page (teacher key required). */
function getResults(key) {
  if (!checkKey_(key)) throw new Error('Not allowed');
  const v = sheet_().getDataRange().getValues();
  v.shift();
  return v.map(function (row) {
    return {
      t: row[0] instanceof Date ? row[0].getTime() : row[0], name: row[1], activity: row[2], id: row[3],
      level: row[4], score: row[5], total: row[6], pct: row[7], first: row[8], second: row[9],
      review: row[10], errors: row[11], device: row[12]
    };
  });
}

// ---- Helpers ----------------------------------------------------------------
function activities_() {
  return JSON.parse(gh_('activities/activities.json'));
}

function sheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('Run setup() once in the Apps Script editor.');
  const ss = SpreadsheetApp.openById(id);
  return ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
}

function checkKey_(key) {
  const real = PropertiesService.getScriptProperties().getProperty('TEACHER_KEY');
  return !!real && key === real;
}

/** Reads a file from GitHub, cached for a few minutes (in small pieces: the cache holds 100 kB per piece). */
function gh_(path) {
  const cache = CacheService.getScriptCache();
  const ck = 'gh:' + GITHUB_BRANCH + ':' + path;
  const n = cache.get(ck + ':n');
  if (n) {
    const keys = [];
    for (let i = 0; i < Number(n); i++) keys.push(ck + ':' + i);
    const parts = cache.getAll(keys);
    if (keys.every(function (k) { return parts[k] != null; })) {
      return keys.map(function (k) { return parts[k]; }).join('');
    }
  }
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN'); // only for a private repo
  const url = token
    ? 'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/contents/' + path + '?ref=' + GITHUB_BRANCH
    : 'https://raw.githubusercontent.com/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/' + GITHUB_BRANCH + '/' + path;
  const headers = token ? { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github.raw' } : {};
  const res = UrlFetchApp.fetch(url, { headers: headers, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Could not load ' + path + ' from GitHub (' + res.getResponseCode() + ').');
  const text = res.getContentText('UTF-8');
  try {
    const size = 24000, map = {};
    let i = 0;
    for (let s = 0; s < text.length; s += size) map[ck + ':' + (i++)] = text.slice(s, s + size);
    map[ck + ':n'] = String(i);
    cache.putAll(map, CACHE_SECONDS);
  } catch (e) { /* too big for the cache: fine, just slower */ }
  return text;
}

/** Clears the GitHub cache right away (run from the editor after an update if you can't wait 5 min). */
function refreshNow() {
  const files = ['activities/activities.json', 'web/bridge.js', 'web/home.html', 'web/teacher.html'];
  try { activities_().forEach(function (a) { files.push('activities/' + a.file); }); } catch (e) {}
  const cache = CacheService.getScriptCache();
  files.forEach(function (f) { cache.remove('gh:' + GITHUB_BRANCH + ':' + f + ':n'); });
  Logger.log('Done: pages will reload from GitHub.');
}

function safeJson_(o) {
  return JSON.stringify(o).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function escapeHtml_(s) {
  return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
}
