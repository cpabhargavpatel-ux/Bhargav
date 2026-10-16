/* French IPA -> the closest ENGLISH (General American) IPA.
   French has sounds English lacks (/y/, /ø/, the nasal vowels, the throaty /ʁ/), so these are the NEAREST English
   sounds, with a note on how to adjust. Use them as a bridge, not as the final target. */
(function () {
  "use strict";
  var T = "̃";   // combining tilde (nasal vowels are written vowel + tilde)
  var SOUNDS = {
    /* oral vowels */
    "i":  { en: "i",  ex: "see", hit: "ee",     note: "shorter, lips spread" },
    "e":  { en: "eɪ", ex: "day", hit: "ay", note: "say it without the glide (hold it steady)" },
    "ɛ": { en: "ɛ", ex: "bed", hit: "e", note: "" },
    "a":  { en: "ɑ", ex: "father", hit: "a", note: "a little further forward in the mouth" },
    "ɑ": { en: "ɑ", ex: "father", hit: "a", note: "" },
    "o":  { en: "oʊ", ex: "go", hit: "o", note: "without the glide, lips rounded and steady" },
    "ɔ": { en: "ɔ", ex: "law", hit: "aw", note: "" },
    "u":  { en: "u",  ex: "food", hit: "oo", note: "lips very round" },
    "y":  { en: "ju", ex: "few", hit: "ew", note: "no English equivalent — say “ee” with round lips, as one steady vowel (not “yoo”)" },
    "ø": { en: "ɜ", ex: "her", hit: "er", note: "without the r, lips rounded" },
    "œ": { en: "ɜ", ex: "fur", hit: "ur", note: "without the r, shorter, lips rounded" },
    "ə": { en: "ə", ex: "about", hit: "a", note: "weak, often dropped" },
    /* nasal vowels: no English equivalent; the vowel + ng, with the ng left unsaid */
    ["ɛ" + T]: { en: "æŋ", ex: "sang", hit: "an", note: "air through the nose; don’t pronounce the g" },
    ["ɑ" + T]: { en: "ɑŋ", ex: "honk", hit: "on", note: "air through the nose; don’t pronounce the k" },
    ["ɔ" + T]: { en: "ɔŋ", ex: "song", hit: "on", note: "air through the nose; don’t pronounce the g" },
    ["œ" + T]: { en: "ʌŋ", ex: "sung", hit: "un", note: "air through the nose; don’t pronounce the g" },
    /* semi-vowels */
    "j":  { en: "j",  ex: "yes", hit: "y", note: "" },
    "w":  { en: "w",  ex: "we", hit: "w", note: "" },
    "ɥ": { en: "w", ex: "we", hit: "w", note: "no English equivalent — a “w” said with the lips rounded as for /y/" },
    /* consonants */
    "p":  { en: "p",  ex: "spin", hit: "p", note: "no puff of air, like the p in “spin”" },
    "b":  { en: "b",  ex: "bat", hit: "b", note: "" },
    "t":  { en: "t",  ex: "stop", hit: "t", note: "no puff of air, tongue on the teeth" },
    "d":  { en: "d",  ex: "do", hit: "d", note: "tongue on the teeth" },
    "k":  { en: "k",  ex: "skip", hit: "k", note: "no puff of air" },
    "g":  { en: "ɡ", ex: "go", hit: "g", note: "" },
    "ɡ": { en: "ɡ", ex: "go", hit: "g", note: "" },
    "f":  { en: "f",  ex: "fan", hit: "f", note: "" },
    "v":  { en: "v",  ex: "van", hit: "v", note: "" },
    "s":  { en: "s",  ex: "sun", hit: "s", note: "" },
    "z":  { en: "z",  ex: "zoo", hit: "z", note: "" },
    "ʃ": { en: "ʃ", ex: "shoe", hit: "sh", note: "" },
    "ʒ": { en: "ʒ", ex: "measure", hit: "s", note: "" },
    "m":  { en: "m",  ex: "man", hit: "m", note: "" },
    "n":  { en: "n",  ex: "no", hit: "n", note: "" },
    "ɲ": { en: "nj", ex: "canyon", hit: "ny", note: "one smooth sound, tongue flat against the palate" },
    "ŋ": { en: "ŋ", ex: "parking", hit: "ng", note: "" },
    "l":  { en: "l",  ex: "let", hit: "l", note: "light l, tip of the tongue" },
    "ʁ": { en: "ɹ", ex: "Bach", hit: "ch", note: "no English equivalent — like the ch in Bach (or a soft gargle), but voiced" }
  };
  var PASS = { "ˈ": 1, "ˌ": 1, ".": 1, "ː": 1 };   // stress marks, syllable dots and length marks carry over

  /* one French IPA symbol (vowel + tilde allowed) -> { en, ex, note } or null */
  function sound(sym) { return SOUNDS[sym] || null; }

  /* a whole French IPA string (without the slashes) -> English IPA approximation */
  function word(ipa) {
    var out = "", i = 0, s = String(ipa || "");
    while (i < s.length) {
      var c = s[i], two = c + (s[i + 1] === T ? T : "");
      if (two.length === 2 && SOUNDS[two]) { out += SOUNDS[two].en; i += 2; continue; }
      if (SOUNDS[c]) out += SOUNDS[c].en;
      else if (PASS[c]) out += c;
      /* anything else (liaison marks, apostrophes) is dropped */
      i++;
    }
    return out;
  }

  /* the French IPA written inside slashes at the start of a hint, e.g. "/ʒe/ — soft zh" -> "ʒe" */
  function fromHint(hint) { var m = /^\/([^/]+)\//.exec(hint || ""); return m ? m[1] : ""; }

  /* for one entry of DATA (a sound or a letter) -> { en, ex, note } */
  function forItem(it) {
    if (!it) return null;
    if (it.letter) { var f = fromHint(it.hint); return f ? { en: word(f), ex: "", note: "" } : null; }
    return sound(it.sym) || (it.sym ? { en: word(it.sym), ex: "", note: "" } : null);
  }

  window.FRIPA = { sound: sound, word: word, forItem: forItem, fromHint: fromHint };
})();
