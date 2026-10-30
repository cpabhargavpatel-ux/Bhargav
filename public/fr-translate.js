/* French -> English translation of whole sentences, for the sentence boxes on French > Sentences.
   1. The browser's own on-device translator (Chrome / Edge 138+, the "Translator API"). Nothing is sent anywhere and it works offline,
      after a one-time download of the French-English language pack (the button asks first, because the download is a few hundred MB).
   2. Otherwise this app's server looks the sentence up (/api/translate) — it needs internet, but you never leave the page.
   Answers are remembered in this browser, so a sentence is translated only once.
   FrTranslate.get(text) -> Promise<{ t, via }>      via: "device" | "server"
   FrTranslate.mode()    -> Promise<"device" | "download" | "server">   what get() will use right now
   FrTranslate.download(onProgress) -> Promise<boolean>                 the one-time language-pack download (needs a click)  */
(function () {
  "use strict";
  var KEY = "fr-tr-cache", MAX = 600, cache = {}, translator = null, creating = null, chain = Promise.resolve();
  try { cache = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { cache = {}; }
  function remember(text, t) {
    cache[text] = t;
    var ks = Object.keys(cache);
    if (ks.length > MAX) ks.slice(0, ks.length - MAX / 2).forEach(function (k) { delete cache[k]; });
    try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) {}
  }
  var PAIR = { sourceLanguage: "fr", targetLanguage: "en" };

  function availability() {
    if (!("Translator" in self) || !self.Translator.availability) return Promise.resolve("unavailable");
    return self.Translator.availability(PAIR).catch(function () { return "unavailable"; });
  }
  function device() {                                                       // a ready on-device translator, or null
    if (translator) return Promise.resolve(translator);
    if (creating) return creating;
    creating = availability().then(function (a) {
      if (a !== "available") return null;
      return self.Translator.create(PAIR).then(function (tr) { translator = tr; return tr; });
    }).catch(function () { return null; }).then(function (tr) { creating = null; return tr; });
    return creating;
  }
  function mode() {
    return availability().then(function (a) { return a === "available" ? "device" : (a === "downloadable" || a === "downloading") ? "download" : "server"; });
  }
  function download(onProgress) {
    if (!("Translator" in self)) return Promise.resolve(false);
    return self.Translator.create(Object.assign({ monitor: function (m) { m.addEventListener("downloadprogress", function (e) { if (onProgress) onProgress(e.loaded); }); } }, PAIR))
      .then(function (tr) { translator = tr; return true; }).catch(function () { return false; });
  }

  function chunks(text) {                                                    // the server takes up to 400 characters at a time
    if (text.length <= 380) return [text];
    var out = [], cur = "";
    text.split(/(?<=[.!?…])\s+/).forEach(function (s) {
      if (cur && (cur + " " + s).length > 380) { out.push(cur); cur = s; } else cur = cur ? cur + " " + s : s;
    });
    if (cur) out.push(cur);
    return out;
  }
  function viaServer(text) {
    return chunks(text).reduce(function (p, c) {
      return p.then(function (acc) {
        return fetch("/api/translate?q=" + encodeURIComponent(c) + "&from=fr&to=en", { credentials: "same-origin" }).then(function (r) {
          return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "Translation failed"); return acc.concat(j.t); });
        });
      });
    }, Promise.resolve([])).then(function (parts) { return parts.join(" "); });
  }

  function get(text) {
    text = String(text || "").replace(/\s+/g, " ").trim();
    if (!text) return Promise.resolve({ t: "", via: "" });
    if (cache[text]) return Promise.resolve({ t: cache[text], via: "saved" });
    var run = chain.then(function () {
      return device().then(function (tr) {
        if (tr) return tr.translate(text).then(function (t) { return { t: t, via: "device" }; });
        return viaServer(text).then(function (t) { return { t: t, via: "server" }; });
      });
    }).then(function (r) { if (r.t) remember(text, r.t); return r; });
    chain = run.catch(function () {});                                          // one at a time, so a long list doesn't flood the translator
    return run;
  }
  window.FrTranslate = { get: get, mode: mode, download: download };
})();
