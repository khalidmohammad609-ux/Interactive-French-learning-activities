/** Helpers to serve the existing web/*.html and activities/*.html files unchanged. */

export function safeJson(o: unknown): string {
  return JSON.stringify(o).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

export function beforeBodyEnd(html: string, snippet: string): string {
  const k = html.toLowerCase().lastIndexOf('</body>');
  return k >= 0 ? html.slice(0, k) + snippet + html.slice(k) : html + snippet;
}

/** Puts the snippet at the start of <head> (or at the top), so it runs before the page's own scripts. */
export function headStart(html: string, snippet: string): string {
  const m = html.match(/<head[^>]*>/i);
  if (m && m.index != null) { const k = m.index + m[0].length; return html.slice(0, k) + snippet + html.slice(k); }
  return snippet + html;
}

export function htmlResponse(html: string, init: { status?: number; cache?: string } = {}): Response {
  return new Response(html, {
    status: init.status || 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': init.cache || 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  });
}

export function messagePage(title: string, text: string, status = 200): Response {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  return htmlResponse('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + esc(title) + '</title></head><body style="margin:0;background:#fff8f1;color:#2b1a14;font:17px/1.5 system-ui,sans-serif">' +
    '<div style="max-width:560px;margin:40px auto;padding:24px;background:#fff;border-top:7px solid #db2777;border-radius:18px">' +
    '<h2 style="margin-top:0">' + esc(title) + '</h2><p>' + esc(text) + '</p></div></body></html>', { status });
}

/** Link tags for the installable app (PWA). */
export function pwaTags(manifest: string): string {
  return '<link rel="manifest" href="' + manifest + '"><meta name="theme-color" content="#c2410c">' +
    '<link rel="icon" href="/icon-192.png"><link rel="apple-touch-icon" href="/icon-192.png">' +
    '<meta name="apple-mobile-web-app-capable" content="yes">' +
    '<script>if("serviceWorker"in navigator)addEventListener("load",function(){navigator.serviceWorker.register("/sw.js").catch(function(){})})</script>';
}

/**
 * Stand-in for Apps Script's google.script.run, so web/bridge.js and web/teacher.html work unchanged:
 * each call becomes a fetch() to the matching /api route. The teacher key argument is ignored
 * (the login cookie is checked instead).
 */
export const RUN_SHIM = `<script>(function(){
var M={
 saveResult:function(r){return['POST','/api/results',r]},
 getResults:function(){return['GET','/api/teacher/results']},
 getActivities:function(){return['GET','/api/teacher/activities']},
 addActivity:function(k,meta,html){return['POST','/api/teacher/activities',{meta:meta,html:html}]},
 updateActivity:function(k,id,patch){return['PATCH','/api/teacher/activities/'+encodeURIComponent(id),patch]},
 getActivitySource:function(k,id){return['GET','/api/teacher/activities/'+encodeURIComponent(id)+'/source']}
};
function go(name,m,ok,fail){
 var body=m[2]===undefined?undefined:JSON.stringify(m[2]);
 var opt={method:m[0],credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},body:body};
 if(name==='saveResult'&&body&&body.length<60000)opt.keepalive=true;
 fetch(m[1],opt).then(function(res){
  return res.json().catch(function(){return{}}).then(function(j){
   if(res.status===401&&name!=='saveResult'){location.href='/login';throw new Error('Please sign in again.')}
   // A result for an activity that no longer exists is dropped, not queued for ever.
   if(name==='saveResult'&&res.status>=400&&res.status<500&&res.status!==429)return j;
   if(!res.ok)throw new Error(j.error||('Error '+res.status));
   return j.data;
  })
 }).then(function(d){ok&&ok(d)},function(e){fail&&fail(e)})
}
function runner(ok,fail){
 var o={withSuccessHandler:function(f){return runner(f,fail)},withFailureHandler:function(f){return runner(ok,f)}};
 Object.keys(M).forEach(function(n){o[n]=function(){go(n,M[n].apply(null,arguments),ok,fail)}});
 return o;
}
window.google=window.google||{};google.script=google.script||{};google.script.run=runner(null,null);
})();</script>`;

/**
 * Wording on web/teacher.html that only fits Apps Script. Changed when served by this app;
 * the file itself stays as it is for the old app. A test checks every one is still found.
 */
export const TEACHER_WORDING: [string, string][] = [
  ['Teacher only · keep this link private', 'Teacher only · signed in'],
  ['📊 Open the Sheet', '📊 Export results (CSV)'],
  ['📁 = added by you (Drive)', '📁 = added by you (upload)'],
  ["'📁 Drive'", "'📁 Uploaded'"],
  ['Its past results stay in your Sheet', 'Its past results are kept'],
  ["'Drive file `'", "'Uploaded file `'"],
];
