/* Work timer in the top tab bar: Start / Stop, net time logged per day.
   State lives in this browser (localStorage), so it keeps running when you switch between the
   Goal Setting and French tabs, and across a reload. */
(function () {
  var bar = document.getElementById("modtabs");
  if (!bar || window.__gtnTimer) return;
  window.__gtnTimer = true;

  var KS = "gtn-timer", KL = "gtn-timelog";
  var area = location.pathname.indexOf("french") >= 0 ? "French" : /english|vocabulary|grammar/.test(location.pathname) ? "English" : "Goal Setting";
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function get(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function put(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function clock(ms) { var s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 3600) + ":" + pad(Math.floor(s / 60) % 60) + ":" + pad(s % 60); }
  function ymd(t) { var d = new Date(t); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function dayLabel(day) { var p = day.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2]); return DAYS[d.getDay()] + " " + p[1] + "-" + p[2] + "-" + p[0]; }
  function hm(t) { var d = new Date(t); return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function nextMidnight(t) { var d = new Date(t); d.setHours(24, 0, 0, 0); return d.getTime(); }
  function state() { return get(KS, { running: false }); }
  function log() { return get(KL, []); }

  /* ---- start / stop ---- */
  function start() {
    if (state().running) return;
    put(KS, { running: true, startedAt: Date.now(), area: area });
    refresh();
  }
  function stop() {
    var s = state(); if (!s.running) return;
    var a = s.startedAt, b = Date.now(), entries = log();
    while (ymd(a) !== ymd(b)) {                       // a session that crosses midnight is split, each part on its own day
      var m = nextMidnight(a);
      entries.push(entry(a, m, s.area)); a = m;
    }
    if (b - a >= 1000) entries.push(entry(a, b, s.area));
    put(KL, entries); put(KS, { running: false });
    refresh();
  }
  function entry(a, b, ar) { return { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), day: ymd(a), start: a, end: b, ms: b - a, area: ar || area, note: "" }; }

  /* ---- numbers ---- */
  function runningToday() {                            // the part of a running session that falls on today
    var s = state(); if (!s.running) return 0;
    var startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    return Date.now() - Math.max(s.startedAt, startOfToday.getTime());
  }
  function todayMs() {
    var t = ymd(Date.now()), sum = 0, e = log();
    for (var i = 0; i < e.length; i++) if (e[i].day === t) sum += e[i].ms;
    return sum + runningToday();
  }

  /* ---- the widget ---- */
  var css = document.createElement("style");
  css.textContent =
    "#gtnTimer{display:inline-flex;align-items:center;gap:8px;margin-left:18px;align-self:center;font:600 13px system-ui,-apple-system,'Segoe UI',sans-serif;color:#9fb0d6}" +
    "#gtnTimer .clk{font-variant-numeric:tabular-nums;color:#e8eefc;font-size:15px;min-width:62px;text-align:right}" +
    "#gtnTimer.run .clk{color:#7be0a4}" +
    "#gtnTimer .dot{width:8px;height:8px;border-radius:50%;background:#46526f}" +
    "#gtnTimer.run .dot{background:#35d07f;animation:gtnp 1.2s infinite}@keyframes gtnp{50%{opacity:.35}}" +
    "#gtnTimer button{padding:4px 11px;border:0;border-radius:6px;font:inherit;font-size:12.5px;cursor:pointer}" +
    "#gtnTimer button:disabled{opacity:.3;cursor:default}" +
    "#gtnTimer .bst{background:#1f8f55;color:#fff}#gtnTimer .bsp{background:#c23b3b;color:#fff}#gtnTimer .blg{background:#1b2542;color:#c9d2ea}" +
    "#gtnTimer .blg:hover{background:#27345c;color:#fff}#gtnTimer .tod{font-weight:500;font-size:12px}" +
    "@media (max-width:980px){#gtnTimer .tod{display:none}}" +
    "#gtnPanel{position:fixed;top:44px;left:14px;width:440px;max-width:calc(100vw - 28px);max-height:72vh;overflow:auto;z-index:1001;background:#fff;color:#1c2733;" +
    "border-radius:10px;box-shadow:0 14px 40px rgba(8,22,40,.4);font:14px system-ui,-apple-system,'Segoe UI',sans-serif;display:none}" +
    "#gtnPanel .hd{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid #e4eaf0;position:sticky;top:0;background:#fff}" +
    "#gtnPanel .hd b{font-size:15px;flex:1}#gtnPanel .hd button{border:1px solid #cfd8e3;background:#fff;border-radius:6px;padding:4px 10px;cursor:pointer;font:inherit;font-size:12.5px}" +
    "#gtnPanel .sum{display:flex;gap:18px;padding:10px 14px;background:#f4f7fb;font-size:13px;color:#5b6b7a}#gtnPanel .sum b{display:block;font-size:17px;color:#1c2733;font-variant-numeric:tabular-nums}" +
    "#gtnPanel .day{padding:10px 14px 4px;display:flex;justify-content:space-between;font-weight:700;border-top:1px solid #e4eaf0}" +
    "#gtnPanel .day span:last-child{font-variant-numeric:tabular-nums;color:#1f6fd0}" +
    "#gtnPanel .row{display:flex;align-items:center;gap:8px;padding:3px 14px;font-size:13px}" +
    "#gtnPanel .row .t{color:#5b6b7a;min-width:98px;font-variant-numeric:tabular-nums}#gtnPanel .row .d{min-width:54px;font-variant-numeric:tabular-nums;font-weight:600}" +
    "#gtnPanel .row .a{color:#8a97a6;font-size:12px;min-width:74px}" +
    "#gtnPanel .row input{flex:1;min-width:60px;border:1px solid transparent;border-radius:5px;padding:3px 6px;font:inherit;font-size:13px;background:transparent}" +
    "#gtnPanel .row input:hover,#gtnPanel .row input:focus{border-color:#cfd8e3;background:#fff}" +
    "#gtnPanel .row .x{border:0;background:transparent;color:#a3acb8;cursor:pointer;font-size:14px}#gtnPanel .row .x:hover{color:#c23b3b}" +
    "#gtnPanel .none{padding:18px 14px;color:#8a97a6}@media print{#gtnTimer,#gtnPanel{display:none!important}}";
  document.head.appendChild(css);

  var w = document.createElement("span"); w.id = "gtnTimer";
  w.innerHTML = '<span class="dot"></span><span class="clk" id="gtnClk">0:00:00</span>' +
    '<button class="bst" id="gtnStart" title="Start the timer">&#9654; Start</button>' +
    '<button class="bsp" id="gtnStop" title="Stop and log the time">&#9632; Stop</button>' +
    '<span class="tod" id="gtnTod"></span><button class="blg" id="gtnLog" title="Show the time log">Log</button>';
  bar.insertBefore(w, document.getElementById("modbuild") || null);

  var panel = document.createElement("div"); panel.id = "gtnPanel"; document.body.appendChild(panel);
  var $ = function (id) { return document.getElementById(id); };
  $("gtnStart").onclick = start; $("gtnStop").onclick = stop;
  $("gtnLog").onclick = function () { panel.style.display === "block" ? (panel.style.display = "none") : (renderPanel(), panel.style.display = "block"); };
  document.addEventListener("click", function (e) { if (panel.style.display === "block" && !panel.contains(e.target) && !w.contains(e.target)) panel.style.display = "none"; });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") panel.style.display = "none"; });

  function refresh() {
    var s = state(), run = !!s.running;
    w.classList.toggle("run", run);
    $("gtnClk").textContent = clock(run ? Date.now() - s.startedAt : 0);
    $("gtnStart").disabled = run; $("gtnStop").disabled = !run;
    $("gtnTod").textContent = "Today " + clock(todayMs());
    document.title = (run ? "▶ " + clock(Date.now() - s.startedAt) + " · " : "") + document.title.replace(/^▶ [0-9:]+ · /, "");
    if (panel.style.display === "block" && !panel.contains(document.activeElement)) renderPanel();
  }

  /* ---- the log panel ---- */
  function renderPanel() {
    var e = log().slice().sort(function (a, b) { return b.start - a.start; });
    var byDay = {}, order = [];
    e.forEach(function (x) { if (!byDay[x.day]) { byDay[x.day] = []; order.push(x.day); } byDay[x.day].push(x); });
    var today = ymd(Date.now()), weekAgo = Date.now() - 6 * 864e5, wk = 0;
    e.forEach(function (x) { if (x.start >= new Date(weekAgo).setHours(0, 0, 0, 0)) wk += x.ms; });
    wk += runningToday();
    var h = '<div class="hd"><b>Time log</b><button id="gtnCsv">Export CSV</button><button id="gtnClose">&#10005;</button></div>' +
      '<div class="sum"><span>Today<b>' + clock(todayMs()) + '</b></span><span>Last 7 days<b>' + clock(wk) + '</b></span><span>Days logged<b>' + order.length + '</b></span></div>';
    if (!order.length) h += '<div class="none">Nothing logged yet. Press Start, do your work, then Stop &mdash; the net time is saved here with the date.</div>';
    order.forEach(function (day) {
      var tot = 0; byDay[day].forEach(function (x) { tot += x.ms; }); if (day === today) tot = todayMs();
      h += '<div class="day"><span>' + dayLabel(day) + (day === today ? " · today" : "") + '</span><span>' + clock(tot) + '</span></div>';
      byDay[day].forEach(function (x) {
        h += '<div class="row"><span class="t">' + hm(x.start) + ' – ' + hm(x.end) + '</span><span class="d">' + clock(x.ms) + '</span><span class="a">' + esc(x.area) + '</span>' +
          '<input data-n="' + x.id + '" value="' + esc(x.note || "") + '" placeholder="note…" maxlength="120"><button class="x" data-x="' + x.id + '" title="Delete this entry">&#10005;</button></div>';
      });
    });
    panel.innerHTML = h;
    $("gtnClose").onclick = function () { panel.style.display = "none"; };
    $("gtnCsv").onclick = exportCsv;
    panel.querySelectorAll("[data-n]").forEach(function (i) { i.addEventListener("change", function () {
      var all = log(); all.forEach(function (x) { if (x.id === i.dataset.n) x.note = i.value; }); put(KL, all); }); });
    panel.querySelectorAll("[data-x]").forEach(function (b) { b.onclick = function () {
      if (!confirm("Delete this time entry?")) return;
      put(KL, log().filter(function (x) { return x.id !== b.dataset.x; })); renderPanel(); refresh(); }; });
  }
  function exportCsv() {
    var rows = ["date,start,end,net_seconds,net_time,area,note"];
    log().sort(function (a, b) { return a.start - b.start; }).forEach(function (x) {
      rows.push([x.day, hm(x.start), hm(x.end), Math.round(x.ms / 1000), clock(x.ms), x.area, '"' + String(x.note || "").replace(/"/g, '""') + '"'].join(","));
    });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rows.join("\r\n")], { type: "text/csv" }));
    a.download = "time-log-" + ymd(Date.now()) + ".csv"; panel.appendChild(a); a.click(); a.remove();   // inside the panel, so the outside-click handler leaves it open
  }

  window.addEventListener("storage", function (e) { if (e.key === KS || e.key === KL) refresh(); });   // another tab started/stopped it
  refresh(); setInterval(refresh, 1000);
})();
