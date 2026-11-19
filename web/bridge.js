/* Results bridge — added by the Apps Script server at the end of every activity page.
 * When a student opens « See my results », the result of that run is saved to the
 * teacher's Google Sheet (google.script.run.saveResult). Nothing else changes for the student.
 * Works with pages built by the standard generator (globals: report, start, order, res, SECS, ALLSECS).
 */
(function () {
  var ACT = window.RRU_ACTIVITY || { id: '', title: document.title };
  var QKEY = 'rru_pending_results';
  var sent = typeof WeakSet === 'function' ? new WeakSet() : null;

  function strip(s) {
    var d = document.createElement('div');
    d.innerHTML = String(s == null ? '' : s);
    return (d.textContent || '').replace(/\s+/g, ' ').trim();
  }
  function get(name) { try { return eval(name); } catch (e) { return undefined; } } // top-level let/const of the page

  function toast(msg, ok) {
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:99999;' +
      'padding:9px 16px;border-radius:999px;font:600 14px system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.18);' +
      'background:' + (ok ? '#dcfce7;color:#166534' : '#fef3c7;color:#92400e') + ';transition:opacity .6s';
    document.body.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; }, 2600);
    setTimeout(function () { t.remove(); }, 3400);
  }

  function collect() {
    var order = get('order'), res = get('res'), SECS = get('SECS'), ALL = get('ALLSECS');
    var nameEl = document.getElementById('sname');
    var r = {
      id: ACT.id,
      name: nameEl ? nameEl.value.trim() : '',
      device: (window.matchMedia && matchMedia('(pointer:coarse)').matches) ? 'mobile' : 'computer'
    };
    if (Array.isArray(order) && Array.isArray(res)) {
      var c = function (s) { return res.filter(function (x) { return x.st === s; }).length; };
      r.first = c(1); r.second = c(2); r.review = c(0);
      r.score = r.first + r.second * 0.5;
      r.total = order.length;
      r.level = (Array.isArray(SECS) && Array.isArray(ALL) && SECS.length === ALL.length && ALL.length > 1)
        ? 'All levels'
        : (Array.isArray(SECS) ? SECS.map(function (s) { return strip(s.name); }).join(' + ') : '');
      r.errors = order.map(function (q, k) {
        var x = res[k];
        if (!x || x.st === 1) return '';
        var line = q.s && q.s.indexOf('___') > -1 ? q.s.replace('___', '[' + q.a + ']') : (q.s ? q.s + ' → ' : '') + q.a;
        var wrong = (x.picks || []).filter(function (p) { return p !== q.a; }).map(strip);
        return (q.ph === 2 ? '✍️ ' : '') + strip(line) + (wrong.length ? '  ✗ ' + wrong.join(' / ') : '') + (x.st === 2 ? ' (2nd try)' : '');
      }).filter(Boolean).join('\n');
      r._run = res;
    } else {
      var big = document.querySelector('.big');
      var m = big && big.textContent.match(/([\d.,]+)\s*\/\s*(\d+)/);
      if (m) { r.score = Number(m[1].replace(',', '.')); r.total = Number(m[2]); }
    }
    return r;
  }

  function queue() { try { return JSON.parse(localStorage.getItem(QKEY) || '[]'); } catch (e) { return []; } }
  function setQueue(a) { try { localStorage.setItem(QKEY, JSON.stringify(a.slice(-30))); } catch (e) {} }

  function send(r, quiet) {
    if (!(window.google && google.script && google.script.run)) return;
    google.script.run
      .withSuccessHandler(function () {
        setQueue(queue().filter(function (x) { return x._k !== r._k; }));
        if (!quiet) toast('✅ Result saved for your teacher', true);
      })
      .withFailureHandler(function () {
        var q = queue(); if (!q.some(function (x) { return x._k === r._k; })) { q.push(r); setQueue(q); }
        if (!quiet) toast('⏳ Result will be sent when you are back online', false);
      })
      .saveResult(r);
  }

  function hook() {
    if (typeof window.report !== 'function' || window.report.__rru) return;
    var orig = window.report;
    var wrapped = function () {
      var out = orig.apply(this, arguments);
      try {
        var r = collect();
        var run = r._run; delete r._run;
        if (run && sent) { if (sent.has(run)) return out; sent.add(run); }
        r._k = Date.now() + '-' + Math.random().toString(36).slice(2, 7);
        send(r, false);
      } catch (e) { /* never break the activity */ }
      return out;
    };
    wrapped.__rru = true;
    window.report = wrapped;
    try { report = wrapped; } catch (e) {}
  }

  // ---- 🎬 Videos made with NotebookLM, shown at the top of the activity ----
  function embedUrl(u) {
    var m;
    if ((m = u.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{6,})/))) return 'https://www.youtube.com/embed/' + m[1] + '?rel=0';
    if ((m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]{10,})/))) return 'https://drive.google.com/file/d/' + m[1] + '/preview';
    return '';
  }
  function videoBox(url, label, vertical) {
    var e = embedUrl(url), safe = url.replace(/"/g, '&quot;');
    return '<div style="flex:' + (vertical ? '0 1 260px' : '1 1 420px') + ';min-width:0;display:flex;flex-direction:column;gap:6px">' +
      '<b style="font-family:\'Bricolage Grotesque\',system-ui,sans-serif;color:' + (vertical ? '#db2777' : '#2563eb') + '">' + label + '</b>' +
      (e ? '<div style="position:relative;width:100%;' + (vertical ? 'aspect-ratio:9/16;max-height:460px' : 'aspect-ratio:16/9') + ';border-radius:14px;overflow:hidden;background:#000">' +
           '<iframe src="' + e + '" style="position:absolute;inset:0;width:100%;height:100%;border:0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>' : '') +
      '<a href="' + safe + '" target="_blank" rel="noopener" style="font-weight:700;color:#7c3aed">▶ Open in a new tab</a></div>';
  }
  function videos() {
    var v = (ACT.video || '').trim(), s = (ACT.short || '').trim();
    if ((!v && !s) || document.getElementById('rru-videos')) return;
    var box = document.createElement('section');
    box.id = 'rru-videos';
    box.style.cssText = 'max-width:920px;margin:18px auto 0;padding:16px 18px;border-radius:22px;border:3px dashed #e9a8cf;' +
      'background:linear-gradient(135deg,#fff1f8,#eef4ff);color:#2b1a14;font:16px/1.5 "Atkinson Hyperlegible",system-ui,sans-serif;box-sizing:border-box';
    box.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">' +
      '<h2 style="margin:0;font:800 1.4rem \'Bricolage Grotesque\',system-ui,sans-serif">🎬 Watch first · Regardez d\'abord</h2>' +
      '<button type="button" id="rru-vtoggle" style="font:inherit;font-weight:700;border:2px solid #e9a8cf;background:#fff;border-radius:999px;padding:4px 12px;cursor:pointer">Hide videos</button></div>' +
      '<div id="rru-vbody" style="display:flex;flex-wrap:wrap;gap:16px;margin-top:10px;align-items:flex-start">' +
      (v ? videoBox(v, '📺 The explanation', false) : '') + (s ? videoBox(s, '⚡ In 60 seconds', true) : '') + '</div>';
    var wrap = document.querySelector('.wrap');
    if (wrap && wrap.parentNode) wrap.parentNode.insertBefore(box, wrap); else document.body.insertBefore(box, document.body.firstChild);
    document.getElementById('rru-vtoggle').onclick = function () {
      var b = document.getElementById('rru-vbody'), hid = b.style.display === 'none';
      b.style.display = hid ? 'flex' : 'none'; this.textContent = hid ? 'Hide videos' : 'Show videos';
    };
  }

  hook();
  videos();
  setTimeout(hook, 0);
  window.addEventListener('load', function () {
    hook();
    queue().forEach(function (r) { send(r, true); }); // results saved offline earlier
  });
})();
