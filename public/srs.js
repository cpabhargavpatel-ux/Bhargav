/* Spaced-repetition flashcard review, shared by the Idioms, Vocabulary and Grammar pages.
   You answer a question, rate how it went (Again / Hard / Good / Easy) and the app decides the next due date.
   Cards keep their schedule in item.sr = { due, iv (days), ease, reps, lapses, last }. A card with no item.sr is "new". */
(function () {
  "use strict";
  var DAY = 864e5, MIN = 6e4;
  var STOP = "a an the and or of to in on at is are was were be been it its this that these those for with as by from but not so do does did have has had you your i me my we our they their he she him her".split(" ");

  /* ---------- the scheduler ---------- */
  var HARD_FACTOR = [1, 0.9, 0.75, 0.6];       // cards you marked hard (↻) come back sooner
  function schedule(it, g) {                    // g: 0 Again, 1 Hard, 2 Good, 3 Easy  ->  next state and a label
    var s = it.sr || { ease: 2.5, iv: 0, reps: 0, lapses: 0 };
    var ease = s.ease || 2.5, iv = s.iv || 0, reps = s.reps || 0, lapses = s.lapses || 0;
    if (g === 0) return { ease: Math.max(1.3, ease - 0.2), iv: 0, reps: 0, lapses: lapses + 1, due: Date.now() + 10 * MIN, days: 0 };
    if (g === 1) { iv = Math.max(1, Math.round((iv || 1) * 1.2)); ease = Math.max(1.3, ease - 0.15); }
    else if (g === 2) iv = reps === 0 ? 1 : reps === 1 ? 3 : Math.round(iv * ease);
    else { iv = reps === 0 ? 4 : reps === 1 ? 7 : Math.round(iv * ease * 1.3); ease += 0.15; }
    iv = Math.max(1, Math.round(iv * HARD_FACTOR[it.hard || 0]));
    return { ease: ease, iv: iv, reps: reps + 1, lapses: lapses, due: Date.now() + iv * DAY, days: iv };
  }
  function fmtIv(d) { return d < 1 ? "10 min" : d < 30 ? Math.round(d) + " d" : d < 365 ? Math.round(d / 30) + " mo" : (d / 365).toFixed(1) + " y"; }
  function dueLabel(it) {
    if (!it.sr) return { cls: "new", text: "new" };
    var d = it.sr.due - Date.now();
    if (d <= 0) return { cls: "now", text: "due now" };
    if (d < 36e5) return { cls: "", text: "in " + Math.max(1, Math.round(d / MIN)) + " min" };
    if (d < 20 * 36e5) return { cls: "", text: "in " + Math.round(d / 36e5) + " h" };
    return { cls: "", text: "in " + fmtIv(Math.max(1, Math.round(d / DAY))) };
  }
  function counts(items) {
    var due = 0, fresh = 0, now = Date.now();
    items.forEach(function (it) { if (!it.sr) fresh++; else if (it.sr.due <= now) due++; });
    return { due: due, fresh: fresh };
  }

  /* ---------- helpers ---------- */
  var norm = function (s) { return String(s || "").toLowerCase().replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim(); };
  function words(s) { return norm(s).split(" ").filter(function (w) { return w.length > 2 && STOP.indexOf(w) < 0; }); }
  function suggest(typed, target) {             // 0 Again .. 3 Easy, from how much of the right answer you wrote
    var t = norm(typed), a = norm(target); if (!t) return null;
    if (t === a) return 3;
    var tw = words(typed), aw = words(target); if (!aw.length) return t === a ? 3 : 0;
    var hit = aw.filter(function (w) { return tw.indexOf(w) >= 0 || tw.some(function (x) { return x.length > 4 && (x.indexOf(w.slice(0, 5)) === 0); }); }).length / aw.length;
    return hit >= 0.8 ? 3 : hit >= 0.5 ? 2 : hit >= 0.25 ? 1 : 0;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function blank(example, term) {               // hide the term inside its example sentence (vocabulary)
    if (!example || !term) return null;
    var t = String(term).trim(), stem = t.length > 5 ? t.slice(0, t.length - 2) : t;
    var re = new RegExp("\\b" + stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\w*", "i");
    return re.test(example) ? example.replace(re, "_____") : null;
  }

  var CSS = '.srs-btn{position:relative}.srs-btn b{display:inline-block;min-width:1.4em;margin-left:6px;padding:0 6px;border-radius:999px;background:#C62828;color:#fff;font-size:.8em;line-height:1.5}' +
    '.due{font-size:.72rem;font-weight:700;padding:2px 8px;border-radius:999px;background:#eef1f6;color:#6b6d75;white-space:nowrap}.due.now{background:#fde0de;color:#C62828}.due.new{background:#e3ecff;color:#2240E8}' +
    'dialog.srs{margin:auto;overflow:auto;border:none;border-radius:14px;padding:0;width:min(780px,96vw);max-height:92vh;box-shadow:0 24px 70px rgba(8,22,40,.5);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#17181C}' +
    'dialog.srs::backdrop{background:rgba(8,22,40,.55)}.srs .hd{display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid #e3e2dc}.srs .hd b{font-size:1.05rem;flex:1}' +
    '.srs .x{border:0;background:transparent;font-size:1.1rem;cursor:pointer;color:#6b6d75;padding:4px 8px;border-radius:6px}.srs .x:hover{background:#f0f0ee}' +
    '.srs .bar{height:5px;background:#e8ecfe}.srs .bar i{display:block;height:100%;background:#2240E8;transition:width .25s}' +
    '.srs .body{padding:22px 24px;min-height:300px;display:flex;flex-direction:column;gap:14px}.srs .prompt{font-size:.78rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#6b6d75}' +
    '.srs .q{font-family:"Gentium Book Plus","Charis SIL",Cambria,Georgia,serif;font-size:1.9rem;line-height:1.3;font-weight:700}.srs .q.long{font-size:1.35rem;font-weight:400}' +
    '.srs .pos{font:600 .85rem system-ui;color:#6b6d75;margin-left:8px}.srs textarea{width:100%;min-height:74px;font:inherit;font-size:1.02rem;padding:10px;border:1px solid #cfd3dc;border-radius:8px;resize:vertical}' +
    '.srs .a{background:#f4f7fb;border-radius:10px;padding:14px 16px;font-family:"Gentium Book Plus","Charis SIL",Cambria,Georgia,serif;font-size:1.2rem;line-height:1.45}' +
    '.srs .a .lbl{display:block;font:700 .72rem system-ui;letter-spacing:.05em;text-transform:uppercase;color:#6b6d75;margin-top:8px}.srs .a .lbl:first-child{margin-top:0}.srs .a .ex{font-style:italic}' +
    '.srs .mine{font-size:.92rem;color:#6b6d75;background:#fff8e6;border-radius:8px;padding:8px 12px}.srs .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}' +
    '.srs .grades{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.srs .grades button{font:inherit;padding:10px 4px;border-radius:10px;border:1px solid #d9dce3;background:#fff;cursor:pointer;line-height:1.3}' +
    '.srs .grades button b{display:block}.srs .grades button span{display:block;font-size:.8rem;color:#6b6d75}.srs .grades button:hover{background:#e8ecfe}.srs .grades button.sug{border-color:#2240E8;box-shadow:0 0 0 2px #e8ecfe}' +
    '.srs .grades small{display:block;font-size:.68rem;color:#9aa3b2}.srs button.go{font:inherit;font-weight:600;color:#fff;background:#2240E8;border:0;border-radius:9px;padding:11px 22px;cursor:pointer;font-size:1rem}' +
    '.srs button.go:hover{background:#1B34C4}.srs button.alt{font:inherit;color:#2240E8;background:#fff;border:1px solid #2240E8;border-radius:9px;padding:9px 16px;cursor:pointer}' +
    '.srs .opts{display:grid;grid-template-columns:auto 1fr;gap:10px 14px;align-items:center;font-size:.95rem}.srs .opts select{font:inherit;padding:6px 8px;border:1px solid #cfd3dc;border-radius:8px;background:#fff}' +
    '.srs .big{font-size:2.2rem;font-weight:700;color:#2240E8}.srs .sum{display:flex;gap:18px;flex-wrap:wrap}.srs .sum div{background:#f4f7fb;border-radius:10px;padding:10px 16px;min-width:90px}.srs .sum b{display:block;font-size:1.4rem}' +
    '.srs .foot{padding:10px 24px 16px;color:#9aa3b2;font-size:.8rem}';

  /* ---------- the review window ---------- */
  function attach(o) {   // o: {key, title, items(), save(), refresh(), say(text), speakParts(it), modes[], button, hardKey}
    if (!document.getElementById("srsCss")) { var st = document.createElement("style"); st.id = "srsCss"; st.textContent = CSS; document.head.appendChild(st); }
    var dlg = document.createElement("dialog"); dlg.className = "srs"; document.body.appendChild(dlg);
    var OPT = "srs-opts-" + o.key, opt = { mode: 0, newLimit: 10, typed: false, auto: false, markAgain: true };
    try { Object.assign(opt, JSON.parse(localStorage.getItem(OPT) || "{}")); } catch (e) {}
    var saveOpt = function () { try { localStorage.setItem(OPT, JSON.stringify(opt)); } catch (e) {} };
    var S = null;   // the running session

    function updateBadge() {
      var c = counts(o.items()), n = c.due;
      o.button.innerHTML = 'Review' + (n ? '<b>' + n + '</b>' : "");
      o.button.title = n + " due, " + c.fresh + " new";
    }
    function setup() {
      var c = counts(o.items()), newN = opt.newLimit === 0 ? c.fresh : Math.min(opt.newLimit, c.fresh);
      var h = '<div class="hd"><b>' + esc(o.title) + ' — review</b><button class="x" id="srsX" aria-label="Close">✕</button></div><div class="bar"><i style="width:0"></i></div><div class="body">';
      if (!o.items().length) h += '<p>Nothing to review yet. Add some cards, then come back.</p>';
      else {
        h += '<div class="sum"><div><b>' + c.due + '</b>due now</div><div><b>' + c.fresh + '</b>new</div><div><b>' + (c.due + newN) + '</b>in this session</div></div>' +
          '<div class="opts"><label for="oMode">Question</label><select id="oMode">' + o.modes.map(function (m, i) { return '<option value="' + i + '"' + (i === opt.mode ? " selected" : "") + '>' + esc(m.label) + '</option>'; }).join("") + '<option value="-1"' + (opt.mode === -1 ? " selected" : "") + '>Mix of all</option></select>' +
          '<label for="oNew">New cards per session</label><select id="oNew">' + [5, 10, 20, 0].map(function (n) { return '<option value="' + n + '"' + (n === opt.newLimit ? " selected" : "") + '>' + (n || "all") + '</option>'; }).join("") + '</select>' +
          '<label for="oTyped">Type my answer first</label><input type="checkbox" id="oTyped"' + (opt.typed ? " checked" : "") + '>' +
          '<label for="oAuto">Say the card aloud</label><input type="checkbox" id="oAuto"' + (opt.auto ? " checked" : "") + '>' +
          '<label for="oAgain">Mark “Again” cards as hard ↻</label><input type="checkbox" id="oAgain"' + (opt.markAgain ? " checked" : "") + '></div>' +
          '<div class="row"><button class="go" id="srsStart"' + (c.due + newN ? "" : " disabled") + '>Start</button><span style="color:#6b6d75;font-size:.9rem">' + (c.due + newN ? "" : "Nothing due right now.") + '</span></div>';
      }
      dlg.innerHTML = h + '</div><div class="foot">Space = show answer · 1 Again · 2 Hard · 3 Good · 4 Easy · Esc = close</div>';
      dlg.querySelector("#srsX").onclick = close;
      var go = dlg.querySelector("#srsStart"); if (go) go.onclick = start;
      var bind = function (id, key, num, bool) { var el = dlg.querySelector(id); if (!el) return; el.onchange = function () { opt[key] = bool ? el.checked : parseInt(el.value, 10); saveOpt(); if (key === "newLimit") setup(); }; };
      bind("#oMode", "mode"); bind("#oNew", "newLimit"); bind("#oTyped", "typed", 0, true); bind("#oAuto", "auto", 0, true); bind("#oAgain", "markAgain", 0, true);
    }
    function open() { S = null; setup(); if (!dlg.open) dlg.showModal(); }
    function close() { if (S && S.speaking) o.stopSay && o.stopSay(); S = null; dlg.close(); o.refresh(); updateBadge(); }
    dlg.addEventListener("cancel", function () { S = null; o.refresh(); updateBadge(); });

    function start() {
      var now = Date.now(), all = o.items();
      var due = all.filter(function (it) { return it.sr && it.sr.due <= now; }).sort(function (a, b) { return a.sr.due - b.sr.due || (b.hard || 0) - (a.hard || 0); });
      var fresh = all.filter(function (it) { return !it.sr; }).sort(function (a, b) { return (b.hard || 0) - (a.hard || 0) || (b.use || 0) - (a.use || 0) || a.added - b.added; });
      if (opt.newLimit) fresh = fresh.slice(0, opt.newLimit);
      var queue = due.concat(fresh); if (!queue.length) return;
      S = { queue: queue, total: queue.length, done: 0, res: [0, 0, 0, 0], card: null };
      next();
    }
    function question(it) {   // pick the question for this card
      var usable = o.modes.map(function (m, i) { return { m: m, i: i }; }).filter(function (x) { return !x.m.can || x.m.can(it); });
      if (!usable.length) usable = [{ m: o.modes[0], i: 0 }];
      var pick = opt.mode >= 0 ? usable.filter(function (x) { return x.i === opt.mode; })[0] : null;
      if (!pick) pick = opt.mode === -1 ? usable[Math.floor(Math.random() * usable.length)] : usable[0];
      return pick.m.ask(it);
    }
    function next() {
      if (!S || !S.queue.length) return finish();
      var it = S.queue[0], q = question(it);
      S.card = { it: it, q: q, revealed: false };
      dlg.querySelector(".bar i") && (dlg.querySelector(".bar i").style.width = "0");
      var h = '<div class="hd"><b>' + esc(o.title) + ' — card ' + (S.done + 1) + ' of ' + S.total + '</b><button class="x" id="srsX" aria-label="Close">✕</button></div>' +
        '<div class="bar"><i style="width:' + Math.round(S.done / S.total * 100) + '%"></i></div><div class="body">' +
        '<div class="prompt">' + esc(q.prompt) + '</div><div class="q' + (q.q.length > 60 ? " long" : "") + '">' + esc(q.q) + (q.pos ? '<span class="pos">' + esc(q.pos) + '</span>' : "") + '</div>' +
        '<div class="row"><button class="alt" id="srsSay">▶ Listen</button></div>' +
        (opt.typed ? '<textarea id="srsTyped" placeholder="Type your answer…" aria-label="Your answer"></textarea>' : "") +
        '<div class="row"><button class="go" id="srsShow">Show answer</button></div><div id="srsBack"></div></div>' +
        '<div class="foot">Space = show answer · 1 Again · 2 Hard · 3 Good · 4 Easy · Esc = close</div>';
      dlg.innerHTML = h;
      dlg.querySelector("#srsX").onclick = close;
      dlg.querySelector("#srsShow").onclick = reveal;
      dlg.querySelector("#srsSay").onclick = function () { o.say(q.spoken || q.q); };
      var ta = dlg.querySelector("#srsTyped"); if (ta) ta.focus(); else dlg.querySelector("#srsShow").focus();
      if (opt.auto) o.say(q.spoken || q.q);
    }
    function reveal() {
      if (!S || !S.card || S.card.revealed) return;
      var c = S.card, it = c.it, q = c.q; c.revealed = true;
      var typed = (dlg.querySelector("#srsTyped") || {}).value || "";
      var sug = typed.trim() && q.target ? suggest(typed, q.target) : null;
      if (it.mynote) q.a = q.a.concat([["My notes", it.mynote]]);
      q.a = q.a.filter(function (p) { return p[1]; });
      var back = '<div class="a">' + q.a.map(function (p) { return '<span class="lbl">' + esc(p[0]) + '</span><span' + (p[0] === "Example" ? ' class="ex"' : "") + '>' + esc(p[1]) + '</span>'; }).join("") + '</div>' +
        (typed.trim() ? '<div class="mine"><b>You wrote:</b> ' + esc(typed) + '</div>' : "") +
        '<div class="row"><button class="alt" id="srsSay2">▶ Listen</button><span style="color:#6b6d75;font-size:.9rem">How well did you know it?</span></div>' +
        '<div class="grades">' + ["Again", "Hard", "Good", "Easy"].map(function (n, g) {
          return '<button data-g="' + g + '"' + (sug === g ? ' class="sug"' : "") + '><b>' + n + '</b><span>' + fmtIv(schedule(it, g).days) + '</span><small>key ' + (g + 1) + '</small></button>';
        }).join("") + '</div>';
      dlg.querySelector("#srsBack").innerHTML = back; dlg.querySelector("#srsShow").parentNode.style.display = "none";
      var ta = dlg.querySelector("#srsTyped"); if (ta) ta.readOnly = true;
      dlg.querySelector("#srsSay2").onclick = function () { (o.speakParts ? o.speakParts(it) : Promise.resolve()); };
      dlg.querySelectorAll(".grades button").forEach(function (b) { b.onclick = function () { grade(+b.dataset.g); }; });
      if (opt.auto && o.speakParts) o.speakParts(it);
    }
    function grade(g) {
      if (!S || !S.card || !S.card.revealed) return;
      var it = S.card.it, s = schedule(it, g);
      it.sr = { due: s.due, iv: s.iv, ease: s.ease, reps: s.reps, lapses: s.lapses, last: Date.now() };
      if (g === 0 && opt.markAgain && !(it.hard >= 1)) it.hard = 1;
      S.res[g]++; S.queue.shift(); S.done++;
      if (g === 0) { S.queue.push(it); S.total++; }       // "Again": once more at the end of this session
      o.save(); S.card = null; next();
    }
    function finish() {
      var r = S ? S.res : [0, 0, 0, 0], total = r[0] + r[1] + r[2] + r[3];
      var upcoming = o.items().filter(function (it) { return it.sr; }).sort(function (a, b) { return a.sr.due - b.sr.due; })[0];
      var h = '<div class="hd"><b>' + esc(o.title) + ' — review</b><button class="x" id="srsX" aria-label="Close">✕</button></div><div class="bar"><i style="width:100%"></i></div><div class="body">' +
        '<div class="big">Done — ' + total + ' answer' + (total === 1 ? "" : "s") + '</div><div class="sum"><div><b>' + r[0] + '</b>Again</div><div><b>' + r[1] + '</b>Hard</div><div><b>' + r[2] + '</b>Good</div><div><b>' + r[3] + '</b>Easy</div></div>' +
        '<p style="color:#6b6d75">' + (upcoming ? "Next card due " + dueLabel(upcoming).text + "." : "") + '</p><div class="row"><button class="go" id="srsAgain">Review more</button><button class="alt" id="srsDone">Close</button></div></div>';
      dlg.innerHTML = h; S = null; o.save(); o.refresh(); updateBadge();
      dlg.querySelector("#srsX").onclick = close; dlg.querySelector("#srsDone").onclick = close; dlg.querySelector("#srsAgain").onclick = setup;
    }
    document.addEventListener("keydown", function (e) {      // on the document, so the keys still work after the focused button is hidden
      if (!dlg.open || !S || !S.card) return;
      var typing = e.target && e.target.tagName === "TEXTAREA";
      if (!S.card.revealed) { if (e.key === " " && !typing || (e.key === "Enter" && (e.ctrlKey || e.metaKey || !typing))) { e.preventDefault(); reveal(); } return; }
      if (/^[1-4]$/.test(e.key) && !typing) { e.preventDefault(); grade(+e.key - 1); }
    });
    o.button.onclick = open; updateBadge();
    return { updateBadge: updateBadge, open: open };
  }

  window.SRS = { attach: attach, dueLabel: dueLabel, counts: counts, schedule: schedule, blank: blank, suggest: suggest };
})();
