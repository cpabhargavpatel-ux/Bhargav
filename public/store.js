/* Saves the French / English / timer data to YOUR account on the server (the same database as Goal Setting),
   with a copy in this browser as a safety net while you are offline.
   Store.load(key, default, legacyLocalStorageKey)  -> Promise of the saved value
   Store.save(key, value)                          -> saved to the server shortly after (and kept locally right away)
   Store.putBlob / getBlob / delBlob               -> recordings                                                       */
(function () {
  "use strict";
  if (window.Store) return;
  var PREFIX = "gtn-store:", timers = {}, retry = {}, state = { pending: {}, blobs: 0, offline: false, signedOut: false, used: false };

  function readLocal(k) { try { return JSON.parse(localStorage.getItem(PREFIX + k)); } catch (e) { return null; } }
  function writeLocal(k, o) { try { localStorage.setItem(PREFIX + k, JSON.stringify(o)); } catch (e) {} }
  function readLegacy(k) { try { var raw = localStorage.getItem(k); return raw == null ? null : JSON.parse(raw); } catch (e) { return null; } }
  function api(path, opt) {
    opt = opt || {}; opt.credentials = "same-origin";
    opt.headers = Object.assign({ "x-gtn": "1" }, opt.headers || {});
    return fetch(path, opt);
  }

  /* ---------- the little status text in the top bar ---------- */
  function indicator() {
    var el = document.getElementById("storeStat");
    if (!el) {
      var bar = document.getElementById("modtabs"); if (!bar) return null;
      el = document.createElement("span"); el.id = "storeStat";
      el.style.cssText = "align-self:center;margin-left:12px;font:500 11px system-ui,sans-serif;color:#7f8fb8;white-space:nowrap";
      bar.insertBefore(el, document.getElementById("modbuild") || null);
    }
    return el;
  }
  function paint() {
    var el = indicator(); if (!el || !state.used) return;
    if (state.signedOut) { el.innerHTML = '⚠ <a href="/login.html?next=' + encodeURIComponent(location.pathname) + '" style="color:#ffd28a">sign in again</a> to save'; return; }
    if (state.offline) { el.textContent = "⚠ offline — saved on this device, will sync"; el.style.color = "#ffd28a"; return; }
    el.style.color = "#7f8fb8";
    el.textContent = (Object.keys(state.pending).length + state.blobs) > 0 ? "\u2601 saving\u2026" : "\u2601 saved to your account";
  }

  /* ---------- JSON values ---------- */
  async function load(key, def, legacy) {
    state.used = true;
    var local = null, server = null, reachable = true, authed = true;
    try {
      var r = await api("/api/kv/" + encodeURIComponent(key));
      if (r.status === 401) authed = false; else if (r.ok) server = await r.json(); else reachable = false;
    } catch (e) { reachable = false; }
    local = readLocal(key);                                                     // read AFTER the request, so edits made while it ran are not lost
    state.offline = !reachable; state.signedOut = !authed;
    var value, push = false;
    if (server && server.v != null) {
      if (local && local.dirty) { value = local.v; push = true; }               // edits that never reached the server win
      else { value = server.v; writeLocal(key, { v: value, dirty: false, n: 0 }); }
    } else if (reachable && authed) {                                           // nothing on the server yet: upload what this browser has
      var old = (local && local.v != null) ? local.v : (legacy ? readLegacy(legacy) : null);
      if (old != null) { value = old; push = true; } else value = def;
    } else {                                                                    // offline or signed out: use the local copy
      value = (local && local.v != null) ? local.v : (legacy && readLegacy(legacy) != null ? readLegacy(legacy) : def);
    }
    if (push) save(key, value); else paint();
    return value;
  }
  function cached(key, def, legacy) {                                          // instant, no network (for first paint)
    var l = readLocal(key); if (l && l.v != null) return l.v;
    var o = legacy ? readLegacy(legacy) : null; return o != null ? o : def;
  }
  function save(key, value) {
    state.used = true;
    var prev = readLocal(key); writeLocal(key, { v: value, dirty: true, n: ((prev && prev.n) || 0) + 1 });
    state.pending[key] = 1; paint();
    clearTimeout(timers[key]); timers[key] = setTimeout(function () { flush(key); }, 500);
  }
  async function flush(key) {
    var l = readLocal(key); if (!l || !l.dirty) { delete state.pending[key]; paint(); return; }
    var n = l.n;
    try {
      var r = await api("/api/kv/" + encodeURIComponent(key), { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ v: l.v }) });
      if (r.status === 401) { state.signedOut = true; delete state.pending[key]; paint(); return; }
      if (!r.ok) throw new Error("HTTP " + r.status);
      var now = readLocal(key); if (now && now.n === n) { writeLocal(key, { v: now.v, dirty: false, n: n }); delete state.pending[key]; }
      else flush(key);                                                          // changed while saving: send the newer version
      state.offline = false; state.signedOut = false; paint();
    } catch (e) { state.offline = true; paint(); clearTimeout(retry[key]); retry[key] = setTimeout(function () { flush(key); }, 15000); }
  }
  window.addEventListener("online", function () { Object.keys(state.pending).forEach(function (k) { flush(k); }); });
  document.addEventListener("visibilitychange", function () {                  // leaving the page: push anything still waiting
    if (document.visibilityState !== "hidden") return;
    Object.keys(timers).forEach(function (k) { var l = readLocal(k); if (l && l.dirty) { clearTimeout(timers[k]); try { fetch("/api/kv/" + encodeURIComponent(k), { method: "PUT", keepalive: true, credentials: "same-origin", headers: { "x-gtn": "1", "content-type": "application/json" }, body: JSON.stringify({ v: l.v }) }); } catch (e) {} } });
  });

  /* ---------- recordings ---------- */
  async function putBlob(key, blob) {
    state.used = true; state.blobs++; paint();
    try {
      for (var i = 0; i < 3; i++) {
        try {
          var r = await api("/api/blob/" + encodeURIComponent(key), { method: "PUT", headers: { "content-type": blob.type || "application/octet-stream" }, body: blob });
          if (r.ok) { state.offline = false; return true; }
          if (r.status === 401) { state.signedOut = true; break; }
          if (r.status === 413) break;
        } catch (e) { state.offline = true; }
        await new Promise(function (res) { setTimeout(res, 800 * (i + 1)); });
      }
      return false;
    } finally { state.blobs--; paint(); }
  }
  async function getBlob(key) {
    try { var r = await api("/api/blob/" + encodeURIComponent(key)); if (!r.ok) return null; return await r.blob(); } catch (e) { return null; }
  }
  async function delBlob(key) { try { await api("/api/blob/" + encodeURIComponent(key), { method: "DELETE" }); } catch (e) {} }

  window.Store = { load: load, save: save, cached: cached, putBlob: putBlob, getBlob: getBlob, delBlob: delBlob };
})();
