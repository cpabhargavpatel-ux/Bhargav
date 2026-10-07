/* Injected into <head> by server.mjs, BEFORE the app's own script runs.
   Defines window.GTN_REMOTE, which the app checks at boot: when present it
   loads from and saves to the server instead of this browser's storage. */
"use strict";
(function(){
  let pushTimer = null, pending = null;

  function banner(msg){
    const el = document.getElementById("storeWarn");
    if (!el) return;
    if (msg){ el.innerHTML = "&#9888; " + msg; el.classList.add("on"); }
    else el.classList.remove("on");
  }

  function headerChip(user){
    const acts = document.querySelector(".hd-actions");
    if (!acts || document.getElementById("gtnWho")) return;
    const wrap = document.createElement("span");
    wrap.id = "gtnWho";
    wrap.style.cssText = "display:flex;align-items:center;gap:8px;font-size:12.5px;color:rgba(255,255,255,.85)";
    const name = document.createElement("span");
    name.textContent = user.displayName || user.username;
    const out = document.createElement("button");
    out.textContent = "Sign out";
    out.onclick = function(){
      fetch("/api/logout", { method:"POST" }).then(function(){ location.href = "/login.html"; });
    };
    wrap.appendChild(name); wrap.appendChild(out);
    if (user.role === "admin"){
      const adm = document.createElement("button");
      adm.textContent = "Users";
      adm.onclick = function(){ location.href = "/admin.html"; };
      wrap.appendChild(adm);
    }
    acts.appendChild(wrap);
  }

  window.GTN_REMOTE = {
    rev: 0,

    async init(){
      const r = await fetch("/api/state", { cache: "no-store" });
      if (r.status === 401){ location.href = "/login.html"; return null; }
      if (!r.ok) throw new Error("server " + r.status);
      const j = await r.json();
      this.rev = j.rev || 0;
      headerChip(j.user || {});
      return j.state;                       // null for a brand-new account
    },

    /* Debounced: the app calls save() on every change; the server gets one
       write per burst. A page close flushes immediately via keepalive. */
    push(state){
      pending = state;
      clearTimeout(pushTimer);
      pushTimer = setTimeout(() => this.flush(), 500);
    },

    async flush(keepalive){
      if (!pending) return;
      const body = JSON.stringify({ rev: this.rev, state: pending });
      pending = null;
      try{
        const r = await fetch("/api/state", { method: "PUT",
          headers: { "content-type": "application/json" }, body, keepalive: !!keepalive });
        if (r.status === 401){ location.href = "/login.html"; return; }
        if (r.status === 409){ banner("Your goals changed in another window — <b>reload this page</b> to get the latest. Edits here are NOT being saved."); return; }
        if (!r.ok){ banner("The server did not save that change. Check the connection, or Export as a backup."); return; }
        const j = await r.json();
        this.rev = j.rev;
        banner(null);
      }catch(e){
        banner("Server unreachable — changes are NOT being saved. Export as a backup.");
      }
    }
  };

  window.addEventListener("beforeunload", function(){ window.GTN_REMOTE.flush(true); });
})();
