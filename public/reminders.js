/* Daily reminders. A bell in the top bar shows how many are waiting today; the list also opens by itself
   when you open the app (once per browser tab session). Everything is saved to your account via store.js.
   Data: Store key "reminders" = { showOnOpen: true, items: [ { id, text, repeat, days, date, star, done: {"YYYY-MM-DD": 1}, added } ] }
   repeat: "daily" | "weekdays" | "weekly" (days = [0-6], Sun = 0) | "once" (date = "YYYY-MM-DD") */
(function () {
  "use strict";
  var bar = document.getElementById("modtabs");
  if (!bar || window.__gtnReminders || !window.Store) return;
  window.__gtnReminders = true;

  var KEY = "reminders", SEEN = "gtn-rem-seen";
  var DAYN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MONTHN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  var ymd = function (d) { d = d || new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  var parse = function (s) { var p = String(s).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
  var fresh = function () { return { showOnOpen: true, items: [] }; };
  function fix(d) { if (!d || typeof d !== "object" || !Array.isArray(d.items)) return fresh(); if (d.showOnOpen == null) d.showOnOpen = true; return d; }

  var data = fix(Store.cached(KEY, null));
  var view = "today", editing = null, loaded = false;
  function save() { Store.save(KEY, data); }

  /* ---------- which reminders are due on a day ---------- */
  function isDone(it, day) { return !!(it.done && it.done[day]); }
  function dueOn(it, day) {                       // is it on the list for this day (done or not)?
    var wd = parse(day).getDay();
    if (it.repeat === "daily") return true;
    if (it.repeat === "weekdays") return wd >= 1 && wd <= 5;
    if (it.repeat === "weekly") return (it.days || []).indexOf(wd) >= 0;
    var d = it.date || ""; if (!d) return true;
    return d === day || (d < day && !(it.done && Object.keys(it.done).length));   // a one-off that was missed stays until you tick it
  }
  function overdue(it, day) { return it.repeat === "once" && it.date && it.date < day && !isDone(it, day) && !(it.done && Object.keys(it.done).length); }
  function todays(day) {
    var list = data.items.filter(function (it) { return dueOn(it, day); });
    return list.sort(function (a, b) { return (isDone(a, day) ? 1 : 0) - (isDone(b, day) ? 1 : 0) || (b.star ? 1 : 0) - (a.star ? 1 : 0) || a.added - b.added; });
  }
  var pending = function (day) { return todays(day).filter(function (it) { return !isDone(it, day); }); };
  function repeatLabel(it) {
    if (it.repeat === "daily") return "Every day";
    if (it.repeat === "weekdays") return "Mon – Fri";
    if (it.repeat === "weekly") return (it.days || []).slice().sort().map(function (d) { return DAYN[d]; }).join(", ") || "Weekly (no days chosen)";
    if (!it.date) return "Once";
    var p = parse(it.date); return "Once · " + DAYN[p.getDay()] + " " + p.getDate() + " " + MONTHN[p.getMonth()];
  }
  function prune() {                              // keep the "done" history to the last 60 days
    var cut = ymd(new Date(Date.now() - 60 * 864e5));
    data.items.forEach(function (it) { if (it.repeat !== "once" && it.done) Object.keys(it.done).forEach(function (k) { if (k < cut) delete it.done[k]; }); });
  }

  /* ---------- styles ---------- */
  var css = document.createElement("style");
  css.textContent =
    "#gtnBell{align-self:center;margin-left:10px;display:inline-flex;align-items:center;gap:6px;background:#2a3a66;color:#fff;border:0;border-radius:8px;padding:4px 10px;font:600 12px system-ui,sans-serif;cursor:pointer}" +
    "#gtnBell:hover{background:#3a4d86}#gtnBell b{background:#e0662b;color:#fff;border-radius:999px;padding:0 7px;font-size:11px;line-height:17px}" +
    "#gtnBell.none b{display:none}#gtnBell.ring{animation:gtnring .9s ease 2}" +
    "@keyframes gtnring{0%,100%{transform:rotate(0)}20%{transform:rotate(-14deg)}40%{transform:rotate(12deg)}60%{transform:rotate(-8deg)}80%{transform:rotate(5deg)}}" +
    "@media (prefers-reduced-motion:reduce){#gtnBell.ring{animation:none}}" +
    "dialog.gtnrem{--bg:#fff;--ink:#16202e;--mute:#667085;--line:#e1e6ee;--soft:#f3f6fb;--acc:#2540d9;--accink:#fff;--star:#c4570f;--ok:#1b8a4f;" +
    "border:0;border-radius:16px;padding:0;width:min(560px,94vw);max-height:88vh;margin:auto;background:var(--bg);color:var(--ink);box-shadow:0 24px 70px rgba(10,20,40,.45);font:400 15px/1.45 system-ui,-apple-system,'Segoe UI',sans-serif;overflow:hidden}" +
    "@media (prefers-color-scheme:dark){dialog.gtnrem{--bg:#18202f;--ink:#e8edf7;--mute:#9aa7bf;--line:#2b3750;--soft:#202b3f;--acc:#7f95ff;--accink:#0d1330;--star:#ffab70;--ok:#5fd394}}" +
    "dialog.gtnrem::backdrop{background:rgba(8,14,30,.55)}" +
    ".gtnrem .rh{display:flex;align-items:flex-start;gap:10px;padding:18px 20px 12px}.gtnrem .rh h2{margin:0;font-size:1.25rem;line-height:1.2}.gtnrem .rh p{margin:2px 0 0;color:var(--mute);font-size:.9rem}" +
    ".gtnrem .rh .x{margin-left:auto;background:none;border:0;font-size:1.2rem;color:var(--mute);cursor:pointer;border-radius:8px;width:34px;height:34px}.gtnrem .rh .x:hover{background:var(--soft)}" +
    ".gtnrem .tabs{display:flex;gap:6px;padding:0 20px 10px}.gtnrem .tabs button{border:1px solid var(--line);background:transparent;color:var(--ink);border-radius:999px;padding:4px 14px;font:600 .85rem system-ui,sans-serif;cursor:pointer}" +
    ".gtnrem .tabs button.on{background:var(--acc);color:var(--accink);border-color:var(--acc)}" +
    ".gtnrem .body{padding:0 20px;overflow:auto;max-height:46vh}" +
    ".gtnrem ul{list-style:none;margin:0;padding:0}.gtnrem li.r{display:flex;align-items:flex-start;gap:12px;padding:10px 4px;border-top:1px solid var(--line)}.gtnrem li.r:first-child{border-top:0}" +
    ".gtnrem .ck{flex:none;width:26px;height:26px;border-radius:8px;border:2px solid var(--mute);background:transparent;cursor:pointer;display:grid;place-items:center;color:transparent;font-size:15px;margin-top:1px}" +
    ".gtnrem .ck:hover{border-color:var(--ok)}.gtnrem li.done .ck{background:var(--ok);border-color:var(--ok);color:#fff}" +
    ".gtnrem .tx{flex:1;min-width:0;font-size:1.02rem;overflow-wrap:anywhere}.gtnrem li.done .tx{text-decoration:line-through;color:var(--mute)}" +
    ".gtnrem .tx small{display:block;color:var(--mute);font-size:.78rem;text-decoration:none}.gtnrem .tx small.od{color:var(--star);font-weight:700}" +
    ".gtnrem .st{color:var(--star);margin-right:4px}" +
    ".gtnrem .empty{padding:22px 4px;color:var(--mute);text-align:center}" +
    ".gtnrem .add{padding:12px 20px 4px;border-top:1px solid var(--line);margin-top:10px;background:var(--soft)}" +
    ".gtnrem .add .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px}" +
    ".gtnrem input[type=text],.gtnrem input[type=date],.gtnrem select{font:inherit;color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:7px 9px;min-width:0}" +
    ".gtnrem input[type=text]{flex:1 1 220px}.gtnrem input:focus-visible,.gtnrem select:focus-visible,.gtnrem button:focus-visible{outline:2px solid var(--acc);outline-offset:1px}" +
    ".gtnrem .days{display:inline-flex;gap:4px;flex-wrap:wrap}.gtnrem .days label{border:1px solid var(--line);border-radius:6px;padding:2px 8px;cursor:pointer;font-size:.82rem;background:var(--bg)}.gtnrem .days input{display:none}.gtnrem .days input:checked+span{font-weight:800;color:var(--acc)}" +
    ".gtnrem .days label:has(input:checked){border-color:var(--acc);background:var(--soft)}" +
    ".gtnrem .b{border:1px solid var(--acc);background:var(--acc);color:var(--accink);border-radius:8px;padding:7px 14px;font:600 .9rem system-ui,sans-serif;cursor:pointer}.gtnrem .b.alt{background:transparent;color:var(--acc)}" +
    ".gtnrem .ft{display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:10px 20px 14px;background:var(--soft);color:var(--mute);font-size:.85rem}.gtnrem .ft label{display:flex;gap:6px;align-items:center;cursor:pointer}.gtnrem .ft .b{margin-left:auto}" +
    ".gtnrem .ico{background:none;border:1px solid var(--line);color:var(--mute);border-radius:8px;width:30px;height:30px;cursor:pointer;font-size:.95rem;flex:none}.gtnrem .ico:hover{border-color:var(--acc);color:var(--acc)}.gtnrem .ico.on{color:var(--star);border-color:var(--star)}" +
    ".gtnrem li.ed{display:block}.gtnrem li.ed .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:6px 0}";
  document.head.appendChild(css);

  /* ---------- the bell ---------- */
  var bell = document.createElement("button");
  bell.id = "gtnBell"; bell.type = "button"; bell.innerHTML = '🔔 Reminders <b id="gtnBellN">0</b>';
  bell.title = "Today's reminders";
  bar.insertBefore(bell, document.getElementById("gtnTimer") || document.getElementById("modbuild") || null);

  var dlg = document.createElement("dialog"); dlg.className = "gtnrem"; dlg.setAttribute("aria-label", "Reminders"); document.body.appendChild(dlg);

  function paintBell() {
    var n = pending(ymd()).length, b = document.getElementById("gtnBellN");
    b.textContent = n; bell.classList.toggle("none", n === 0);
    bell.title = n ? n + " reminder" + (n === 1 ? "" : "s") + " left for today" : "Today's reminders";
  }

  /* ---------- the dialog ---------- */
  function head(day) {
    var d = parse(day), left = pending(day).length, all = todays(day).length;
    var sub = !all ? "Nothing on your list for today." : left ? left + " of " + all + " still to do" : "All " + all + " done — well done!";
    return '<div class="rh"><div><h2>🔔 ' + DAYN[d.getDay()] + " " + d.getDate() + " " + MONTHN[d.getMonth()] + " " + d.getFullYear() + "</h2><p>" + sub +
      '</p></div><button class="x" id="rmX" aria-label="Close">✕</button></div>' +
      '<div class="tabs"><button data-v="today" class="' + (view === "today" ? "on" : "") + '">Today</button><button data-v="all" class="' + (view === "all" ? "on" : "") + '">All reminders (' + data.items.length + ")</button></div>";
  }
  function addForm() {
    return '<div class="add"><div class="row"><input type="text" id="rmText" maxlength="300" placeholder="Add a reminder…" aria-label="New reminder">' +
      '<select id="rmRep" aria-label="Repeat"><option value="once-today">Today only</option><option value="daily">Every day</option><option value="weekdays">Mon – Fri</option><option value="weekly">Certain days…</option><option value="once-date">On a date…</option></select></div>' +
      '<div class="row" id="rmExtra" hidden></div>' +
      '<div class="row"><label><input type="checkbox" id="rmStar"> ★ Important</label><button class="b" id="rmAdd" style="margin-left:auto">Add</button></div></div>';
  }
  function daysPicker(sel, name) {
    return '<span class="days" role="group" aria-label="Days">' + [1, 2, 3, 4, 5, 6, 0].map(function (d) {
      return '<label><input type="checkbox" name="' + name + '" value="' + d + '"' + (sel.indexOf(d) >= 0 ? " checked" : "") + "><span>" + DAYN[d] + "</span></label>";
    }).join("") + "</span>";
  }
  function todayList(day) {
    var list = todays(day);
    if (!list.length) return '<div class="empty">No reminders for today. Add one below — choose <b>Every day</b> to see it every time you open the app.</div>';
    return "<ul>" + list.map(function (it) {
      var d = isDone(it, day);
      return '<li class="r ' + (d ? "done" : "") + '" data-id="' + it.id + '"><button class="ck" data-a="done" role="checkbox" aria-checked="' + d + '" aria-label="Done: ' + esc(it.text) + '">✓</button>' +
        '<div class="tx">' + (it.star ? '<span class="st" title="Important">★</span>' : "") + esc(it.text) +
        (overdue(it, day) ? '<small class="od">Overdue — was for ' + esc(it.date) + "</small>" : it.repeat === "once" ? "" : "<small>" + esc(repeatLabel(it)) + "</small>") + "</div></li>";
    }).join("") + "</ul>";
  }
  function allList() {
    if (!data.items.length) return '<div class="empty">No reminders yet.</div>';
    return "<ul>" + data.items.slice().sort(function (a, b) { return a.added - b.added; }).map(function (it) {
      if (editing === it.id) {
        return '<li class="r ed" data-id="' + it.id + '"><div class="row"><input type="text" data-k="text" value="' + esc(it.text) + '" aria-label="Reminder text"></div>' +
          '<div class="row"><select data-k="repeat" aria-label="Repeat"><option value="daily">Every day</option><option value="weekdays">Mon – Fri</option><option value="weekly">Certain days</option><option value="once">On a date</option></select>' +
          (it.repeat === "weekly" ? daysPicker(it.days || [], "ed") : "") + (it.repeat === "once" ? '<input type="date" data-k="date" value="' + esc(it.date || ymd()) + '" aria-label="Date">' : "") + "</div>" +
          '<div class="row"><button class="b" data-a="saveEd">Done</button></div></li>';
      }
      return '<li class="r" data-id="' + it.id + '"><div class="tx">' + (it.star ? '<span class="st">★</span>' : "") + esc(it.text) + "<small>" + esc(repeatLabel(it)) + "</small></div>" +
        '<button class="ico' + (it.star ? " on" : "") + '" data-a="star" title="Important" aria-label="Toggle important">★</button>' +
        '<button class="ico" data-a="edit" title="Edit" aria-label="Edit">✎</button><button class="ico" data-a="del" title="Delete" aria-label="Delete">✕</button></li>';
    }).join("") + "</ul>";
  }
  function paint() {
    var day = ymd(), keep = dlg.querySelector("#rmText") ? { t: dlg.querySelector("#rmText").value, r: dlg.querySelector("#rmRep").value, s: dlg.querySelector("#rmStar").checked } : null;
    dlg.innerHTML = head(day) + '<div class="body">' + (view === "today" ? todayList(day) : allList()) + "</div>" + addForm() +
      '<div class="ft"><label><input type="checkbox" id="rmOpen"' + (data.showOnOpen ? " checked" : "") + '> Show this when I open the app</label><button class="b alt" id="rmClose">Close</button></div>';
    dlg.querySelectorAll("li.ed select[data-k=repeat]").forEach(function (s) { s.value = (data.items.filter(function (x) { return x.id === editing; })[0] || {}).repeat; });
    if (keep) { dlg.querySelector("#rmText").value = keep.t; dlg.querySelector("#rmRep").value = keep.r; dlg.querySelector("#rmStar").checked = keep.s; extra(); }
    paintBell();
  }
  function extra() {
    var r = dlg.querySelector("#rmRep").value, e = dlg.querySelector("#rmExtra");
    e.hidden = !(r === "weekly" || r === "once-date");
    e.innerHTML = r === "weekly" ? daysPicker([], "new") : r === "once-date" ? '<input type="date" id="rmDate" value="' + ymd() + '" aria-label="Date">' : "";
  }
  function addNew() {
    var t = dlg.querySelector("#rmText"), text = t.value.trim(); if (!text) { t.focus(); return; }
    var r = dlg.querySelector("#rmRep").value, it = { id: uid(), text: text, repeat: "daily", days: [], date: "", star: dlg.querySelector("#rmStar").checked, done: {}, added: Date.now() };
    if (r === "once-today") { it.repeat = "once"; it.date = ymd(); }
    else if (r === "once-date") { it.repeat = "once"; it.date = (dlg.querySelector("#rmDate") || {}).value || ymd(); }
    else if (r === "weekly") {
      it.repeat = "weekly"; it.days = [].slice.call(dlg.querySelectorAll('input[name=new]:checked')).map(function (c) { return +c.value; });
      if (!it.days.length) { dlg.querySelector("#rmExtra").insertAdjacentHTML("beforeend", '<span style="color:var(--star)">Pick at least one day.</span>'); return; }
    } else it.repeat = r;
    data.items.push(it); save(); t.value = ""; dlg.querySelector("#rmStar").checked = false; paint(); dlg.querySelector("#rmText").focus();
  }
  function find(id) { return data.items.filter(function (x) { return x.id === id; })[0]; }

  dlg.addEventListener("click", function (e) {
    var t = e.target;
    if (t.id === "rmX" || t.id === "rmClose") { dlg.close(); return; }
    if (t.id === "rmAdd") { addNew(); return; }
    var v = t.closest && t.closest(".tabs button"); if (v) { view = v.dataset.v; editing = null; paint(); return; }
    var b = t.closest && t.closest("[data-a]"); if (!b) return;
    var li = b.closest("li"), it = li && find(li.dataset.id); if (!it) return;
    var a = b.dataset.a;
    if (a === "done") { it.done = it.done || {}; var d = ymd(); if (it.done[d]) delete it.done[d]; else it.done[d] = 1; save(); paint(); }
    else if (a === "star") { it.star = !it.star; save(); paint(); }
    else if (a === "edit") { editing = it.id; paint(); var f = dlg.querySelector("li.ed input[data-k=text]"); if (f) f.focus(); }
    else if (a === "saveEd") { editing = null; save(); paint(); }
    else if (a === "del") { if (confirm("Delete “" + it.text + "”?")) { data.items = data.items.filter(function (x) { return x !== it; }); save(); paint(); } }
  });
  dlg.addEventListener("input", function (e) {
    var t = e.target, li = t.closest && t.closest("li.ed"); if (!li) return;
    var it = find(li.dataset.id); if (!it) return;
    if (t.dataset.k === "text") it.text = t.value; else if (t.dataset.k === "date") it.date = t.value;
    else if (t.name === "ed") it.days = [].slice.call(li.querySelectorAll("input[name=ed]:checked")).map(function (c) { return +c.value; });
    save();
  });
  dlg.addEventListener("change", function (e) {
    var t = e.target;
    if (t.id === "rmRep") { extra(); return; }
    if (t.id === "rmOpen") { data.showOnOpen = t.checked; save(); return; }
    var li = t.closest && t.closest("li.ed"); if (!li || t.dataset.k !== "repeat") return;
    var it = find(li.dataset.id); it.repeat = t.value; if (it.repeat === "once" && !it.date) it.date = ymd(); if (it.repeat === "weekly" && !(it.days || []).length) it.days = [1, 2, 3, 4, 5]; save(); paint();
  });
  dlg.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target.id === "rmText") { e.preventDefault(); addNew(); } });
  dlg.addEventListener("close", function () { editing = null; paintBell(); });
  dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });   // click on the backdrop

  function open(v) { if (v) view = v; paint(); if (!dlg.open) dlg.showModal(); }
  bell.onclick = function () { open("today"); };

  /* ---------- on page open ---------- */
  function seen() { try { return sessionStorage.getItem(SEEN) === ymd(); } catch (e) { return false; } }
  function markSeen() { try { sessionStorage.setItem(SEEN, ymd()); } catch (e) {} }
  function maybeShow() {
    if (seen() || !data.showOnOpen) return;
    if (!pending(ymd()).length) return;
    markSeen(); open("today");
  }
  paintBell();
  Store.load(KEY, null).then(function (v) {
    var server = fix(v); loaded = true;
    if (v == null) { if (data.items.length) save(); } else data = server;
    prune(); paintBell();
    if (dlg.open) paint();
    maybeShow();
    if (pending(ymd()).length) { bell.classList.add("ring"); setTimeout(function () { bell.classList.remove("ring"); }, 2000); }
  });
  /* the day changes while the app stays open */
  var lastDay = ymd();
  setInterval(function () { if (ymd() !== lastDay) { lastDay = ymd(); paintBell(); if (dlg.open) paint(); else { try { sessionStorage.removeItem(SEEN); } catch (e) {} maybeShow(); } } }, 60000);

  window.GTNReminders = { open: open, dueOn: dueOn, todays: todays, _data: function () { return data; } };
})();
