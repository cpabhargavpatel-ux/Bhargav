/* Clapping and applause sound effects, radio-DJ style. Everything is synthesised with WebAudio (no audio files):
   a clap is a short burst of band-passed noise with a sharp attack, applause is many of them at random.
   Window.Cheer.claps(n) / applause(secs) are called when you win something; the 👏 button in the top bar turns them off. */
(function () {
  if (window.Cheer) return;
  var KEY = "gtn-cheer", ctx = null, bus = null, noise = null;

  function on() { try { return localStorage.getItem(KEY) !== "off"; } catch (e) { return true; } }
  function setOn(v) { try { localStorage.setItem(KEY, v ? "on" : "off"); } catch (e) {} paint(); }

  function makeNoise(c) {
    var len = Math.floor(c.sampleRate * 0.4), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  /* output chain: clap -> bus -> compressor -> destination, plus a short reverb tail for the room */
  function chain(c) {
    var comp = c.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 6;
    var out = c.createGain(); out.gain.value = 0.9;
    var rev = c.createConvolver(), n = Math.floor(c.sampleRate * 0.5), ir = c.createBuffer(2, n, c.sampleRate);
    for (var ch = 0; ch < 2; ch++) { var d = ir.getChannelData(ch); for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3); }
    rev.buffer = ir;
    var wet = c.createGain(); wet.gain.value = 0.22;
    var dry = c.createGain(); bus = dry;
    dry.connect(comp); dry.connect(rev); rev.connect(wet); wet.connect(comp); comp.connect(out); out.connect(c.destination);
    return dry;
  }
  function getCtx() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
      noise = makeNoise(ctx); chain(ctx);
    }
    if (ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }

  /* one hand clap at time t (seconds on the context clock) */
  function hit(c, dest, noiseBuf, t, vol, pan, bright) {
    var src = c.createBufferSource(); src.buffer = noiseBuf; src.playbackRate.value = 0.9 + Math.random() * 0.3;
    var bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = (1100 + Math.random() * 900) * (bright || 1); bp.Q.value = 0.9 + Math.random() * 0.8;
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06 + Math.random() * 0.04);
    var node = bp;
    src.connect(bp); bp.connect(g); node = g;
    if (c.createStereoPanner) { var p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
    node.connect(dest);
    src.start(t, Math.random() * 0.2); src.stop(t + 0.14);
    return 1;
  }

  /* n evenly spaced claps, like a DJ sample "clap clap clap" */
  function schedClaps(c, dest, nb, t0, n) {
    var k = 0;
    for (var i = 0; i < n; i++) { k += hit(c, dest, nb, t0 + i * 0.17, 0.9, (Math.random() - 0.5) * 0.3, 1); k += hit(c, dest, nb, t0 + i * 0.17 + 0.012, 0.5, (Math.random() - 0.5) * 0.3, 1.2); }
    return k;
  }
  /* a crowd: rising, sustained, fading density of random claps */
  function schedApplause(c, dest, nb, t0, secs) {
    var k = 0, rise = secs * 0.25, fall = secs * 0.35;
    for (var t = 0; t < secs;) {
      var env = t < rise ? t / rise : t > secs - fall ? Math.max(0, (secs - t) / fall) : 1;
      var gap = 0.004 + (1 - env) * 0.03 + Math.random() * 0.01;
      k += hit(c, dest, nb, t0 + t, (0.12 + Math.random() * 0.25) * (0.4 + 0.6 * env), Math.random() * 2 - 1, 0.8 + Math.random() * 0.6);
      t += gap;
    }
    return k;
  }

  var Cheer = {
    enabled: on,
    toggle: function () { setOn(!on()); return on(); },
    claps: function (n, force) { if (!force && !on()) return 0; var c = getCtx(); if (!c) return 0; return schedClaps(c, bus, noise, c.currentTime + 0.03, n || 3); },
    applause: function (secs, force) { if (!force && !on()) return 0; var c = getCtx(); if (!c) return 0; return schedApplause(c, bus, noise, c.currentTime + 0.03, secs || 2.5); },
    /* offline render for tests: returns the peak and RMS of the sound */
    render: function (kind) {
      var OC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!OC) return Promise.resolve(null);
      var secs = kind === "applause" ? 3 : 1, oc = new OC(2, 44100 * secs, 44100), nb = makeNoise(oc), comp = oc.createDynamicsCompressor();
      comp.connect(oc.destination);
      var hits = kind === "applause" ? schedApplause(oc, comp, nb, 0.02, 2.5) : schedClaps(oc, comp, nb, 0.02, 3);
      return oc.startRendering().then(function (buf) {
        var d = buf.getChannelData(0), pk = 0, ss = 0; for (var i = 0; i < d.length; i++) { var a = Math.abs(d[i]); if (a > pk) pk = a; ss += d[i] * d[i]; }
        return { hits: hits, peak: pk, rms: Math.sqrt(ss / d.length), seconds: buf.duration };
      });
    }
  };
  window.Cheer = Cheer;

  /* top-bar buttons: 👏 Clap (works on every page, always plays) and a separate mute switch for the automatic cheers.
     Tap = three claps, tap quickly again and again = a clap each time, press and hold (or Shift-click) = applause. */
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
    var clap = mk("gtnClap", "👏 Clap", "Click to clap, click repeatedly to keep clapping, hold (or Shift-click) for applause"), last = 0, timer = null, held = false;
    clap.onpointerdown = function () { held = false; clearTimeout(timer); timer = setTimeout(function () { held = true; Cheer.applause(3.5, true); }, 600); };
    clap.onpointerup = clap.onpointerleave = clap.onpointercancel = function () { clearTimeout(timer); };
    clap.onclick = function (e) {
      if (held) { held = false; return; }
      if (e.shiftKey) { Cheer.applause(3.5, true); return; }
      var now = Date.now(), quick = now - last < 1200; last = now;
      Cheer.claps(quick ? 1 : 3, true);
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
