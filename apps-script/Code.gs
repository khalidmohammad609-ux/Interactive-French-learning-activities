/**
 * Interactive French learning activities — results collector (Dr. Mohammad Khalid)
 *
 * Pasted into script.google.com. Pages (activities, student page, master page) are
 * loaded live from GitHub, so most updates go online without redeploying.
 * Activities added from the master page are stored in a Drive folder and listed
 * in the « Activities » tab of the results Sheet.
 *
 * Links (after Deploy → Web app):
 *   <web app URL>                 → list of activities (for students)
 *   <web app URL>?a=<activity id> → one activity; each finished level is saved
 *   <web app URL>?page=teacher&key=<your key> → your master page (results)
 */

// ---- Settings ---------------------------------------------------------------
const VERSION       = '1.1';
const GITHUB_OWNER  = 'khalidmohammad609-ux';
const GITHUB_REPO   = 'Interactive-French-learning-activities';
const GITHUB_BRANCH = 'main';
const CACHE_SECONDS = 300;                       // GitHub files are re-read every 5 min
const SHEET_NAME    = 'Results';
const ACT_SHEET     = 'Activities';
const FOLDER_NAME   = 'French activities — files';
const HEADERS = ['Date & time', 'Name', 'Activity', 'Activity id', 'Level', 'Score',
                 'Out of', '%', 'Right 1st try', 'Right 2nd try', 'To review', 'Errors', 'Device'];
const ACT_HEADERS = ['id', 'title', 'emoji', 'topic', 'for', 'source', 'fileId', 'hidden', 'removed', 'updated', 'video', 'short'];

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
  actSheet_();
  folder_();
  Logger.log('Results Sheet: https://docs.google.com/spreadsheets/d/' + id);
  Logger.log('Setup done (version ' + VERSION + ').');
}

// Prints your links. Note: when run from the editor Google shows the /dev test link;
// students must use the /exec link from Deploy → Manage deployments.
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
  const act = activities_(false).find(function (x) { return x.id === id; });
  if (!act) throw new Error('No activity called "' + id + '".');
  let html = source_(act);
  const bridge = '<script>window.RRU_ACTIVITY=' + safeJson_({ id: act.id, title: act.title, video: act.video || '', short: act.short || '' }) + ';</script>\n' +
                 '<script>' + gh_('web/bridge.js') + '</script>\n';
  const k = html.toLowerCase().lastIndexOf('</body>');
  html = k >= 0 ? html.slice(0, k) + bridge + html.slice(k) : html + bridge;
  return out_(html, act.title);
}

function homePage_() {
  const html = gh_('web/home.html').replace('/*__DATA__*/', 'window.DATA=' + safeJson_({
    url: ScriptApp.getService().getUrl(),
    activities: activities_(false).filter(function (a) { return !a.hidden; }).map(publicAct_)
  }) + ';');
  return out_(html, 'French activities · RRU');
}

function teacherPage_(key) {
  if (!checkKey_(key)) {
    return out_('<div style="font:16px sans-serif;padding:24px"><h2>🔒 Teacher page</h2><p>This link is not valid.</p></div>', 'Teacher');
  }
  const props = PropertiesService.getScriptProperties();
  let standard = null;
  try { standard = JSON.parse(gh_('web/standard.json')); } catch (e) {}
  const html = gh_('web/teacher.html').replace('/*__DATA__*/', 'window.DATA=' + safeJson_({
    url: ScriptApp.getService().getUrl(),
    key: key,
    version: VERSION,
    sheet: 'https://docs.google.com/spreadsheets/d/' + props.getProperty('SHEET_ID'),
    repo: 'https://github.com/' + GITHUB_OWNER + '/' + GITHUB_REPO,
    standard: standard,
    activities: activities_(true)
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
  const act = activities_(false).find(function (x) { return x.id === r.id; });
  if (!act) return { ok: false };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const total = num(r.total), score = num(r.score);
    sheet_().appendRow([
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

/** Master page: list of all activities, removed ones included. */
function getActivities(key) {
  if (!checkKey_(key)) throw new Error('Not allowed');
  return activities_(true);
}

/** Master page: adds an activity uploaded or pasted by the teacher (stored in Drive). */
function addActivity(key, meta, html) {
  if (!checkKey_(key)) throw new Error('Not allowed');
  meta = meta || {};
  html = String(html || '');
  if (html.length < 50 || !/<html|<body|<script|<div/i.test(html)) throw new Error('This does not look like an HTML page.');
  const title = String(meta.title || '').trim().slice(0, 120) || 'Untitled activity';
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const taken = {};
    activities_(true).forEach(function (a) { taken[a.id] = 1; });
    const base = slug_(meta.id || title) || 'activity';
    let id = base, n = 2;
    while (taken[id]) id = base + '-' + (n++);
    const file = folder_().createFile(id + '.html', html, 'text/html');
    actSheet_().appendRow([id, title, String(meta.emoji || '📘').slice(0, 8), String(meta.topic || '').slice(0, 200),
      String(meta['for'] || '').slice(0, 80), 'drive', file.getId(), !!meta.hidden, false, new Date(), '', '']);
  } finally {
    lock.releaseLock();
  }
  return activities_(true);
}

/** Master page: changes title / emoji / topic / for / hidden / removed of an activity. */
function updateActivity(key, id, patch) {
  if (!checkKey_(key)) throw new Error('Not allowed');
  patch = patch || {};
  const act = activities_(true).find(function (x) { return x.id === id; });
  if (!act) throw new Error('Activity not found.');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = actSheet_();
    const rows = sh.getDataRange().getValues();
    let r = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === id && rows[i][5] === act.source) { r = i + 1; break; }
    }
    if (r < 0) {                                    // first change to a GitHub activity
      sh.appendRow([id, '', '', '', '', 'github', '', '', '', new Date(), '', '']);
      r = sh.getLastRow();
    }
    const col = { title: 2, emoji: 3, topic: 4, 'for': 5, hidden: 8, removed: 9, video: 11, 'short': 12 };
    Object.keys(col).forEach(function (k) {
      if (k in patch) sh.getRange(r, col[k]).setValue(k === 'hidden' || k === 'removed' ? !!patch[k] : String(patch[k]).slice(0, 500));
    });
    if (act.source === 'drive') sh.getRange(r, 10).setValue(new Date());
  } finally {
    lock.releaseLock();
  }
  return activities_(true);
}

/** Master page: the HTML of an activity (for the upgrade check). */
function getActivitySource(key, id) {
  if (!checkKey_(key)) throw new Error('Not allowed');
  const act = activities_(true).find(function (x) { return x.id === id; });
  if (!act) throw new Error('Activity not found.');
  return source_(act);
}

// ---- Activities -------------------------------------------------------------

/**
 * GitHub list (activities/activities.json) + rows of the « Activities » tab.
 * - source=drive rows are activities added from the master page;
 * - source=github rows only override title/emoji/topic/for/hidden/removed of a GitHub activity;
 * - when the same id exists on both sides, the most recently updated version is used.
 */
function activities_(includeRemoved) {
  const map = {}, order = [];
  JSON.parse(gh_('activities/activities.json')).forEach(function (a) {
    a.source = 'github'; a.hidden = !!a.hidden; a.removed = false;
    if (!map[a.id]) order.push(a.id);
    map[a.id] = a;
  });
  const rows = actRows_();
  rows.filter(function (r) { return r.source === 'drive'; }).forEach(function (r) {
    const g = map[r.id];
    const gTime = g && g.updated ? Date.parse(g.updated) : 0;
    if (!g || r.updatedMs >= gTime) {
      if (!map[r.id]) order.push(r.id);
      map[r.id] = { id: r.id, title: r.title, emoji: r.emoji, topic: r.topic, 'for': r['for'], source: 'drive',
                    fileId: r.fileId, hidden: r.hidden, removed: r.removed, updated: r.updatedMs ? new Date(r.updatedMs).toISOString() : '',
                    video: r.video, 'short': r['short'] };
    }
  });
  rows.filter(function (r) { return r.source === 'github'; }).forEach(function (r) {
    const a = map[r.id];
    if (!a || a.source !== 'github') return;
    ['title', 'emoji', 'topic', 'for', 'video', 'short'].forEach(function (k) { if (r[k] !== '') a[k] = r[k]; });
    a.hidden = r.hiddenSet ? r.hidden : a.hidden;
    a.removed = r.removed;
  });
  return order.map(function (id) { return map[id]; })
    .filter(function (a) { return includeRemoved || !a.removed; });
}

function actRows_() {
  const v = actSheet_().getDataRange().getValues();
  v.shift();
  return v.filter(function (r) { return r[0]; }).map(function (r) {
    return {
      id: String(r[0]), title: String(r[1]), emoji: String(r[2]), topic: String(r[3]), 'for': String(r[4]),
      source: String(r[5] || 'drive'), fileId: String(r[6]), hidden: r[7] === true || r[7] === 'TRUE',
      hiddenSet: r[7] !== '', removed: r[8] === true || r[8] === 'TRUE',
      updatedMs: r[9] instanceof Date ? r[9].getTime() : (Date.parse(r[9]) || 0),
      video: String(r[10] == null ? '' : r[10]), 'short': String(r[11] == null ? '' : r[11])
    };
  });
}

function source_(act) {
  if (act.source === 'drive') return DriveApp.getFileById(act.fileId).getBlob().getDataAsString('UTF-8');
  return gh_('activities/' + act.file);
}

function publicAct_(a) {
  return { id: a.id, title: a.title, emoji: a.emoji, topic: a.topic, 'for': a['for'], video: !!(a.video || a['short']) };
}

function actSheet_() {
  const ss = SpreadsheetApp.openById(sheetId_());
  let sh = ss.getSheetByName(ACT_SHEET);
  if (!sh) {
    sh = ss.insertSheet(ACT_SHEET);
    sh.appendRow(ACT_HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, ACT_HEADERS.length).setFontWeight('bold').setBackground('#dde8ff');
  } else if (sh.getLastColumn() < ACT_HEADERS.length) {
    sh.getRange(1, 1, 1, ACT_HEADERS.length).setValues([ACT_HEADERS]).setFontWeight('bold').setBackground('#dde8ff');
  }
  return sh;
}

function folder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const f = DriveApp.createFolder(FOLDER_NAME);
  props.setProperty('FOLDER_ID', f.getId());
  return f;
}

// ---- Helpers ----------------------------------------------------------------
function sheetId_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('Run setup() once in the Apps Script editor.');
  return id;
}

function sheet_() {
  const ss = SpreadsheetApp.openById(sheetId_());
  return ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
}

function checkKey_(key) {
  const real = PropertiesService.getScriptProperties().getProperty('TEACHER_KEY');
  return !!real && key === real;
}

function slug_(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
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
  const files = ['activities/activities.json', 'web/bridge.js', 'web/home.html', 'web/teacher.html', 'web/standard.json'];
  try { JSON.parse(gh_('activities/activities.json')).forEach(function (a) { files.push('activities/' + a.file); }); } catch (e) {}
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
