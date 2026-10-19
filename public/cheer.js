/* Clapping, cheering and applause sound effects, radio-DJ style. Everything is synthesised with WebAudio (no audio files):
   - a hand clap is a few ms of flutter (the palms meeting) then a short resonant noise decay,
   - applause is hundreds of random claps under a crowd "roar" (noise shaped by vowel formants),
   - cheering is a handful of "wooo!" voices (buzzing source + vowel formants gliding oo -> ah, with vibrato).
   Cheer.claps(n) and Cheer.applause(secs) are called when you win something; Cheer.cheer(level) is the tap on the top-bar button. */
(function () {
  if (window.Cheer) return;
  var KEY = "gtn-cheer", ctx = null, bus = null, noise = null;
  var rnd = function (a, b) { return a + Math.random() * (b - a); };

  function on() { try { return localStorage.getItem(KEY) !== "off"; } catch (e) { return true; } }
  function setOn(v) { try { localStorage.setItem(KEY, v ? "on" : "off"); } catch (e) {} paint(); }

  function makeNoise(c) {
    var len = Math.floor(c.sampleRate * 2), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0), last = 0;
    for (var i = 0; i < len; i++) { var w = Math.random() * 2 - 1; last = last * 0.35 + w * 0.65; d[i] = last; }   // slightly softened white noise
    return b;
  }
  /* output: input -> compressor -> destination, plus a room reverb (decaying noise) mixed in */
  function chain(c, dest) {
    var comp = c.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
    var out = c.createGain(); out.gain.value = 1.1;
    var rev = c.createConvolver(), n = Math.floor(c.sampleRate * 1.1), ir = c.createBuffer(2, n, c.sampleRate);
    for (var ch = 0; ch < 2; ch++) { var d = ir.getChannelData(ch), lp = 0; for (var i = 0; i < n; i++) { lp = lp * 0.6 + (Math.random() * 2 - 1) * 0.4; d[i] = lp * Math.pow(1 - i / n, 2.6); } }
    rev.buffer = ir;
    var wet = c.createGain(); wet.gain.value = 0.3;
    var inp = c.createGain();
    inp.connect(comp); inp.connect(rev); rev.connect(wet); wet.connect(comp); comp.connect(out); out.connect(dest || c.destination);
    return inp;
  }
  function getCtx() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
      noise = makeNoise(ctx); bus = chain(ctx);
    }
    if (ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }
  function pan(c, node, dest, p) {
    if (c.createStereoPanner) { var sp = c.createStereoPanner(); sp.pan.value = p; node.connect(sp); sp.connect(dest); } else node.connect(dest);
  }

  /* ---- one hand clap at time t ---- */
  function hit(c, dest, nb, t, vol, p, bright) {
    var src = c.createBufferSource(); src.buffer = nb; src.playbackRate.value = rnd(0.9, 1.2);
    var hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 450;
    var f1 = c.createBiquadFilter(); f1.type = "bandpass"; f1.frequency.value = rnd(900, 1300) * (bright || 1); f1.Q.value = 1.1;
    var f2 = c.createBiquadFilter(); f2.type = "bandpass"; f2.frequency.value = rnd(1900, 2800) * (bright || 1); f2.Q.value = 0.8;
    var g = c.createGain(), g2 = c.createGain(); g2.gain.value = 0.6;
    /* flutter: two or three quick spikes as the palms and fingers land, then a decay */
    var fl = rnd(0.006, 0.012), v = vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.0012);
    g.gain.exponentialRampToValueAtTime(v * 0.25, t + fl * 0.8);
    g.gain.linearRampToValueAtTime(v * 0.9, t + fl);
    g.gain.exponentialRampToValueAtTime(v * 0.2, t + fl * 1.8);
    g.gain.linearRampToValueAtTime(v * 0.55, t + fl * 2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + rnd(0.07, 0.12));
    src.connect(hp); hp.connect(f1); hp.connect(f2); f1.connect(g); f2.connect(g2); g2.connect(g);
    pan(c, g, dest, p);
    src.start(t, rnd(0, 1.5)); src.stop(t + 0.16);
    return 1;
  }
  /* n evenly spaced claps: a couple of people clapping in time */
  function schedClaps(c, dest, nb, t0, n, vol) {
    var k = 0, gap = 0.19;
    for (var i = 0; i < n; i++) for (var j = 0; j < 4; j++) k += hit(c, dest, nb, t0 + i * gap + rnd(0, 0.025), (vol || 1) * rnd(0.55, 0.95), rnd(-0.6, 0.6), rnd(0.9, 1.15));
    return k;
  }

  /* ---- crowd roar: noise through vowel formants, swelling and fading ---- */
  function roar(c, dest, nb, t0, secs, vol) {
    var src = c.createBufferSource(); src.buffer = nb; src.loop = true;
    var g = c.createGain(), form = [[650, 6, 1], [1100, 7, 0.7], [2600, 8, 0.35]];
    form.forEach(function (f) {
      var bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = f[0]; bp.Q.value = f[1];
      var fg = c.createGain(); fg.gain.value = f[2]; src.connect(bp); bp.connect(fg); fg.connect(g);
    });
    var r = Math.min(0.5, secs * 0.25), v = vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(v, t0 + r);
    for (var t = r; t < secs - r; t += 0.25) g.gain.linearRampToValueAtTime(v * rnd(0.7, 1), t0 + t);   // the crowd surges and dips
    g.gain.linearRampToValueAtTime(0.0001, t0 + secs);
    g.connect(dest); src.start(t0, rnd(0, 1)); src.stop(t0 + secs + 0.05);
  }

  /* ---- one cheering voice: "wooo!" — a buzzing source through vowel formants gliding oo -> ah ---- */
  function voice(c, dest, nb, t, dur, f0, p, vol, fem) {
    var osc = c.createOscillator(); osc.type = "sawtooth";
    osc.frequency.setValueAtTime(f0 * 0.8, t);
    osc.frequency.exponentialRampToValueAtTime(f0 * 1.18, t + dur * 0.3);     // the whoop rises …
    osc.frequency.linearRampToValueAtTime(f0 * 1.05, t + dur * 0.7);
    osc.frequency.exponentialRampToValueAtTime(f0 * 0.82, t + dur);          // … and drops away
    var lfo = c.createOscillator(); lfo.frequency.value = rnd(5, 6.5); var ld = c.createGain(); ld.gain.value = f0 * 0.012;
    lfo.connect(ld); ld.connect(osc.frequency);
    var breath = c.createBufferSource(); breath.buffer = nb; breath.loop = true; var bg = c.createGain(); bg.gain.value = 0.25;
    var src = c.createGain(); osc.connect(src); breath.connect(bg); bg.connect(src);
    var k = fem ? 1.15 : 1, out = c.createGain();
    [[330, 780, 6, 1], [850, 1250, 8, 0.7], [2400, 2700, 10, 0.35]].forEach(function (f) {    // [oo, ah, Q, level]
      var bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = f[2];
      bp.frequency.setValueAtTime(f[0] * k, t); bp.frequency.linearRampToValueAtTime(f[1] * k, t + dur * 0.4);
      var fg = c.createGain(); fg.gain.value = f[3]; src.connect(bp); bp.connect(fg); fg.connect(out);
    });
    out.gain.setValueAtTime(0.0001, t); out.gain.linearRampToValueAtTime(vol, t + 0.07);
    out.gain.setValueAtTime(vol, t + dur * 0.55); out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    pan(c, out, dest, p);
    osc.start(t); lfo.start(t); breath.start(t, rnd(0, 1)); osc.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05); breath.stop(t + dur + 0.05);
  }
  /* n voices at random times in [0, spread], some men and some women */
  function cheerVoices(c, dest, nb, t0, n, spread, vol) {
    for (var i = 0; i < n; i++) { var fem = Math.random() < 0.5; voice(c, dest, nb, t0 + rnd(0, spread), rnd(0.7, 1.2), fem ? rnd(250, 340) : rnd(125, 175), rnd(-0.8, 0.8), vol * 4 * rnd(0.6, 1), fem); }
    return n;
  }

  /* ---- the combined sounds ---- */
  function sClaps(c, dest, nb, t0, n) {                       // small win: a few claps, a little cheer if it is a big one
    var k = schedClaps(c, dest, nb, t0, n, 1);
    if (n >= 3) { roar(c, dest, nb, t0, 0.5 + n * 0.25, 0.15); cheerVoices(c, dest, nb, t0 + 0.05, 2, 0.3, 0.1); }
    return k;
  }
  function sApplause(c, dest, nb, t0, secs) {                 // big win: crowd, applause, whoops
    var k = 0, rise = secs * 0.2, fall = secs * 0.4;
    roar(c, dest, nb, t0, secs, 0.3);
    for (var t = 0; t < secs;) {
      var env = t < rise ? t / rise : t > secs - fall ? Math.max(0, (secs - t) / fall) : 1;
      k += hit(c, dest, nb, t0 + t, rnd(0.1, 0.35) * (0.35 + 0.65 * env), rnd(-1, 1), rnd(0.8, 1.4));
      t += 0.005 + (1 - env) * 0.03 + rnd(0, 0.012);
    }
    cheerVoices(c, dest, nb, t0 + 0.05, Math.round(3 + secs), secs * 0.55, 0.11);
    return k;
  }
  /* the top-bar tap: claps + cheer together (level 1 = a tap, 2 = a big ovation) */
  function sCheer(c, dest, nb, t0, level) {
    if (level >= 2) return sApplause(c, dest, nb, t0, 4.5);
    var k = schedClaps(c, dest, nb, t0, 4, 1);
    roar(c, dest, nb, t0, 2, 0.22);
    cheerVoices(c, dest, nb, t0 + 0.05, 4, 0.5, 0.12);
    return k;
  }

  var Cheer = {
    enabled: on,
    toggle: function () { setOn(!on()); return on(); },
    claps: function (n, force) { if (!force && !on()) return 0; var c = getCtx(); if (!c) return 0; return sClaps(c, bus, noise, c.currentTime + 0.03, n || 3); },
    applause: function (secs, force) { if (!force && !on()) return 0; var c = getCtx(); if (!c) return 0; return sApplause(c, bus, noise, c.currentTime + 0.03, secs || 3); },
    cheer: function (level, force) { if (!force && !on()) return 0; var c = getCtx(); if (!c) return 0; return sCheer(c, bus, noise, c.currentTime + 0.03, level || 1); },
    /* offline render for tests: returns the samples */
    render: function (kind) {
      var OC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!OC) return Promise.resolve(null);
      var secs = kind === "applause" || kind === "ovation" ? 6 : 3, oc = new OC(2, 44100 * secs, 44100), nb = makeNoise(oc), inp = chain(oc);
      if (kind === "applause") sApplause(oc, inp, nb, 0.02, 4);
      else if (kind === "ovation") sCheer(oc, inp, nb, 0.02, 2);
      else if (kind === "cheer") sCheer(oc, inp, nb, 0.02, 1);
      else if (kind === "voices") cheerVoices(oc, inp, nb, 0.02, 4, 0.5, 0.12);
      else if (kind === "roar") roar(oc, inp, nb, 0.02, 2, 0.16);
      else if (kind === "hands") schedClaps(oc, inp, nb, 0.02, 4, 1);
      else sClaps(oc, inp, nb, 0.02, 4);
      return oc.startRendering().then(function (buf) { return { rate: buf.sampleRate, data: Array.from(buf.getChannelData(0)) }; });
    }
  };
  window.Cheer = Cheer;

  /* top-bar buttons: 👏 Clap (works on every page, always plays) and a separate mute switch for the automatic cheers.
     Tap = claps and cheering, tap quickly again and again = more claps, press and hold (or Shift-click) = a big ovation. */
  var mute = null;
  function paint() { if (!mute) return; var v = on(); mute.textContent = v ? "🔔" : "🔕"; mute.title = v ? "Automatic cheers on (deck, scores, Feynman) — click to mute them" : "Automatic cheers muted — click to turn on"; mute.style.opacity = v ? "1" : "0.55"; }
  function mk(id, text, title) {
    var b = document.createElement("button"); b.id = id; b.type = "button"; b.textContent = text; b.title = title;
    b.style.cssText = "border:1px solid #3a4a78;background:transparent;color:#cfd8ff;border-radius:7px;padding:2px 8px;font:inherit;font-size:13px;cursor:pointer;white-space:nowrap;touch-action:manipulation;align-self:center;user-select:none;-webkit-user-select:none";
    return b;
  }
  function mount() {
    var bar = document.getElementById("modtabs"); if (!bar || document.getElementById("gtnClap")) return;
    var old = document.getElementById("gtnCheer"); if (old) old.remove();
    var clap = mk("gtnClap", "👏 Clap", "Click for claps and cheering, click repeatedly for more claps, hold (or Shift-click) for a big ovation"), last = 0, timer = null, held = false;
    clap.onpointerdown = function () { held = false; clearTimeout(timer); timer = setTimeout(function () { held = true; Cheer.cheer(2, true); }, 600); };
    clap.onpointerup = clap.onpointerleave = clap.onpointercancel = function () { clearTimeout(timer); };
    clap.onclick = function (e) {
      if (held) { held = false; return; }
      if (e.shiftKey) { Cheer.cheer(2, true); return; }
      var now = Date.now(), quick = now - last < 1200; last = now;
      if (quick) Cheer.claps(2, true); else Cheer.cheer(1, true);
    };
    mute = mk("gtnCheer", "", ""); mute.onclick = function () { setOn(!on()); if (on()) Cheer.claps(1, true); };
    var wrap = document.createElement("span"); wrap.id = "gtnClapWrap"; wrap.appendChild(clap); wrap.appendChild(mute);
    var css = document.createElement("style");
    /* on a phone or tablet the bar scrolls sideways; keep the clap buttons pinned to its right edge so they are always in reach */
    css.textContent = "#gtnClapWrap{display:inline-flex;gap:4px;align-self:center;margin-left:10px}" +
      "@media (max-width:900px),(hover:none){#gtnClapWrap{position:sticky;right:0;z-index:3;background:#10182b;padding:0 0 0 8px;margin-left:auto;box-shadow:-10px 0 8px #10182b}}";
    document.head.appendChild(css);
    bar.insertBefore(wrap, document.getElementById("modbuild") || null); paint();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
