/* Letters -> sounds: matches the letters of a French word to the sounds in its IPA, e.g.
     bientôt /bjɛ̃to/ ->  b→b  i→j  en→ɛ̃  t→(silent)? ... no: b→b · i→j · en→ɛ̃ · t→t · ô→o · t→(silent)
   FRALIGN.align(word, ipa) -> [ { l: "en", p: ["ɛ̃"], silent: false }, ... ]   or null when no confident match.
   It is a small dynamic-programming matcher over a table of French spellings (grapheme -> possible sounds). */
(function () {
  "use strict";
  var T = "̃";
  /* spelling -> possible sound sequences ("|" between options, spaces between the sounds of one option) */
  var G = {
    "a": "a|ɑ", "à": "a", "â": "ɑ|a", "ai": "ɛ|e|ə", "aî": "ɛ", "ain": "ɛ̃", "aim": "ɛ̃", "ail": "a j", "ay": "ɛ j|e j|a j|e i", "aï": "a i", "am": "ɑ̃", "an": "ɑ̃", "aon": "ɑ̃", "au": "o|ɔ", "aux": "o", "eau": "o", "eaux": "o",
    "b": "b|p", "bb": "b",
    "c": "k|s|g", "ç": "s", "cc": "k|k s", "ch": "ʃ|k", "ck": "k", "cqu": "k",
    "d": "d", "dd": "d",
    "e": "ə|ɛ|e|œ", "é": "e", "è": "ɛ", "ê": "ɛ|e", "ë": "ɛ", "ée": "e", "ei": "ɛ", "eil": "ɛ j", "euil": "œ j", "eu": "ø|œ|y", "eû": "ø", "em": "ɑ̃|ɛ̃", "emm": "a m", "en": "ɑ̃|ɛ̃", "er": "e|ɛ ʁ", "ez": "e", "eun": "œ̃", "et": "e|ɛ", "ed": "e", "ef": "e",
    "f": "f", "ff": "f",
    "g": "g|ʒ", "ge": "ʒ", "gn": "ɲ|g n", "gu": "g", "gg": "g|g ʒ", "gh": "g",
    "h": "", "ph": "f", "th": "t", "sh": "ʃ", "sch": "ʃ",
    "i": "i|j|i j", "î": "i", "ï": "i|j|i j", "ill": "j|i l", "il": "j|i l", "in": "ɛ̃", "im": "ɛ̃", "ie": "i|j",
    "j": "ʒ|j", "k": "k", "l": "l", "ll": "l|j", "m": "m", "mm": "m", "mn": "n", "n": "n", "nn": "n",
    "o": "o|ɔ", "ô": "o|ɔ", "œ": "e|œ|ø", "œu": "ø|œ", "œil": "œ j", "oê": "w a", "oî": "w a", "oi": "w a", "oin": "w ɛ̃", "oy": "w a j", "ou": "u|w", "où": "u", "oû": "u", "om": "ɔ̃", "on": "ɔ̃|ə", "oo": "u|o o",
    "p": "p", "pp": "p", "q": "k", "qu": "k|k w|k ɥ", "r": "ʁ", "rr": "ʁ", "rh": "ʁ",
    "s": "s|z", "ss": "s", "sc": "s|s k", "t": "t|s", "tt": "t", "ti": "s j|s i|t i", "tch": "t ʃ",
    "u": "y|ɥ", "û": "y", "ü": "y", "ui": "ɥ i", "uy": "ɥ i", "um": "ɔ m|œ̃", "un": "œ̃", "ue": "y", "uei": "œ j",
    "v": "v", "w": "w|v", "x": "k s|g z|s|z", "y": "i|j", "yn": "ɛ̃", "ym": "ɛ̃", "z": "z|s", "zz": "z"
  };
  var TABLE = {};
  Object.keys(G).forEach(function (k) { TABLE[k] = G[k] === "" ? [[]] : G[k].split("|").map(function (o, i) { return { seq: o.split(" "), rank: i }; }); });
  Object.keys(TABLE).forEach(function (k) { if (G[k] === "") TABLE[k] = [{ seq: [], rank: 0 }]; });
  var MAXG = 4;
  var VOWELS = { "i": 1, "e": 1, "ɛ": 1, "a": 1, "ɑ": 1, "o": 1, "ɔ": 1, "u": 1, "y": 1, "ø": 1, "œ": 1, "ə": 1, "ɛ̃": 1, "ɑ̃": 1, "ɔ̃": 1, "œ̃": 1 };
  var SEMI = { "j": 1, "w": 1, "ɥ": 1 };

  function tokens(ipa) {            // IPA -> list of sounds; nasal vowels keep their tilde
    var out = [], s = String(ipa || "").replace(/[ˈˌ.‿ː\/\sʼ'’]/g, "").normalize("NFD");
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (c === T || c === "͡") continue;
      if (s[i + 1] === T) { out.push(c + T); i++; } else out.push(c);
    }
    return out;
  }
  function silentCost(w, i) {       // can this letter be silent here, and how plausible is it?
    var c = w[i], n = w.length;
    if (c === "h") return 0.2;
    if (c === "e" && i >= n - 3) return 0.3;
    if (c === "e") return 0.6;
    if (i >= n - 3 && "stdxzpgcrlbmnf".indexOf(c) >= 0) return 0.4;
    if ("pst".indexOf(c) >= 0) return 1.2;       // temps, compter, est ...
    if ("lbmnxcdghr".indexOf(c) >= 0) return 1.6;
    if ("aiou".indexOf(c) >= 0) return 2.2;
    return 3;
  }

  function align(word, ipa) {
    var w = String(word || "").toLowerCase().normalize("NFC");
    if (!w || /[^a-zàâäçéèêëîïôöùûüÿœæ]/.test(w)) return null;     // no spaces, hyphens or apostrophes
    var P = tokens(ipa); if (!P.length) return null;
    var n = w.length, m = P.length, INF = 1e9;
    var cost = [], back = [];
    for (var i = 0; i <= n; i++) { cost.push(new Array(m + 1).fill(INF)); back.push(new Array(m + 1).fill(null)); }
    cost[0][0] = 0;
    for (var i = 0; i < n; i++) {
      for (var j = 0; j <= m; j++) {
        var base = cost[i][j]; if (base >= INF) continue;
        // spelling groups
        for (var L = 1; L <= MAXG && i + L <= n; L++) {
          var g = w.substr(i, L), opts = TABLE[g]; if (!opts) continue;
          for (var k = 0; k < opts.length; k++) {
            var seq = opts[k].seq, ok = j + seq.length <= m;
            for (var q = 0; ok && q < seq.length; q++) if (P[j + q] !== seq[q]) ok = false;
            if (!ok) continue;
            var c2 = base + 0.05 * opts[k].rank + 0.01 + (seq.length === 0 ? silentCost(w, i) * 0 + 0.2 : 0);
            if (c2 < cost[i + L][j + seq.length]) { cost[i + L][j + seq.length] = c2; back[i + L][j + seq.length] = { pi: i, pj: j, g: g, seq: seq, silent: false }; }
          }
        }
        // a silent letter (or the ending -ent / -es) — consumes letters, no sound
        var sc = silentCost(w, i);
        if (sc < 3) {
          var c3 = base + sc;
          if (c3 < cost[i + 1][j]) { cost[i + 1][j] = c3; back[i + 1][j] = { pi: i, pj: j, g: w[i], seq: [], silent: true }; }
        }
        // fallback: unknown letter <-> any one sound (marks the match as unsure)
        if (j < m) {
          var c4 = base + 6;
          if (c4 < cost[i + 1][j + 1]) { cost[i + 1][j + 1] = c4; back[i + 1][j + 1] = { pi: i, pj: j, g: w[i], seq: [P[j]], silent: false, unsure: true }; }
        }
      }
    }
    // a sound with no letter at all (loan words, liaison) — only at the very end of the word
    var end = cost[n][m];
    if (end >= 6) return null;                                   // would need a guess: say nothing rather than something wrong
    var units = [], i2 = n, j2 = m;
    while (i2 > 0) { var b = back[i2][j2]; if (!b) return null; units.unshift({ l: b.g, p: b.seq.slice(), silent: b.silent || b.seq.length === 0 }); i2 = b.pi; j2 = b.pj; }
    // keep the original spelling (capitals) of the letters
    var pos = 0; units.forEach(function (u) { u.l = String(word).slice(pos, pos + u.l.length); pos += u.l.length; });
    return units;
  }
  function kind(s) { return VOWELS[s] ? "v" : SEMI[s] ? "s" : "c"; }
  window.FRALIGN = { align: align, tokens: tokens, kind: kind };
})();
