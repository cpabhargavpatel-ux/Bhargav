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
    toggle: function () { setOn(!on()); if (on()) Cheer.claps(2, true); return on(); },
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

  /* top-bar button */
  var btn = null;
  function paint() { if (!btn) return; var v = on(); btn.textContent = v ? "👏" : "👏✕"; btn.title = v ? "Clapping sounds on — click to mute" : "Clapping sounds off — click to turn on"; btn.style.opacity = v ? "1" : "0.55"; }
  function mount() {
    var bar = document.getElementById("modtabs"); if (!bar || document.getElementById("gtnCheer")) return;
    btn = document.createElement("button"); btn.id = "gtnCheer"; btn.type = "button";
    btn.style.cssText = "border:1px solid #3a4a78;background:transparent;color:#cfd8ff;border-radius:7px;padding:2px 7px;font:inherit;font-size:13px;cursor:pointer;white-space:nowrap;touch-action:manipulation;align-self:center";
    btn.onclick = function () { Cheer.toggle(); };
    bar.insertBefore(btn, document.getElementById("modbuild") || null); paint();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
