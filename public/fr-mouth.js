/* Mouth diagrams for the French sounds: a side view (tongue, lips, jaw, soft palate) and a front view of the lips.
   FRMOUTH.svg(sym)      -> SVG markup for one IPA symbol
   FRMOUTH.describe(sym) -> { tongue, lips, extra } short plain-English lines
   Everything is drawn from a few numbers per sound (how high / how far back the tongue is, how rounded the lips are, ...). */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";

  /* vowels: h = tongue height (0 close .. 1 open), b = backness (0 front .. 1 back), r = lip rounding (0 spread .. 1 rounded) */
  var V = {
    "i": { h: 0, b: 0, r: 0 }, "y": { h: 0, b: 0, r: 1 }, "u": { h: 0, b: 1, r: 1 },
    "e": { h: 0.33, b: 0, r: 0 }, "ø": { h: 0.33, b: 0, r: 1 }, "o": { h: 0.33, b: 1, r: 1 },
    "ɛ": { h: 0.66, b: 0, r: 0 }, "œ": { h: 0.66, b: 0, r: 1 }, "ɔ": { h: 0.66, b: 1, r: 0.9 },
    "a": { h: 1, b: 0.15, r: 0 }, "ɑ": { h: 1, b: 1, r: 0 }, "ə": { h: 0.5, b: 0.5, r: 0.55 },
    "ɑ̃": { h: 0.95, b: 1, r: 0.4, nasal: 1 }, "ɛ̃": { h: 0.7, b: 0.1, r: 0, nasal: 1 },
    "ɔ̃": { h: 0.6, b: 1, r: 1, nasal: 1 }, "œ̃": { h: 0.7, b: 0.1, r: 0.6, nasal: 1 }
  };
  /* consonants: place, manner, voiced, lip shape */
  var C = {
    "p": { pl: "bil", mn: "stop", v: 0 }, "b": { pl: "bil", mn: "stop", v: 1 }, "m": { pl: "bil", mn: "nasal", v: 1 },
    "f": { pl: "lab", mn: "fric", v: 0 }, "v": { pl: "lab", mn: "fric", v: 1 },
    "t": { pl: "alv", mn: "stop", v: 0 }, "d": { pl: "alv", mn: "stop", v: 1 }, "n": { pl: "alv", mn: "nasal", v: 1 },
    "s": { pl: "alv", mn: "fric", v: 0 }, "z": { pl: "alv", mn: "fric", v: 1 }, "l": { pl: "alv", mn: "lat", v: 1 },
    "ʃ": { pl: "pal-alv", mn: "fric", v: 0, r: 0.6 }, "ʒ": { pl: "pal-alv", mn: "fric", v: 1, r: 0.6 },
    "ɲ": { pl: "pal", mn: "nasal", v: 1 }, "j": { pl: "pal", mn: "appr", v: 1 }, "ɥ": { pl: "pal", mn: "appr", v: 1, r: 1 },
    "k": { pl: "vel", mn: "stop", v: 0 }, "g": { pl: "vel", mn: "stop", v: 1 }, "ɡ": { pl: "vel", mn: "stop", v: 1 }, "ŋ": { pl: "vel", mn: "nasal", v: 1 },
    "w": { pl: "vel", mn: "appr", v: 1, r: 1 }, "ʁ": { pl: "uvu", mn: "fric", v: 1 }
  };
  var PLACE = {
    "bil": "lips together", "lab": "lip on the upper teeth", "alv": "tongue tip on the gum ridge",
    "pal-alv": "tongue behind the gum ridge", "pal": "tongue up to the hard palate",
    "vel": "back of tongue to the soft palate", "uvu": "back of tongue to the uvula"
  };
  var MANNER = {
    "stop": "air blocked, then released", "fric": "air squeezed through a gap", "nasal": "air through the nose",
    "appr": "a glide, almost a vowel", "lat": "air flows round the tongue"
  };
  var HEIGHT = ["high (close)", "mid-high", "mid-low", "low (open)"], BACK = ["front", "central", "back"];

  function lookup(sym) {
    if (!sym) return null; sym = String(sym).normalize("NFC");
    if (V[sym]) return { vowel: V[sym] };
    var s2 = sym.normalize("NFD").replace(/̃/, "") + (/̃/.test(sym.normalize("NFD")) ? "̃" : "");
    if (V[s2.normalize("NFC")]) return { vowel: V[s2.normalize("NFC")] };
    if (C[sym]) return { cons: C[sym] };
    return null;
  }

  function f(n) { return Math.round(n * 10) / 10; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ---- the side view: 150 x 112, lips on the left, throat on the right ---- */
  function side(m) {
    var jaw = 0, protr = 0, nasal = 0, voiced = 0, tip, peak, gap = null, contact = null, lipClose = 0, lab = 0, flow = null;
    if (m.vowel) {
      var v = m.vowel; jaw = v.h * 13; protr = v.r * 6; nasal = v.nasal || 0; voiced = 1;
      tip = [31, 62 + jaw * 0.5]; peak = [lerp(48, 88, v.b), lerp(36, 66, v.h)];
    } else {
      var c = m.cons; voiced = c.v; nasal = c.mn === "nasal" ? 1 : 0; protr = (c.r || 0) * 6;
      var touch = c.mn === "stop" || c.mn === "nasal";
      if (c.pl === "bil") { tip = [31, 62]; peak = [62, 58]; lipClose = 1; jaw = 2; }
      else if (c.pl === "lab") { tip = [31, 62]; peak = [62, 58]; lab = 1; jaw = 3; }
      else if (c.pl === "alv") { tip = touch || c.mn === "lat" ? [34, 38] : [35, 42]; peak = [54, 54]; jaw = c.mn === "fric" ? 1 : 3; contact = touch || c.mn === "lat" ? [33, 34] : null; gap = c.mn === "fric" ? [34, 36] : null; }
      else if (c.pl === "pal-alv") { tip = [38, 46]; peak = [52, 40]; jaw = 2; gap = [40, 31]; }
      else if (c.pl === "pal") { tip = [31, 62]; peak = [62, touch ? 33 : 36]; jaw = 3; contact = touch ? [62, 24] : null; gap = touch ? null : [62, 26]; }
      else if (c.pl === "vel") { tip = [31, 62]; peak = [84, c.mn === "appr" ? 36 : 32]; jaw = 3; contact = c.mn === "appr" ? null : [84, 27]; gap = c.mn === "appr" ? [84, 29] : null; }
      else { tip = [31, 62]; peak = [95, 43]; jaw = 4; gap = [97, 38]; }
      if (c.mn === "lat") flow = "lat";
    }
    var px = peak[0], py = peak[1], tx = tip[0], ty = tip[1];
    /* the tongue: tip -> highest point -> root, then back along the floor of the mouth */
    var top = "M" + f(tx) + "," + f(ty)
      + " C" + f(tx + (px - tx) * 0.30) + "," + f(ty + (py - ty) * 0.05 - 3) + " " + f(px - (px - tx) * 0.35) + "," + f(py - 1) + " " + f(px) + "," + f(py)
      + " C" + f(px + 14) + "," + f(py) + " " + f(103) + "," + f(py + 16) + " " + f(103) + "," + 98
      + " C" + 80 + "," + 102 + " " + f(46) + "," + f(88) + " " + f(tx) + "," + f(ty) + " Z";
    var o = '<svg xmlns="' + NS + '" viewBox="0 0 150 112" class="mouth-side" role="img" aria-label="Side view of the mouth">';
    /* nasal passage + velum */
    var velum = nasal ? "M88,27 C96,32 100,44 102,58" : "M88,27 C100,28 110,34 112,48";
    o += '<g fill="none" stroke="#6b5b53" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M18,28 L30,32 C46,21 68,16 88,27" />'                              // palate roof (alveolar ridge -> hard palate)
      + '<path d="' + velum + '" stroke="#b5655a" />'                                // soft palate
      + '<path d="M113,26 L113,106" />'                                              // back wall of the throat
      + '</g>';
    if (nasal) o += '<path d="M104,22 C80,6 40,6 10,22" fill="none" stroke="#3b82c4" stroke-width="2" stroke-dasharray="3 3" marker-end="url(#ar)"/>'
      + '<text x="58" y="9" font-size="8" text-anchor="middle" fill="#3b82c4" font-family="system-ui,sans-serif">air via the nose</text>';
    /* upper lip + teeth */
    o += '<g transform="translate(' + f(-protr) + ',0)"><path d="M10,26 C10,36 12,44 22,48" fill="#e8a79b" stroke="#b5655a" stroke-width="1.6" stroke-linejoin="round"/>'
      + '<rect x="21" y="32" width="8" height="16" rx="2" fill="#fff" stroke="#6b5b53" stroke-width="1.4"/></g>';
    /* lower jaw group: lower teeth, lip, chin */
    var ly = lipClose ? -9 + jaw * 0 : (lab ? -13 : jaw);
    o += '<g transform="translate(' + f(-protr) + ',' + f(lipClose || lab ? ly : jaw) + ')">'
      + '<path d="M8,60 C8,52 14,48 22,50" fill="#e8a79b" stroke="#b5655a" stroke-width="1.6" stroke-linejoin="round"/>'
      + (lab ? "" : '<rect x="21" y="54" width="8" height="12" rx="2" fill="#fff" stroke="#6b5b53" stroke-width="1.4"/>')
      + '<path d="M8,60 C6,72 10,84 22,92 L60,96" fill="none" stroke="#6b5b53" stroke-width="2" stroke-linecap="round"/></g>';
    if (lab) o += '<path d="M10,48 C14,50 20,50 26,49" fill="none" stroke="#b5655a" stroke-width="3" stroke-linecap="round" transform="translate(' + f(-protr) + ',0)"/>';
    /* tongue */
    o += '<path d="' + top + '" fill="#f19ba0" stroke="#c4666f" stroke-width="1.8" stroke-linejoin="round"/>';
    /* contact / narrow gap markers */
    if (contact) o += '<circle cx="' + contact[0] + '" cy="' + contact[1] + '" r="4" fill="#e11d48" opacity="0.85"/>';
    if (gap) o += '<g stroke="#3b82c4" stroke-width="1.6" fill="none" stroke-linecap="round"><path d="M' + (gap[0] - 6) + "," + (gap[1] + 3) + " q3,-4 6,0 t6,0 t6,0" + '"/></g>';
    if (flow === "lat") o += '<g stroke="#3b82c4" stroke-width="1.6" fill="none" stroke-linecap="round"><path d="M40,52 q6,-4 12,0 t12,0"/></g>';
    /* the voice box: vibrating lines when voiced */
    o += '<g transform="translate(104,102)"><rect x="-7" y="-4" width="14" height="8" rx="3" fill="' + (voiced ? "#fde68a" : "#f3f4f6") + '" stroke="#6b5b53" stroke-width="1.2"/>'
      + (voiced ? '<path d="M-14,-2 q3,-4 6,0 t6,0 M-14,3 q3,-4 6,0 t6,0" stroke="#d97706" stroke-width="1.3" fill="none" transform="translate(21,0)"/>' : "") + '</g>';
    o += '<defs><marker id="ar" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#3b82c4"/></marker></defs>';
    return o + "</svg>";
  }

  /* ---- the front view of the lips: 70 x 56 ---- */
  function lips(m) {
    var rx = 20, ry = 5, teeth = 0, closed = 0;
    if (m.vowel) { var v = m.vowel; rx = lerp(22, 9, v.r); ry = lerp(3, 7, v.h) + v.r * 4 + (v.h > 0.9 ? 6 : 0); if (v.r < 0.2) rx = lerp(23, 17, v.h); }
    else { var c = m.cons; if (c.pl === "bil") closed = 1; else if (c.pl === "lab") teeth = 1; else if (c.r) { rx = lerp(18, 9, c.r); ry = lerp(5, 8, c.r); } else { rx = 19; ry = 5; } }
    var o = '<svg xmlns="' + NS + '" viewBox="0 0 70 56" class="mouth-lips" role="img" aria-label="Front view of the lips">';
    if (closed) {
      o += '<path d="M8,28 C20,20 28,22 35,24 C42,22 50,20 62,28 C50,38 42,36 35,36 C28,36 20,38 8,28 Z" fill="#e8a79b" stroke="#b5655a" stroke-width="2" stroke-linejoin="round"/><path d="M10,28 C24,29 46,29 60,28" stroke="#b5655a" stroke-width="2" fill="none"/>';
    } else {
      var w = rx + 8, h = ry + 7;
      o += '<ellipse cx="35" cy="28" rx="' + f(w) + '" ry="' + f(h) + '" fill="#e8a79b" stroke="#b5655a" stroke-width="2"/>'
        + '<ellipse cx="35" cy="28" rx="' + f(rx) + '" ry="' + f(Math.max(ry, 1.6)) + '" fill="#5b2a2a"/>';
      if (teeth) o += '<path d="M' + f(35 - rx + 2) + "," + f(28 - Math.max(ry, 1.6) + 0.4) + " h" + f(2 * rx - 4) + ' v5 h-' + f(2 * rx - 4) + ' z" fill="#fff" stroke="#6b5b53" stroke-width="0.8"/>';
    }
    return o + "</svg>";
  }

  function svg(sym) { var m = lookup(sym); if (!m) return ""; return '<span class="mouth-views">' + side(m) + lips(m) + "</span>"; }

  function describe(sym) {
    var m = lookup(sym); if (!m) return null;
    if (m.vowel) {
      var v = m.vowel, hi = Math.min(3, Math.round(v.h * 3)), bk = v.b < 0.35 ? 0 : v.b > 0.7 ? 2 : 1;
      return { kind: "vowel", tongue: "tongue " + HEIGHT[hi].split(" ")[0] + ", " + BACK[bk],
        lips: v.r > 0.7 ? "lips rounded" : v.r > 0.3 ? "lips slightly rounded" : (v.h > 0.85 ? "mouth wide open" : "lips spread"),
        extra: (v.nasal ? "air also through the nose · " : "") + "voice on" };
    }
    var c = m.cons;
    return { kind: "consonant", tongue: PLACE[c.pl], lips: c.r ? "lips rounded" : (c.pl === "bil" ? "lips pressed" : (c.pl === "lab" ? "lip touches teeth" : "lips relaxed")),
      extra: MANNER[c.mn] + " · " + (c.v ? "voice on" : "voice off") };
  }

  window.FRMOUTH = { svg: svg, describe: describe, has: function (s) { return !!lookup(s); } };
})();
