/* Shared engine for the English study pages (Vocabulary, Grammar): editable cards with a hard (repeat) marker,
   a usage marker, search / filter / sort, a weighted "practise hard ones" loop, import / export.
   Data is saved to your account on the server (see store.js). Each page passes a config; see vocabulary.html and grammar.html. */
(function () {
  "use strict";
  var NAV = [["Idioms", "/english.html", "idioms"], ["Vocabulary", "/vocabulary.html", "vocabulary"], ["Grammar", "/grammar.html", "grammar"], ["Irregular verbs", "/irregular-verbs.html", "verbs"], ["Notes", "/english-notes.html", "notes"]];
  var MARK = ["↻", "↻", "↻↻", "↻↻↻"], STAR = ["☆", "★", "★★", "★★★"];
  var HARD_NAME = ["not marked", "hard", "harder", "hardest — repeated most"];

  window.StudyPage = function (cfg) {
    var $ = function (id) { return document.getElementById(id); };
    var norm = function (s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); };
    var uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };
    var fields = cfg.fields, first = fields[0], rest = fields.slice(1);
    var USE_NAME = cfg.useName || ["not rated", "rarely used", "sometimes used", "used a lot"];
    var USE_TIP = cfg.useTip || "How often people use it (my guess)";
    var items = [], filter = "all", playing = false, playToken = 0;
    var review = null;
    items = Store.cached(cfg.key, [], cfg.key);                 // instant first paint from this browser; the account copy loads right after
    if (!Array.isArray(items)) items = [];
    var prune = function (list) { if (!cfg.prune) return list; var k = list.filter(function (i) { return !cfg.prune(i); }); return k.length === list.length ? list : k; };
    items = prune(items);

    /* ---------- page skeleton ---------- */
    var root = $("app");
    root.innerHTML =
      '<div class="wrap">' +
      '<nav class="subnav" aria-label="English pages">' + NAV.map(function (n) { return '<a href="' + n[1] + '"' + (n[2] === cfg.sub ? ' class="on" aria-current="page"' : '') + '>' + n[0] + '</a>'; }).join("") + '</nav>' +
      '<div class="bar">' +
      '<div class="bar-row"><h1>' + cfg.title + ' <small id="count"></small></h1>' +
      '<input type="search" id="q" placeholder="Search…" autocomplete="off" aria-label="Search">' +
      '<span class="chips" role="group" aria-label="Filter"><button class="chip on" data-f="all">All</button><button class="chip" data-f="hard">↻ Hard</button><button class="chip" data-f="common">★ ' + cfg.commonLabel + '</button></span>' +
      '<select id="sort" aria-label="Sort"><option value="added">Order added</option><option value="az">A – Z</option><option value="hard">Hardest first</option><option value="use">' + cfg.useSort + '</option></select>' +
      '<button class="play alt" id="add">+ Add ' + cfg.noun + '</button><button class="play alt" id="imp">Import / export</button></div>' +
      '<div class="bar-row"><button class="play" id="practise">↻ Practise hard ones</button><button class="play stop" id="stop" hidden>■ Stop</button><button class="play alt srs-btn" id="review">Review</button>' +
      '<label class="slider">Say <select id="mode">' + cfg.modes.map(function (m, i) { return '<option value="' + i + '">' + m.label + '</option>'; }).join("") + '</select></label>' +
      '<label class="slider">Speed <input type="range" id="rate" min="0.5" max="1.3" step="0.05" value="0.9"><output id="rateOut">0.9×</output></label>' +
      '<label class="slider">Voice <select id="voice"></select></label><span class="status" id="status"></span>' +
      '<span class="warn" id="warn">No English voice found on this device — playback will use the default voice.</span></div>' +
      '<div class="bar-row"><span class="legend"><b class="h">↻</b> = hard for me (click to raise: weak, weaker, weakest — the weakest are repeated most) &nbsp;·&nbsp; <b class="u">★</b> = ' + cfg.useLegend + ' Click any text to edit it.</span></div>' +
      '</div><div class="list" id="list"></div><div class="empty" id="empty" hidden></div>' +
      '<p class="note">Everything here is saved in this browser only. Use <b>Import / export</b> to back it up or move it.</p></div>' +
      '<dialog id="dlg"><h2>Import / export</h2><p><b>Import:</b> paste ' + cfg.noun + 's, one per line, as <code>' + cfg.importHint + '</code> (a tab, — or - also works as the separator), or paste a JSON backup. Ones you already have are skipped.</p>' +
      '<textarea id="paste" placeholder="' + cfg.importHint.replace(/"/g, "&quot;") + '"></textarea>' +
      '<div class="row"><button class="play alt" id="expJson">Export backup (.json)</button><button class="play alt" id="expCsv">Export CSV</button><button class="play alt" id="close">Close</button><button class="play" id="doImport">Import</button></div>' +
      '<p id="impMsg" style="margin:10px 0 0"></p></dialog>';
    document.title = cfg.title;
    (function () { var sn = document.querySelector(".subnav"); if (!sn) return; var set = function () { document.documentElement.style.setProperty("--subh", sn.offsetHeight + "px"); }; set(); window.addEventListener("resize", set); if (window.ResizeObserver) new ResizeObserver(set).observe(sn); })();

    var save = function () { Store.save(cfg.key, items); };
    function mk(obj, extra) {
      var it = { id: uid(), hard: 0, use: 0, added: Date.now(), orig: null };
      fields.forEach(function (f) { it[f.k] = ""; }); if (cfg.pos) it.pos = "";
      return Object.assign(it, obj || {}, extra || {});
    }
    var allText = function (it) { return fields.map(function (f) { return it[f.k]; }).join(" ") + " " + (it.pos || "") + " " + (it.mynote || ""); };
    var keyText = function (it) { return norm(it[first.k]); };

    /* ---------- list ---------- */
    function visible() {
      var q = norm($("q").value);
      var list = items.filter(function (it) {
        if (filter === "hard" && !it.hard) return false;
        if (filter === "common" && it.use < 2) return false;
        return !q || norm(allText(it)).indexOf(q) >= 0;
      });
      var s = $("sort").value;
      if (s === "az") list.sort(function (a, b) { return String(a[first.k]).localeCompare(String(b[first.k])); });
      else if (s === "hard") list.sort(function (a, b) { return b.hard - a.hard || a.added - b.added; });
      else if (s === "use") list.sort(function (a, b) { return b.use - a.use || a.added - b.added; });
      else list.sort(function (a, b) { return a.added - b.added; });
      return list;
    }
    function grow(t) { t.style.height = "auto"; t.style.height = (t.scrollHeight + 2) + "px"; }
    var growAll = function () { document.querySelectorAll(".card textarea").forEach(grow); };
    function changed(it) { return it.orig && rest.some(function (f) { return (it.orig[f.k] || "") !== (it[f.k] || ""); }); }
    function paint(card, it) {
      for (var i = 1; i <= 3; i++) card.classList.toggle("h" + i, it.hard === i);
      var h = card.querySelector(".mk.hard"), u = card.querySelector(".mk.use");
      h.dataset.l = it.hard; h.textContent = MARK[it.hard]; h.title = "Hard for me: " + HARD_NAME[it.hard] + " — click to change";
      u.dataset.l = it.use; u.textContent = STAR[it.use]; u.title = USE_TIP + ": " + USE_NAME[it.use] + " — click to change";
      var c = changed(it); card.querySelector(".edited").hidden = !c; card.querySelector(".restore").hidden = !c;
      var d = SRS.dueLabel(it), dl = card.querySelector(".due"); dl.textContent = d.text; dl.className = "due " + d.cls; dl.title = "Spaced repetition: when this card is next due for review";
    }
    function build(it) {
      var c = document.createElement("div"); c.className = "card"; c.dataset.id = it.id;
      c.innerHTML = '<div class="top"><input class="idi" aria-label="' + first.label + '" placeholder="' + first.label + '">' +
        (cfg.pos ? '<select class="pos" aria-label="Part of speech"><option value=""></option>' + cfg.pos.map(function (p) { return '<option>' + p + '</option>'; }).join("") + '</select>' : '') +
        '<span class="due"></span><span class="edited" hidden>edited</span><button class="mk hard" type="button"></button><button class="mk use" type="button"></button>' +
        '<button class="ico say" type="button" title="Listen">▶</button>' +
        '<button class="ico restore" type="button" title="Restore the original text" hidden>↺</button>' +
        '<button class="ico del" type="button" title="Delete">✕</button></div>' +
        rest.map(function (f) { return '<div class="field"><label>' + f.label + '</label><textarea class="f-' + f.k + (f.cls ? " " + f.cls : "") + '" data-k="' + f.k + '" rows="1" placeholder="' + (f.ph || "") + '"></textarea></div>'; }).join("") +
        '<div class="field mynote"><label>\uD83D\uDCDD My notes</label><textarea class="f-mynote" data-k="mynote" rows="1" placeholder="Your own note \u2014 a memory trick, where you heard it\u2026"></textarea></div>';
      var idi = c.querySelector(".idi"); idi.value = it[first.k] || "";
      idi.addEventListener("change", function () { it[first.k] = idi.value.trim(); save(); paint(c, it); });
      if (cfg.pos) { var ps = c.querySelector(".pos"); ps.value = it.pos || ""; ps.addEventListener("change", function () { it.pos = ps.value; save(); }); }
      c.querySelectorAll("textarea").forEach(function (ta) {
        ta.value = it[ta.dataset.k] || "";
        ta.addEventListener("input", function () { grow(ta); });
        ta.addEventListener("change", function () { it[ta.dataset.k] = ta.value.trim(); save(); paint(c, it); });
      });
      c.querySelector(".mk.hard").onclick = function () { it.hard = (it.hard + 1) % 4; save(); paint(c, it); counts(); };
      c.querySelector(".mk.use").onclick = function () { it.use = (it.use + 1) % 4; save(); paint(c, it); };
      c.querySelector(".say").onclick = function () { stopPlay(); speakItem(it, parseInt($("mode").value, 10)); };
      c.querySelector(".restore").onclick = function () {
        if (!it.orig) return;
        rest.forEach(function (f) { it[f.k] = it.orig[f.k] || ""; c.querySelector('[data-k="' + f.k + '"]').value = it[f.k]; });
        save(); paint(c, it); growAll();
      };
      c.querySelector(".del").onclick = function () { if (!confirm("Delete “" + (it[first.k] || "this " + cfg.noun) + "”?")) return; items = items.filter(function (x) { return x.id !== it.id; }); save(); render(); };
      paint(c, it);
      return c;
    }
    function counts(shown) {      // header count + whether there is anything marked hard to practise
      var hard = items.filter(function (i) { return i.hard; }).length;
      if (shown == null) shown = document.querySelectorAll(".card").length;
      $("count").textContent = items.length ? shown + (shown !== items.length ? " of " + items.length : "") + (hard ? " \u00B7 " + hard + " marked hard" : "") : "";
      $("practise").disabled = !hard;
      if (review) review.updateBadge();
    }
    function render() {
      var list = visible(), box = $("list"); box.textContent = "";
      list.forEach(function (it) { box.appendChild(build(it)); }); growAll();
      counts(list.length);
      var e = $("empty");
      if (!items.length) {
        e.hidden = false;
        e.innerHTML = '<p style="font-size:1.1rem"><b>Nothing here yet.</b></p><p>Add your own, paste a list, or start from ' + cfg.starter.length + ' common ones.</p>' +
          '<div class="row"><button class="play" id="loadStarter">Load ' + cfg.starter.length + ' common ' + cfg.noun + 's</button><button class="play alt" id="e2">Import a list</button><button class="play alt" id="e3">+ Add ' + cfg.noun + '</button></div>';
        $("loadStarter").onclick = loadStarter; $("e2").onclick = openDlg; $("e3").onclick = addItem;
      } else if (!list.length) { e.hidden = false; e.innerHTML = "<p>Nothing matches. Clear the search or change the filter.</p>"; }
      else e.hidden = true;
    }
    function loadStarter() {
      var have = {}; items.forEach(function (i) { have[keyText(i)] = 1; }); var n = 0;
      cfg.starter.forEach(function (row) {
        var o = {}; cfg.starterKeys.forEach(function (k, i) { o[k] = row[i] || ""; });
        if (have[norm(o[first.k])]) return;
        var orig = {}; rest.forEach(function (f) { orig[f.k] = o[f.k] || ""; });
        items.push(mk(o, { orig: orig, added: Date.now() + n })); n++;
      });
      save(); render();
    }
    function addItem() {
      var it = mk({}, { added: Date.now() }); items.push(it);
      $("q").value = ""; filter = "all"; document.querySelectorAll(".chip").forEach(function (c) { c.classList.toggle("on", c.dataset.f === "all"); });
      $("sort").value = "added"; save(); render();
      var card = document.querySelector('.card[data-id="' + it.id + '"]'); if (card) { card.scrollIntoView({ block: "center" }); card.querySelector(".idi").focus(); }
    }

    /* ---------- speech ---------- */
    var enVoices = [];
    function loadVoices() {
      enVoices = speechSynthesis.getVoices().filter(function (v) { return v.lang.toLowerCase().indexOf("en") === 0; });
      var sel = $("voice"); sel.textContent = "";
      if (!enVoices.length) { $("warn").style.display = "inline"; var o = document.createElement("option"); o.textContent = "Default voice"; sel.appendChild(o); return; }
      $("warn").style.display = "none";
      enVoices.forEach(function (v, i) { var o = document.createElement("option"); o.value = i; o.textContent = v.name + " (" + v.lang + ")"; sel.appendChild(o); });
      var pref = enVoices.findIndex(function (v) { return /en-us/i.test(v.lang); }); if (pref >= 0) sel.value = pref;
    }
    if ("speechSynthesis" in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
    $("rate").addEventListener("input", function () { $("rateOut").textContent = $("rate").value + "×"; });
    function say(text) {
      return new Promise(function (res) {
        if (!("speechSynthesis" in window) || !text) return res();
        var u = new SpeechSynthesisUtterance(text); u.lang = "en-US"; u.rate = parseFloat($("rate").value);
        var v = enVoices[parseInt($("voice").value, 10)]; if (v) u.voice = v;
        u.onend = u.onerror = function () { res(); }; speechSynthesis.speak(u);
      });
    }
    var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    async function speakItem(it, modeIdx, token) {
      var parts = cfg.modes[modeIdx].parts(it).filter(Boolean);
      for (var i = 0; i < parts.length; i++) {
        if (token !== undefined && token !== playToken) return;
        await say(parts[i]); await wait(450);
      }
    }
    function stopPlay() {
      playing = false; playToken++; if ("speechSynthesis" in window) speechSynthesis.cancel();
      $("practise").hidden = false; $("stop").hidden = true; $("status").textContent = "";
      document.querySelectorAll(".card.playing").forEach(function (c) { c.classList.remove("playing"); });
    }
    async function practise() {          // 3 marks = 3 times per round, 2 = twice, 1 = once
      var hard = items.filter(function (i) { return i.hard; }); if (!hard.length) return;
      stopPlay(); playing = true; var my = ++playToken;
      $("practise").hidden = true; $("stop").hidden = false;
      var plan = []; for (var r = 1; r <= 3; r++) hard.filter(function (i) { return i.hard >= r; }).sort(function (a, b) { return b.hard - a.hard; }).forEach(function (i) { plan.push(i); });
      var mode = parseInt($("mode").value, 10);
      while (playing && my === playToken) {
        for (var k = 0; k < plan.length; k++) {
          if (!playing || my !== playToken) return;
          var it = plan[k];
          $("status").textContent = "Practising " + (k + 1) + " of " + plan.length + ": " + it[first.k];
          document.querySelectorAll(".card.playing").forEach(function (c) { c.classList.remove("playing"); });
          var card = document.querySelector('.card[data-id="' + it.id + '"]'); if (card) { card.classList.add("playing"); card.scrollIntoView({ block: "center", behavior: "smooth" }); }
          await speakItem(it, mode, my); if (my !== playToken) return;
          await wait(1200);
        }
      }
    }
    $("practise").onclick = practise; $("stop").onclick = stopPlay;

    /* ---------- import / export ---------- */
    function parseLines(text) {
      var out = [], order = cfg.importOrder;
      text.split(/\r?\n/).forEach(function (raw) {
        var line = raw.replace(/^\s*(?:\d+[.)]|[-•*])\s+/, "").trim(); if (!line) return;
        var parts, i;
        if (line.indexOf("\t") >= 0) parts = line.split("\t");
        else if (line.indexOf(" | ") >= 0) parts = line.split(" | ");
        else if (/\s[—–]\s/.test(line)) parts = line.split(/\s[—–]\s/);
        else if (/\s-\s/.test(line)) parts = line.split(/\s-\s/);
        else if (line.indexOf(": ") >= 0) { i = line.indexOf(": "); parts = [line.slice(0, i), line.slice(i + 2)]; }
        else parts = [line];
        parts = parts.map(function (p) { return p.trim(); });
        var o = {};
        if (cfg.pos && parts.length > 1 && cfg.pos.indexOf(parts[1].toLowerCase().replace(/\.$/, "")) >= 0) { o.pos = parts[1].toLowerCase().replace(/\.$/, ""); parts.splice(1, 1); }
        order.forEach(function (k, n) { o[k] = parts[n] || ""; });
        if (parts.length > order.length) o[order[order.length - 1]] = parts.slice(order.length - 1).join(" - ");
        var ex = (o.meaning || "").match(/^(.*?)\s*(?:examples?|e\.g\.)\s*[:\-]\s*(.*)$/i);
        if (ex && order.indexOf("example") >= 0 && !o.example) { o.meaning = ex[1].replace(/[.;,]\s*$/, ""); o.example = ex[2]; }
        o[first.k] = String(o[first.k] || "").replace(/^["“]|["”]$/g, "");
        if (o[first.k]) out.push(o);
      });
      return out;
    }
    function importText(text) {
      text = text.trim(); if (!text) return { added: 0, skipped: 0 };
      var rows = null; if (text[0] === "[") { try { rows = JSON.parse(text); } catch (e) { rows = null; } }
      if (!Array.isArray(rows)) rows = parseLines(text);
      var have = {}; items.forEach(function (i) { have[keyText(i)] = 1; }); var added = 0, skipped = 0;
      rows.forEach(function (r, n) {
        var name = String(r[first.k] || "").trim(); if (!name || have[norm(name)]) { skipped++; return; }
        have[norm(name)] = 1;
        var o = {}; fields.forEach(function (f) { o[f.k] = r[f.k] || ""; }); if (cfg.pos) o.pos = r.pos || ""; o.mynote = r.mynote || "";
        items.push(mk(o, { hard: Math.max(0, Math.min(3, +r.hard || 0)), use: Math.max(0, Math.min(3, +r.use || 0)), added: Date.now() + n }));
        added++;
      });
      save(); render(); return { added: added, skipped: skipped };
    }
    function openDlg() { $("impMsg").textContent = ""; $("dlg").showModal(); }
    function download(name, type, data) { var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type: type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
    function exportRow(i) { var o = {}; fields.forEach(function (f) { o[f.k] = i[f.k]; }); if (cfg.pos) o.pos = i.pos || ""; o.mynote = i.mynote || ""; o.hard = i.hard; o.use = i.use; return o; }
    $("imp").onclick = openDlg; $("close").onclick = function () { $("dlg").close(); };
    $("doImport").onclick = function () { var r = importText($("paste").value); $("impMsg").textContent = "Added " + r.added + (r.skipped ? ", skipped " + r.skipped + " (already there or empty)" : "") + "."; if (r.added) $("paste").value = ""; };
    $("expJson").onclick = function () { download(cfg.sub + "-" + new Date().toISOString().slice(0, 10) + ".json", "application/json", JSON.stringify(items.map(exportRow), null, 2)); };
    $("expCsv").onclick = function () {
      var q = function (s) { return '"' + String(s == null ? "" : s).replace(/"/g, '""') + '"'; };
      var cols = fields.map(function (f) { return f.k; }).concat(cfg.pos ? ["pos"] : [], ["mynote", "hard", "use"]);
      download(cfg.sub + ".csv", "text/csv", [cols.join(",")].concat(items.map(function (i) { var o = exportRow(i); return cols.map(function (c) { return q(o[c]); }).join(","); })).join("\r\n"));
    };

    /* ---------- controls ---------- */
    $("q").addEventListener("input", render); $("sort").addEventListener("change", render); $("add").onclick = addItem;
    document.querySelectorAll(".chip").forEach(function (c) { c.onclick = function () { filter = c.dataset.f; document.querySelectorAll(".chip").forEach(function (x) { x.classList.toggle("on", x === c); }); render(); }; });
    addEventListener("resize", growAll);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(growAll);
    new MutationObserver(growAll).observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
    render();
    Store.load(cfg.key, [], cfg.key).then(function (v) {          // the copy in your account is the real one
      v = Array.isArray(v) ? v : [];
      var kept = prune(v); if (kept !== v) { v = kept; Store.save(cfg.key, v); }
      if (JSON.stringify(v) !== JSON.stringify(items)) { items = v; render(); }
    });

    /* ---------- spaced-repetition flashcards ---------- */
    review = SRS.attach({
      key: cfg.sub, title: cfg.title, button: $("review"), modes: cfg.review,
      items: function () { return items; }, save: save, refresh: render, say: say,
      speakParts: function (it) { return speakItem(it, 0); }
    });

    /* ---------- text size control (in the top tab bar; shared with the Idioms page) ---------- */
    (function () {
      var KEYF = "en-fontsize", MIN = 80, MAX = 180, STEP = 10, pct = 100;
      try { var v = parseInt(localStorage.getItem(KEYF), 10); if (v >= MIN && v <= MAX) pct = v; } catch (e) {}
      var ctl = document.createElement("span"); ctl.id = "fontctl"; ctl.title = "Text size for the English pages";
      var b = function (t, title, fn) { var x = document.createElement("button"); x.type = "button"; x.textContent = t; x.title = title; x.onclick = fn; ctl.appendChild(x); return x; };
      var dec = b("A−", "Smaller text", function () { set(pct - STEP); }), lab = b("100%", "Reset to 100%", function () { set(100); }), inc = b("A+", "Bigger text", function () { set(pct + STEP); });
      lab.id = "fsPct";
      function set(v) { pct = Math.max(MIN, Math.min(MAX, v)); document.documentElement.style.fontSize = pct + "%"; lab.textContent = pct + "%"; dec.disabled = pct <= MIN; inc.disabled = pct >= MAX; try { localStorage.setItem(KEYF, String(pct)); } catch (e) {} }
      var bar = document.getElementById("modtabs"), build = document.getElementById("modbuild");
      if (bar) bar.insertBefore(ctl, build || null); else { ctl.classList.add("floating"); document.body.appendChild(ctl); }
      set(pct);
    })();
  };
})();
