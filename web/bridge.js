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

  hook();
  setTimeout(hook, 0);
  window.addEventListener('load', function () {
    hook();
    queue().forEach(function (r) { send(r, true); }); // results saved offline earlier
  });
})();
