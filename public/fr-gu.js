/* French sound -> the closest GUJARATI sound (Gujarati script), as a bridge like the English row.
   Some French sounds have no Gujarati letter (ü, eu, the throaty r ...): those show the nearest letter, marked "approx"
   (dotted underline), and the note says how to adjust. Please read through and correct anything that does not sound right to you. */
(function () {
  "use strict";
  var T = "̃";                       // combining tilde: nasal vowels are written vowel + tilde
  var A = "ં";                       // Gujarati anusvara (nasal dot)
  var SOUNDS = {
    /* oral vowels */
    "i":  { gu: "ઈ",  note: "like ઈ (bee), shorter, lips spread" },
    "e":  { gu: "એ",  note: "like એ, held steady — no glide" },
    "ɛ": { gu: "ઍ",  note: "open એ, like the e in “bed” (as in મૅન)" },
    "a":  { gu: "આ",  note: "like આ, a little shorter and further forward in the mouth" },
    "ɑ":  { gu: "આ",  note: "like આ, deeper, jaw dropped (as in pâte)" },
    "o":  { gu: "ઓ",  note: "like ઓ, held steady, lips rounded — no glide" },
    "ɔ":  { gu: "ઑ",  note: "open ઓ, like ઑ in “ball” (as in બૉલ)" },
    "u":  { gu: "ઊ",  note: "like ઊ (pool), lips very round" },
    "y":  { gu: "ઈ",  ap: 1, note: "no Gujarati letter — say ઈ with your lips rounded as for ઊ, as one steady vowel" },
    "ø": { gu: "એ",  ap: 1, note: "no Gujarati letter — say એ with your lips rounded as for ઓ" },
    "œ": { gu: "ઍ",  ap: 1, note: "no Gujarati letter — say ઍ with your lips rounded" },
    "ə":  { gu: "અ",  note: "the weak અ, often dropped" },
    /* nasal vowels: the vowel with the nose open (anusvara), no n or g said */
    ["ɛ" + T]: { gu: "એ" + A, note: "એં — air through the nose, don’t pronounce the ન" },
    ["ɑ" + T]: { gu: "આ" + A, note: "આં — air through the nose, don’t pronounce the ન" },
    ["ɔ" + T]: { gu: "ઓ" + A, note: "ઓં — air through the nose, don’t pronounce the ન" },
    ["œ" + T]: { gu: "અ" + A, ap: 1, note: "અં — air through the nose; many French speakers say it like એં" },
    /* semi-vowels */
    "j":  { gu: "ય",  note: "like ય (yes)" },
    "w":  { gu: "વ",  note: "like વ, with the lips rounded and no teeth on the lip (“we”)" },
    "ɥ": { gu: "વ",  ap: 1, note: "no Gujarati letter — a quick વ with the lips rounded as for ઈ-with-ઊ-lips (ü)" },
    /* consonants */
    "p":  { gu: "પ",  note: "like પ, no puff of air" },
    "b":  { gu: "બ",  note: "like બ" },
    "t":  { gu: "ત",  note: "like ત — tongue on the teeth, no puff of air" },
    "d":  { gu: "દ",  note: "like દ — tongue on the teeth" },
    "k":  { gu: "ક",  note: "like ક, no puff of air" },
    "g":  { gu: "ગ",  note: "like ગ" },
    "ɡ":  { gu: "ગ",  note: "like ગ" },
    "f":  { gu: "ફ",  note: "like ફ said as an English f (teeth on the lip)" },
    "v":  { gu: "વ",  note: "like વ with the teeth on the lip (English v)" },
    "s":  { gu: "સ",  note: "like સ" },
    "z":  { gu: "ઝ",  ap: 1, note: "like the z in “zoo” — the Gujarati ઝ is a bit harder (jh), keep it a smooth buzz" },
    "ʃ": { gu: "શ",  note: "like શ (sh)" },
    "ʒ": { gu: "ઝ",  ap: 1, note: "soft “zh” (measure) — written ઝ, but smooth, not the hard jh" },
    "m":  { gu: "મ",  note: "like મ" },
    "n":  { gu: "ન",  note: "like ન" },
    "ɲ": { gu: "ન્ય", note: "ન્ય said as one smooth sound, tongue flat against the palate (canyon)" },
    "ŋ": { gu: "ઙ",  note: "like the ng in “parking”" },
    "l":  { gu: "લ",  note: "like લ, light, tip of the tongue" },
    "ʁ": { gu: "ગ઼",  ap: 1, note: "no Gujarati letter — NOT the rolled ર: a soft gargle from the back of the throat, like ગ઼ (ghain)" }
  };
  var norm = function (s) { return String(s || "").normalize("NFD"); };
  function find(sym) { return SOUNDS[sym] || SOUNDS[norm(sym)] || null; }
  /* ---- merged sounds: the whole word's sounds joined into ONE spelling, in English and in Gujarati ---- */
  var VOWELS = "ieɛaɑoɔuyøœə";
  var isV = function (t) { return VOWELS.indexOf(norm(t).charAt(0)) >= 0; };
  var GLIDE = { j: 1, w: 1, "ɥ": 1 };
  var STOPFRIC = "pbtdkgɡfvsʃʒzmn";
  var onset2 = function (c1, c2) { return (("lʁ".indexOf(c2) >= 0) && STOPFRIC.indexOf(c1) >= 0) || (GLIDE[c2] && !GLIDE[c1]); };   // pr, bl, tr … and pj, tw …: they start a syllable together

  /* English: the same spellings as the English row (ee, sh, on, zh …) written together, with a hyphen between syllables: bon-zhoor */
  function mergeEn(tk) {
    var say = window.FRIPA && window.FRIPA.say; if (!say) return "";
    var it = tk.map(function (t) { return { t: norm(t).charAt(0), v: isV(t), s: say(t) || String(t) }; }), cut = {}, vi = [];
    it.forEach(function (x, i) { if (x.v) vi.push(i); });
    for (var k = 1; k < vi.length; k++) {
      var a = vi[k - 1], b = vi[k], n = b - a - 1;
      if (n <= 1) cut[n === 0 ? b : a + 1] = 1;
      else cut[onset2(it[b - 2].t, it[b - 1].t) ? b - 2 : b - 1] = 1;
    }
    var out = "";
    it.forEach(function (x, i) { if (cut[i] && out) out += "-"; out += x.s; });
    return out;
  }
  /* Gujarati: consonant + vowel sign (ો), a consonant followed by a consonant gets a halant (સ્વ), nasal vowels take the dot (ં),
     a vowel at the start of a syllable is written in full (આ). A final consonant is written plain: Gujarati does not say a final “a”. */
  var MATRA = { i: "ી", e: "ે", "ɛ": "ૅ", a: "ા", "ɑ": "ા", o: "ો", "ɔ": "ૉ", u: "ૂ", y: "ી", "ø": "ે", "œ": "ૅ", "ə": "" };
  var INDEP = { i: "ઈ", e: "એ", "ɛ": "ઍ", a: "આ", "ɑ": "આ", o: "ઓ", "ɔ": "ઑ", u: "ઊ", y: "ઈ", "ø": "એ", "œ": "ઍ", "ə": "અ" };
  var NASALV = { "ɛ": "e", "ɑ": "a", "ɔ": "o", "œ": "ə" };       // a nasal vowel is written with the plain vowel + ં (ઓં, not ઑં)
  var MERGED_C = { "ʁ": "ર" };                                    // inside a whole word the French r is written ર, as Gujarati writers usually do (the row above keeps the “gargle” ગ઼)
  function mergeGu(tk) {
    var out = "", prevC = false;
    tk.forEach(function (t) {
      var d = norm(t), base = d.charAt(0), nasal = d.length > 1 && d.charAt(1) === "̃";
      if (isV(t)) { if (nasal) base = NASALV[base] || base; out += prevC ? MATRA[base] : INDEP[base]; if (nasal) out += A; prevC = false; return; }
      var e = find(t); if (!e) return;
      if (prevC) out += "્";
      out += MERGED_C[norm(t)] || e.gu; prevC = true;
    });
    return out;
  }
  function merge(tokens) {
    var tk = (tokens || []).filter(function (t) { return t && !/^[ˈˌ.ː]$/.test(t); });
    return tk.length ? { en: mergeEn(tk), gu: mergeGu(tk) } : null;
  }

  window.FRGU = {
    sound: find,
    say: function (sym) { var e = find(sym); return e ? e.gu : ""; },
    note: function (sym) { var e = find(sym); return e ? e.note : ""; },
    merge: merge,
    approx: function (sym) { var e = find(sym); return !!(e && e.ap); }
  };
})();
