
/* Shot Tracker rewrite (v38_0) - defensive boot, no modules */
(function(){
  "use strict";
  const VERSION = "v38_0";
  const LS_KEY = "shotTracker.v38.state";
  const LS_BAG_KEY = "shotTracker.v38.bagOverride";
  const LS_COURSE_KEY = "shotTracker.v38.course";

  function $(id){ return document.getElementById(id); }
  function nowISO(){ return new Date().toISOString(); }

  function toast(msg, ms) {
    ms = ms || 900;
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(e){} }, ms);
  }

  function clampInt(x, min, max) {
    const n = Number(x);
    if(!isFinite(n)) return null;
    const r = Math.round(n);
    if(r < min) return min;
    if(r > max) return max;
    return r;
  }

  function metersToYards(m) {
    const n = Number(m);
    if(!isFinite(n)) return null;
    return n * 1.0936132983;
  }

  function saneYards(y) {
    const n = Number(y);
    if(!isFinite(n)) return null;
    if(n < 0) return null;
    if(n > 1200) return null;
    return Math.round(n);
  }

  function distanceYards(a, b) {
    if(!a || !b) return null;
    const R = 6371000;
    const toRad = (d)=> d * Math.PI/180;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const s = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
    const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1-s));
    const meters = R * c;
    const y = metersToYards(meters);
    if(y == null) return null;
    if(y < 0) return null;
    if(y > 1200) return null;
    return Math.round(y);
  }

  function buildBagFromConfig() {
    const cfg = window.SHOT_TRACKER_CONFIG || {};
    const clubs = Array.isArray(cfg.clubs) ? cfg.clubs.slice() : ["Club?"];
    const shotTypes = Array.isArray(cfg.shotTypes) ? cfg.shotTypes.slice() : ["Type?"];
    const bag = (cfg.bag && typeof cfg.bag === "object") ? cfg.bag : {};
    return { clubs, shotTypes, bag };
  }

  function defaultState() {
    return {
      version: VERSION,
      round: { startedAt: nowISO() },
      holeIndex: 0,
      holes: Array.from({length:18}, (_,i)=>({
        hole: i+1,
        par: 0,
        yards: 0,
        tee: null,
        flag: null,
        fwy: false,
        gir: false,
        shots: []
      })),
      bag: buildBagFromConfig(),
      ui: { caddyMode: "carry", showAll: false }
    };
  }

  function loadJSON(key) {
    try {
      const raw = localStorage.getItem(key);
      if(!raw) return null;
      return JSON.parse(raw);
    } catch(e) { return null; }
  }

  function saveJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
  }

  function loadCourseName() {
    const o = loadJSON(LS_COURSE_KEY);
    return (o && typeof o.name === "string") ? o.name : "";
  }

  function saveCourseName(name) {
    saveJSON(LS_COURSE_KEY, { name: String(name||"") });
  }

  function loadBagOverride() {
    const o = loadJSON(LS_BAG_KEY);
    if(!o || typeof o !== "object") return null;
    return o;
  }

  function applyBagOverride(state) {
    const o = loadBagOverride();
    if(!o) return;
    if(Array.isArray(o.clubs)) state.bag.clubs = o.clubs.slice();
    if(Array.isArray(o.shotTypes)) state.bag.shotTypes = o.shotTypes.slice();
    if(o.bag && typeof o.bag === "object") state.bag.bag = o.bag;
  }

  function saveBagOverride(state) {
    saveJSON(LS_BAG_KEY, {
      clubs: state.bag.clubs,
      shotTypes: state.bag.shotTypes,
      bag: state.bag.bag
    });
  }

  // GPS
  const gps = {
    watchId: null,
    lastFix: null,
    start() {
      if(!navigator.geolocation) return;
      if(this.watchId != null) return;
      try {
        this.watchId = navigator.geolocation.watchPosition(
          (pos)=>{
            const c = pos.coords;
            const accY = metersToYards(c.accuracy);
            this.lastFix = {
              lat: c.latitude,
              lon: c.longitude,
              accY: (accY == null) ? null : Math.round(accY)
            };
            uiRender();
          },
          (_err)=>{},
          { enableHighAccuracy:true, maximumAge:3000, timeout:8000 }
        );
      } catch(e) {}
    },
    snapshot(cb) {
      if(!navigator.geolocation) return cb(null);
      try {
        navigator.geolocation.getCurrentPosition(
          (pos)=>{
            const c = pos.coords;
            const accY = metersToYards(c.accuracy);
            cb({
              lat: c.latitude,
              lon: c.longitude,
              accY: (accY == null) ? null : Math.round(accY)
            });
          },
          (_err)=>cb(null),
          { enableHighAccuracy:true, maximumAge:0, timeout:8000 }
        );
      } catch(e) { cb(null); }
    }
  };

  let state = null;
  const els = {};

  function cacheEls() {
    const ids = [
      "btnCourse","sbHole","sbShots","sbTotal","sbCourse","roundInfo",
      "toFlag","accTag","attempt","btnCaddy","btnTee","btnFlag","btnShot",
      "btnPen","btnDel","btnFwy","btnGir",
      "par","holeYds","shotsList",
      "caddyBackdrop","caddySheet","btnCloseCaddy","btnShowAll","btnMode","btnBag",
      "caddyTarget","btnResetAdj","caddyList",
      "bagBackdrop","bagSheet","btnCloseBag","bagClub","bagType","bagCarry","bagTotal","btnSaveBag",
      "courseName","btnSaveCourse"
    ];
    ids.forEach(id=>{ els[id] = $(id); });
  }

  function hole() { return state.holes[state.holeIndex]; }

  function setLit(el, on) {
    if(!el) return;
    el.classList.toggle("lit", !!on);
  }

  function accClass(accY) {
    if(accY == null) return "bad";
    if(accY <= 8) return "good";
    if(accY <= 18) return "warn";
    return "bad";
  }

  function expectedFor(club, shotType) {
    const bag = state.bag.bag || {};
    const row = bag[club];
    const cell = row ? row[shotType] : null;
    const carry = cell && isFinite(Number(cell.carry)) ? Number(cell.carry) : 0;
    const total = cell && isFinite(Number(cell.total)) ? Number(cell.total) : 0;
    return { carry, total };
  }

  function getToFlagYards() {
    const h = hole();
    if(!h.flag) return null;
    const fix = gps.lastFix;
    if(!fix) return null;
    return distanceYards({lat: fix.lat, lon: fix.lon}, h.flag);
  }

  function ensureAttempt() {
    const aEl = els.attempt;
    if(!aEl) return;
    const cur = String(aEl.value||"").trim();
    if(cur) return;
    const tf = getToFlagYards();
    if(tf != null) aEl.value = String(tf);
  }

  function saveState() { saveJSON(LS_KEY, state); }

  function addShot(opts) {
    opts = opts || {};
    const club = opts.club || "Club?";
    const shotType = opts.shotType || "Type?";
    const penalty = !!opts.penalty;

    const h = hole();
    const tf = getToFlagYards();
    const attempt = saneYards(els.attempt ? els.attempt.value : tf) ?? (tf ?? 0);
    const exp = expectedFor(club, shotType);

    const shot = {
      id: Math.random().toString(36).slice(2,10),
      t: nowISO(),
      club: club,
      shotType: shotType,
      toPin: tf ?? 0,
      attempt: attempt ?? 0,
      expectedCarry: exp.carry,
      expectedTotal: exp.total,
      distance: 0,
      penalty: penalty,
      coord: null
    };
    h.shots.push(shot);
    saveState();
    uiRender();

    if(penalty) return;

    gps.snapshot((fix)=>{
      if(!fix) { toast("No GPS yet"); return; }
      const cur = {lat: fix.lat, lon: fix.lon};
      shot.coord = cur;

      const idx = h.shots.findIndex(s=>s.id===shot.id);
      let prev = null;
      if(idx > 0) prev = h.shots[idx-1].coord;
      if(!prev) prev = h.tee;

      const d = prev ? distanceYards(prev, cur) : null;
      shot.distance = d ?? 0;
      saveState();
      uiRender();
    });
  }

  function deleteLastShot() {
    const h = hole();
    if(!h.shots.length) return;
    h.shots.pop();
    saveState();
    uiRender();
  }

  function addPenalty() { addShot({club:"", shotType:"penalty", penalty:true}); }

  function toggleFwy() {
    const h = hole();
    h.fwy = !h.fwy;
    saveState();
    uiRender();
  }

  function toggleGir() {
    const h = hole();
    h.gir = !h.gir;
    saveState();
    uiRender();
  }

  function toggleTee() {
    const h = hole();
    if(h.tee && h.shots.length > 0) { toast("Tee locked after shots"); return; }
    if(h.tee) { h.tee = null; saveState(); uiRender(); return; }
    gps.snapshot((fix)=>{
      if(!fix) { toast("No GPS yet"); return; }
      h.tee = {lat: fix.lat, lon: fix.lon};
      saveState();
      uiRender();
    });
  }

  function toggleFlag() {
    const h = hole();
    if(h.flag) { h.flag = null; saveState(); uiRender(); return; }
    gps.snapshot((fix)=>{
      if(!fix) { toast("No GPS yet"); return; }
      h.flag = {lat: fix.lat, lon: fix.lon};
      saveState();
      uiRender();
    });
  }

  function caddySuggestions(targetY, mode, showAll) {
    const clubs = state.bag.clubs || ["Club?"];
    const bag = state.bag.bag || {};
    const out = [];
    for(const club of clubs) {
      if(!club || club==="Club?") continue;
      const row = bag[club] || {};
      for(const st of Object.keys(row)) {
        const cell = row[st] || {};
        const carry = Number(cell.carry)||0;
        const total = Number(cell.total)||0;
        const base = (mode==="total") ? total : carry;
        if(!base) continue;
        const delta = Math.round(base - targetY);
        out.push({club:club, st:st, carry:carry, total:total, delta:delta, abs:Math.abs(delta)});
      }
    }
    out.sort((a,b)=>a.abs-b.abs);
    if(!showAll) return out.filter(r=>r.abs<=10);
    return out;
  }

  function renderCaddy() {
    if(!els.caddyList) return;
    const mode = (state.ui.caddyMode === "total") ? "total" : "carry";
    const showAll = !!state.ui.showAll;
    const target = clampInt(els.caddyTarget ? els.caddyTarget.value : 0, 0, 1200) ?? 0;
    const rows = caddySuggestions(target, mode, showAll);

    els.caddyList.innerHTML = "";
    if(!rows.length) {
      const empty = document.createElement("div");
      empty.style.color = "var(--muted)";
      empty.style.fontWeight = "850";
      empty.style.padding = "12px 2px";
      empty.textContent = showAll ? "No bag data." : "No clubs within ±10y.";
      els.caddyList.appendChild(empty);
      return;
    }

    for(const r of rows) {
      const row = document.createElement("div");
      row.className = "suggestRow";

      const left = document.createElement("div");
      const nm = document.createElement("div");
      nm.className = "name";
      nm.textContent = r.club + " " + r.st;
      const meta = document.createElement("div");
      meta.className = "meta";
      const diff = (r.delta >= 0) ? ("+" + r.delta + "y") : (r.delta + "y");
      meta.textContent = "carry " + r.carry + " / total " + r.total + " (" + diff + ")";
      left.appendChild(nm);
      left.appendChild(meta);

      const btn = document.createElement("button");
      btn.className = "smallBtn";
      btn.type = "button";
      btn.textContent = "Use";
      btn.addEventListener("click", ()=>{
        if(els.attempt) els.attempt.value = String(target || "");
        closeCaddy();
        addShot({club:r.club, shotType:r.st, penalty:false});
      });

      row.appendChild(left);
      row.appendChild(btn);
      els.caddyList.appendChild(row);
    }
  }

  function openCaddy() {
    if(!els.caddyBackdrop || !els.caddySheet) return;
    state.ui.showAll = false;
    state.ui.caddyMode = state.ui.caddyMode || "carry";

    const tf = getToFlagYards();
    const curAttempt = saneYards(els.attempt ? els.attempt.value : null) ?? tf ?? 0;
    if(els.caddyTarget) els.caddyTarget.value = String(curAttempt || 0);

    if(els.btnShowAll) els.btnShowAll.textContent = "Show All";
    if(els.btnMode) els.btnMode.textContent = (state.ui.caddyMode==="total") ? "Total" : "Carry";

    els.caddyBackdrop.classList.remove("hidden");
    els.caddySheet.classList.remove("hidden");
    renderCaddy();
  }

  function closeCaddy() {
    if(els.caddyBackdrop) els.caddyBackdrop.classList.add("hidden");
    if(els.caddySheet) els.caddySheet.classList.add("hidden");
  }

  function fillBagSelectors() {
    if(!els.bagClub || !els.bagType) return;
    const clubs = state.bag.clubs || ["Club?"];
    const types = state.bag.shotTypes || ["Type?"];
    els.bagClub.innerHTML = "";
    clubs.forEach(c=>{ const o=document.createElement("option"); o.value=c; o.textContent=c; els.bagClub.appendChild(o); });
    els.bagType.innerHTML = "";
    types.forEach(t=>{ const o=document.createElement("option"); o.value=t; o.textContent=t; els.bagType.appendChild(o); });
  }

  function loadBagCellToInputs() {
    const club = els.bagClub ? els.bagClub.value : "Club?";
    const st = els.bagType ? els.bagType.value : "Type?";
    const exp = expectedFor(club, st);
    if(els.bagCarry) els.bagCarry.value = String(exp.carry || 0);
    if(els.bagTotal) els.bagTotal.value = String(exp.total || 0);
  }

  function saveBagCellFromInputs() {
    const club = els.bagClub ? els.bagClub.value : "Club?";
    const st = els.bagType ? els.bagType.value : "Type?";
    const carry = clampInt(els.bagCarry ? els.bagCarry.value : 0, 0, 1200) ?? 0;
    const total = clampInt(els.bagTotal ? els.bagTotal.value : 0, 0, 1200) ?? 0;
    if(!state.bag.bag) state.bag.bag = {};
    if(!state.bag.bag[club]) state.bag.bag[club] = {};
    state.bag.bag[club][st] = { carry:carry, total:total };
    saveBagOverride(state);
    saveState();
    toast("Saved");
    renderCaddy();
  }

  function openBag() {
    if(!els.bagBackdrop || !els.bagSheet) return;
    fillBagSelectors();
    loadBagCellToInputs();
    els.bagBackdrop.classList.remove("hidden");
    els.bagSheet.classList.remove("hidden");
  }

  function closeBag() {
    if(els.bagBackdrop) els.bagBackdrop.classList.add("hidden");
    if(els.bagSheet) els.bagSheet.classList.add("hidden");
  }

  function uiRender() {
    if(!state) return;
    cacheEls();
    const h = hole();
    const course = loadCourseName();

    if(els.sbHole) els.sbHole.textContent = String(h.hole);
    if(els.sbShots) els.sbShots.textContent = String(h.shots.length);
    if(els.sbTotal) els.sbTotal.textContent = String(h.shots.length);
    if(els.sbCourse) els.sbCourse.textContent = course ? "OK" : "--";

    if(els.roundInfo) {
      const d = new Date(state.round.startedAt);
      els.roundInfo.textContent = "Round " + d.toLocaleString();
    }

    const tf = getToFlagYards();
    if(els.toFlag) els.toFlag.textContent = (tf == null) ? "--" : String(tf);

    const accY = gps.lastFix ? gps.lastFix.accY : null;
    if(els.accTag) {
      const cls = accClass(accY);
      els.accTag.classList.remove("good","warn","bad");
      els.accTag.classList.add(cls);
      els.accTag.textContent = (accY == null) ? "acc --y" : ("acc " + accY + "y");
    }

    ensureAttempt();

    setLit(els.btnTee, !!h.tee);
    setLit(els.btnFlag, !!h.flag);
    if(els.btnFwy) els.btnFwy.classList.toggle("toggleOn", !!h.fwy);
    if(els.btnGir) els.btnGir.classList.toggle("toggleOn", !!h.gir);

    if(els.par) els.par.value = h.par ? String(h.par) : "";
    if(els.holeYds) els.holeYds.value = h.yards ? String(h.yards) : "";

    if(els.shotsList) {
      els.shotsList.innerHTML = "";
      if(!h.shots.length) {
        const empty = document.createElement("div");
        empty.style.padding = "10px 2px";
        empty.style.color = "var(--muted)";
        empty.style.fontWeight = "850";
        empty.textContent = "No shots yet.";
        els.shotsList.appendChild(empty);
      } else {
        h.shots.forEach((s, idx)=>{
          const row = document.createElement("div");
          row.className = "shotRow";

          const left = document.createElement("div");
          left.className = "left";

          const t1 = document.createElement("span"); t1.className="tag"; t1.textContent = "#" + (idx+1);
          const t2 = document.createElement("span"); t2.className="tag"; t2.textContent = s.penalty ? "PEN" : (s.club || "Club?");
          const t3 = document.createElement("span"); t3.className="tag"; t3.textContent = s.shotType || "Type?";
          const dist = document.createElement("span"); dist.className="dist"; dist.textContent = s.penalty ? "—" : (String(s.distance || 0) + "y");

          left.appendChild(t1); left.appendChild(t2); left.appendChild(t3); left.appendChild(dist);

          const right = document.createElement("div");
          const inp = document.createElement("input");
          inp.className = "editMini";
          inp.type = "number";
          inp.inputMode = "numeric";
          inp.value = s.penalty ? "" : String(s.distance || 0);
          inp.placeholder = "y";
          inp.disabled = !!s.penalty;
          inp.addEventListener("change", ()=>{
            const v = saneYards(inp.value);
            s.distance = v ?? (s.distance || 0);
            saveState();
            uiRender();
          });
          right.appendChild(inp);

          row.appendChild(left);
          row.appendChild(right);
          els.shotsList.appendChild(row);
        });
      }
    }

    if(els.caddySheet && !els.caddySheet.classList.contains("hidden")) renderCaddy();
  }

  function bindEvents() {
    if(els.btnCourse) els.btnCourse.addEventListener("click", ()=>{ location.href="course-setup.html"; });

    if(els.btnTee) els.btnTee.addEventListener("click", toggleTee);
    if(els.btnFlag) els.btnFlag.addEventListener("click", toggleFlag);
    if(els.btnShot) els.btnShot.addEventListener("click", ()=>{ addShot({club:"Club?", shotType:"Type?", penalty:false}); });

    if(els.btnPen) els.btnPen.addEventListener("click", addPenalty);
    if(els.btnDel) els.btnDel.addEventListener("click", deleteLastShot);
    if(els.btnFwy) els.btnFwy.addEventListener("click", toggleFwy);
    if(els.btnGir) els.btnGir.addEventListener("click", toggleGir);

    if(els.par) els.par.addEventListener("input", ()=>{
      const d = String(els.par.value||"").replace(/\D/g,"").slice(0,1);
      els.par.value = d;
      hole().par = d ? Number(d) : 0;
      saveState();
      uiRender();
    });

    if(els.holeYds) els.holeYds.addEventListener("input", ()=>{
      const v = clampInt(els.holeYds.value, 0, 999) ?? 0;
      hole().yards = v;
      saveState();
    });

    if(els.btnCaddy) els.btnCaddy.addEventListener("click", openCaddy);
    if(els.btnCloseCaddy) els.btnCloseCaddy.addEventListener("click", closeCaddy);
    if(els.caddyBackdrop) els.caddyBackdrop.addEventListener("click", closeCaddy);

    if(els.btnMode) els.btnMode.addEventListener("click", ()=>{
      state.ui.caddyMode = (state.ui.caddyMode === "total") ? "carry" : "total";
      if(els.btnMode) els.btnMode.textContent = (state.ui.caddyMode==="total") ? "Total" : "Carry";
      saveState();
      renderCaddy();
    });

    if(els.btnShowAll) els.btnShowAll.addEventListener("click", ()=>{
      state.ui.showAll = !state.ui.showAll;
      if(els.btnShowAll) els.btnShowAll.textContent = state.ui.showAll ? "Within 10" : "Show All";
      saveState();
      renderCaddy();
    });

    if(els.btnResetAdj) els.btnResetAdj.addEventListener("click", ()=>{
      const tf = getToFlagYards();
      if(els.caddyTarget) els.caddyTarget.value = String(tf ?? 0);
      renderCaddy();
    });

    if(els.caddyTarget) els.caddyTarget.addEventListener("input", renderCaddy);

    if(els.btnBag) els.btnBag.addEventListener("click", ()=>{ closeCaddy(); openBag(); });

    if(els.btnCloseBag) els.btnCloseBag.addEventListener("click", ()=>{ closeBag(); openCaddy(); });
    if(els.bagBackdrop) els.bagBackdrop.addEventListener("click", ()=>{ closeBag(); });
    if(els.bagClub) els.bagClub.addEventListener("change", loadBagCellToInputs);
    if(els.bagType) els.bagType.addEventListener("change", loadBagCellToInputs);
    if(els.btnSaveBag) els.btnSaveBag.addEventListener("click", saveBagCellFromInputs);

    if(els.btnSaveCourse) els.btnSaveCourse.addEventListener("click", ()=>{
      const name = els.courseName ? els.courseName.value : "";
      saveCourseName(name);
      toast("Saved");
      uiRender();
    });
  }

  function boot() {
    state = loadJSON(LS_KEY) || defaultState();
    state.bag = buildBagFromConfig();
    applyBagOverride(state);
    saveState();

    cacheEls();
    if(els.courseName) els.courseName.value = loadCourseName();

    bindEvents();
    gps.start();
    uiRender();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
