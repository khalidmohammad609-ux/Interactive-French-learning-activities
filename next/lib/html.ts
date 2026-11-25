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
 saveResult:function(r){var A=window.RRU_ACTIVITY,e;if(A&&A.askEmail&&r&&!r.email&&r.id===A.id){try{e=localStorage.getItem('rru_email')}catch(x){}if(e)r.email=e}return['POST','/api/results',r]},
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

/**
 * Shown on activities where the teacher switched on « 📧 Ask for email ». It always asks (pre-filled with the
 * last email used on this device, one tap to confirm), so on a shared lab computer a result never goes to the
 * previous student's email.
 */
export const EMAIL_GATE = `<script>(function(){
var K='rru_email',RE=/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/,last='';
try{last=localStorage.getItem(K)||''}catch(e){}
var ov=document.createElement('div');ov.id='rru-email';
ov.style.cssText='position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px;'+
 'background:rgba(43,26,20,.55);backdrop-filter:blur(3px);font:17px/1.5 "Atkinson Hyperlegible",system-ui,sans-serif;color:#2b1a14';
ov.innerHTML='<form style="width:100%;max-width:420px;background:linear-gradient(135deg,#fff1f8,#eef4ff);border-radius:24px;border-top:8px solid #db2777;padding:24px 22px;box-shadow:0 12px 40px rgba(0,0,0,.25);box-sizing:border-box">'+
 '<div style="font-size:2.4rem;line-height:1">📧</div>'+
 '<h2 style="margin:8px 0 4px;font:800 1.6rem \\'Bricolage Grotesque\\',system-ui,sans-serif">Your email · Votre e-mail</h2>'+
 '<p style="margin:0 0 12px;color:#7a5b4e">Your teacher asks for your email for this activity.</p>'+
 '<input id="rru-email-in" type="email" inputmode="email" autocomplete="email" required placeholder="name@example.com" '+
 'style="font:inherit;font-size:18px;width:100%;box-sizing:border-box;padding:12px 14px;border:3px solid #e9a8cf;border-radius:14px;background:#fff">'+
 '<div id="rru-email-msg" style="min-height:1.4em;margin:6px 2px;color:#b91c1c;font-size:.9rem"></div>'+
 '<button style="font:inherit;font-weight:800;font-size:18px;width:100%;padding:12px;border:0;border-radius:999px;cursor:pointer;color:#fff;background:linear-gradient(90deg,#db2777,#7c3aed)">Start · Commencer →</button>'+
 (last?'<p style="margin:10px 0 0;font-size:.85rem;color:#7a5b4e">Not your email? Change it above.</p>':'')+'</form>';
function show(){
 document.body.appendChild(ov);var inp=document.getElementById('rru-email-in');inp.value=last;
 ov.querySelector('form').onsubmit=function(e){e.preventDefault();var v=inp.value.trim().toLowerCase();
  if(!RE.test(v)){document.getElementById('rru-email-msg').textContent='Please type a full email address, like name@gmail.com';inp.focus();return}
  try{localStorage.setItem(K,v)}catch(x){}ov.remove();
  var nm=document.getElementById('sname');if(nm&&!nm.value)nm.focus({preventScroll:true})};
 setTimeout(function(){inp.focus()},50);
}
if(document.body)show();else addEventListener('DOMContentLoaded',show);
})();</script>`;
