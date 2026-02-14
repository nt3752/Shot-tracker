window.SHOT_TRACKER_VERSION = "v36_18"; console.log("Shot Tracker", window.SHOT_TRACKER_VERSION);


// ---- Distance unit helpers (yards internal, feet for putter) ----
function yardsToFeet(y){ return Math.round((y||0) * 3); }
function feetToYards(ft){ return (ft||0) / 3; }
function isPutter(club){ return club === "PT"; }
import { distanceYds, getFix, startWatch } from "./gps.js";
import { buildCSV } from "./csv.js";
import { listRounds, createRound, loadRound, setActiveRound, deleteRound, saveRoundState, getActiveRoundId } from "./rounds.js";
import { loadCourseStore, saveCourseStore, listCourses, getCourseHole, setCourseHoleTee, setCourseHoleFlag, setCourseHoleYards, setCourseHolePar, setActiveCourse, createCourse, clearActiveCourseData, getActiveCourse } from "./courseProfile.js";

const $ = (id) => document.getElementById(id);
const els = {
  liveBadge: $("liveBadge"),
  holeNum: $("holeNum"),
  shotCount: $("shotCount"),
  totalShots: $("totalShots"),
  roundName: $("roundName"),
  par3: $("par3"), par4: $("par4"), par5: $("par5"),
  fw: $("fw"), gir: $("gir"),
  holeYards: $("holeYards"),

  manualWrap: $("manualWrap"),
  manualInput: $("manualInput"),
  manualUnit: $("manualUnit"),
  toFlag: $("toFlag"),
  markTee: $("markTee"),
  markFlag: $("markFlag"),
  markShot: $("markShot"),
  addPenalty: $("addPenalty"),
  deleteLast: $("deleteLast"),
  prev: $("prev"),
  next: $("next"),
  exportBtn: $("export"),
  resetRound: $("resetRound"),
  newRound: $("newRound"),
  shotsList: $("shotsList"),
  toast: $("toast"),
  roundModal: $("roundModal"),
  roundList: $("roundList"),
  roundTitleInput: $("roundTitleInput"),
  courseSelect: $("courseSelect"),
  courseName: $("courseName"),
  addCourse: $("addCourse"),
  clearCourse: $("clearCourse"),
  courseSetup: $("courseSetup"),
  startNewBtn: $("startNewBtn"),
  closeModal: $("closeModal"),
};

function toast(msg, ms=2200){
  els.toast.textContent = msg;
  els.toast.style.display = "block";
  setTimeout(()=>els.toast.style.display="none", ms);
}

// --- UI feedback helpers ---
function flashButton(btn, ms=90){
  if(!btn) return;
  btn.classList.add("btn-flash");
  setTimeout(()=>btn.classList.remove("btn-flash"), ms);
}

function setBtnLit(btn, lit){
  if(!btn) return;
  btn.classList.toggle("btn-is-set", !!lit);
  btn.setAttribute("aria-pressed", lit ? "true" : "false");
}

// Keep tee/flag buttons in sync with stored hole state
function updateTeeFlagButtons(){
  try{
    ensureHole(currentHole);
    const h = holes[currentHole] || {};
    setBtnLit(els.markTee, !!h.teeBox);
    setBtnLit(els.markFlag, !!h.flag);
  } catch(e) {
    // if state not ready yet, ignore
  }
}


let activeRoundId = null;
let roundMeta = null;

// Round state
let currentHole = 1;
let holes = {};
let holeSummaries = [];
let manualValue = null;
let liveEnabled = true;

// Dropdown options for per-shot reconciliation (configured via config.js if present)
const CFG = window.APP_CONFIG || {};
const DEFAULT_CLUB = (CFG.defaults && CFG.defaults.club) ? CFG.defaults.club : "Club?";
const DEFAULT_SHOT_TYPE = (CFG.defaults && CFG.defaults.shotType) ? CFG.defaults.shotType : "Type?";
const MAX_HOLES = 18;

const _DEFAULT_CLUBS = ["D","MD","3W","5W","7W","3H","5H","4I","5I","6I","7I","8I","9I","PW","46","56","60","PT"];
const _DEFAULT_TYPES = ["Type?","3/4","1/2","full","pitch","chip","putt","penalty"];

const CLUB_OPTIONS = [DEFAULT_CLUB, ...((CFG.clubs && Array.isArray(CFG.clubs)) ? CFG.clubs : _DEFAULT_CLUBS)]
  .filter((v, i, a) => a.indexOf(v) === i);
if(!CLUB_OPTIONS.includes("N/A")) CLUB_OPTIONS.splice(1,0,"N/A");


const SHOT_TYPE_OPTIONS = [...((CFG.shotTypes && Array.isArray(CFG.shotTypes)) ? CFG.shotTypes : _DEFAULT_TYPES)]
  .filter((v, i, a) => a.indexOf(v) === i);

if(!SHOT_TYPE_OPTIONS.includes("penalty")) SHOT_TYPE_OPTIONS.push("penalty");


function isPenaltyShot(s){
  return !!(s && (s.isPenalty===true || (s.shotType||"") === "penalty"));
}


let lastNonPenaltyPos = null;
let currentPos = null;
let watchId = null;
let lastBadgeYds = null;
let lastBadgeTs = 0;

let courseStore = loadCourseStore();


function renderCourseSelect(){
  if(!els.courseSelect) return;
  const courses = listCourses(courseStore);
  const active = getActiveCourse(courseStore);
  els.courseSelect.innerHTML = "";
  for(const c of courses){
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name || "Course";
    if(active && c.id === active.id) opt.selected = true;
    els.courseSelect.appendChild(opt);
  }
  updateCourseName();
}


function updateCourseName(){
  if(!els.courseName) return;
  const active = getActiveCourse(courseStore);
  els.courseName.textContent = active?.name || "—";
}


function initCourseUI(){
  if(!els.courseSelect) return;
  renderCourseSelect();

  els.courseSelect.addEventListener("change", (e)=>{
    const id = e.target.value;
    setActiveCourse(courseStore, id);
    saveCourseStore(courseStore);
    toast(`⛳ Course: ${getActiveCourse(courseStore)?.name || "Course"}`, 1600);
    // Refresh holes to pull tee/flag baselines for holes that don't have them in this round yet
    ensureHole(currentHole);
    renderShots();
    updateCourseName();
    updateToFlag();
  });

  if(els.addCourse){
    els.addCourse.addEventListener("click", ()=>{
      const name = prompt("New course name:", "");
      if(name === null) return;
      const c = createCourse(courseStore, name);
      saveCourseStore(courseStore);
      renderCourseSelect();
      updateCourseName();
      toast("✅ Course created", 1600);
      // Offer immediate setup for par/yards/handicap
      const go = confirm("Set up this course now?\n\nYou can enter par, yards, and handicap for each hole.");
      if(go){
        window.location.href = `./course-setup.html?course=${encodeURIComponent(c.id)}`;
        return;
      }
      ensureHole(currentHole);
      renderShots();
      updateToFlag();
    });
  }

  if(els.clearCourse){
    els.clearCourse.addEventListener("click", ()=>{
      const cname = getActiveCourse(courseStore)?.name || "this course";
      if(!confirm(`Clear saved tee/flag baselines for ${cname}?\n\nThis does NOT delete your rounds/shots.`)) return;
      clearActiveCourseData(courseStore);
      saveCourseStore(courseStore);

      // Also clear any baseline data already loaded into the current round state
      Object.values(holes).forEach(h=>{
        h.teeBox = null;
        h.flag = null;
        h.holeYards = null;
        h.par = 4;
      });
      syncRefForHole();
      renderShots();
      updateToFlag();
      save();

      toast("🧽 Course data cleared", 1800);
    });
  }

  if(els.courseSetup){
    els.courseSetup.addEventListener("click", ()=>{
      const active = getActiveCourse(courseStore);
      if(!active) return;
      window.location.href = `./course-setup.html?course=${encodeURIComponent(active.id)}`;
    });
  }

}

function ensureHole(n){
  if(!holes[n]) holes[n] = { holeNumber:n, par:null, _parUserSet:false, fairway:false, gir:false, holeYards:null, handicap:null, teeBox:null, flag:null, shots:[] };
  // If this round doesn't have baseline info yet, pull from saved course profile (option 2)
  const ch = getCourseHole(courseStore, n);
  if(ch){
    if(!holes[n].teeBox && ch.teeBox) holes[n].teeBox = ch.teeBox;
    if(!holes[n].flag && ch.flag) holes[n].flag = ch.flag;
    if((holes[n].holeYards==null || holes[n].holeYards==="") && ch.holeYards!=null) holes[n].holeYards = ch.holeYards;
    if(ch.par!=null && !holes[n]._parUserSet) holes[n].par = ch.par;
    if((holes[n].handicap==null) && ch.handicap!=null) holes[n].handicap = ch.handicap;
    if((holes[n].holeYards === null || holes[n].holeYards === "" || typeof holes[n].holeYards === "undefined") && ch.holeYards != null) holes[n].holeYards = ch.holeYards;
    if((holes[n].par === null || typeof holes[n].par === "undefined") && ch.par != null) holes[n].par = ch.par;
  }
}

function getState(){
  return { currentHole, holes, holeSummaries, manualValue, liveEnabled };
}

function setState(s){
  currentHole = s.currentHole || 1;
  holes = s.holes || {};
  holeSummaries = s.holeSummaries || [];
  manualValue = (s.manualValue !== undefined) ? s.manualValue : null;
  liveEnabled = (s.liveEnabled !== undefined) ? s.liveEnabled : true;
}

let _saveTimer = null;
function saveNow(){
  if(activeRoundId) saveRoundState(activeRoundId, getState());
}
function save(){
  if(!activeRoundId) return;
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(()=>saveRoundState(activeRoundId, getState()), 250);
}

function computeScore(h){
  const penaltyStrokes = (h.shots||[]).filter(s=>isPenaltyShot(s)).length;
  const nonPenalty = (h.shots||[]).filter(s=>!isPenaltyShot(s)).length;
  return { score: nonPenalty + penaltyStrokes, penaltyStrokes };
}

function recomputeHoleDistances(holeNum){
  const h = holes[holeNum];
  if(!h?.teeBox) return;

  let lastPos = { latitude: h.teeBox.latitude, longitude: h.teeBox.longitude };
  for(const s of (h.shots||[])){
    if(isPenaltyShot(s)){
      // Penalties should not affect sequencing or distance stats
      s.distance = 0;
      s.manualUnit = "";
      s.manualValue = "";
      s.club = "N/A";
      s.shotType = "penalty";
      s.isPenalty = true;
      continue;
    }

    const hasManual = (s.manualValue!=="" && s.manualValue!==null && typeof s.manualValue !== "undefined" && Number.isFinite(parseFloat(s.manualValue)));
    if(!Number.isFinite(s.latitude) || !Number.isFinite(s.longitude)) { continue; }

    const calc = lastPos ? Math.round(distanceYds(lastPos, s)*10)/10 : 0;
    if(!hasManual){
      s.distance = calc;
    }
    lastPos = { latitude: s.latitude, longitude: s.longitude };
    s.isPenalty = false;
  }
  lastNonPenaltyPos = lastPos;
}

function finalizeHoleSummary(holeNum){
  const h = holes[holeNum];
  if(!h) return;
  const { score, penaltyStrokes } = computeScore(h);
  const rec = {
    hole: holeNum,
    par: (h.par ?? 4),
    holeYards: (h.holeYards ?? null),
    score,
    fairway: h.fairway ? "YES" : "NO",
    gir: h.gir ? "YES" : "NO",
    penaltyStrokes,
    teeLat: h.teeBox?.latitude ?? "",
    teeLon: h.teeBox?.longitude ?? "",
    flagLat: h.flag?.latitude ?? "",
    flagLon: h.flag?.longitude ?? "",
    timestamp: new Date().toISOString()
  };
  const idx = holeSummaries.findIndex(r=>r.hole===holeNum);
  if(idx>=0) holeSummaries[idx]=rec; else holeSummaries.push(rec);
}


function updateMetaButtons(){
  const h=holes[currentHole];
  els.par3.classList.toggle("on", h.par===3);
  els.par4.classList.toggle("on", h.par===4);
  els.par5.classList.toggle("on", h.par===5);
  els.fw.classList.toggle("on", !!h.fairway);
  els.gir.classList.toggle("on", !!h.gir);
  els.holeYards.value = (h.holeYards ?? "");
}

function updateCounts(){
  const h=holes[currentHole];
  els.holeNum.textContent = String(currentHole);
  els.shotCount.textContent = String((h.shots||[]).length);
  const total = Object.values(holes).reduce((acc,hh)=>acc + (hh.shots?hh.shots.length:0), 0);
  els.totalShots.textContent = String(total);
}

function updateMarkShotEnabled(){
  const h=holes[currentHole];
  // Club selection is optional now (defaults to "Club?")
  // Manual distance is optional; distance will be prefilled from GPS calc and can be edited later.
  els.markShot.disabled = !(h.teeBox);
  els.markShot.textContent = "➕ Add Shot";
}

function shotDisplayDistance(s){
  if(typeof s.distance !== "number") return "";
  // Display feet for putter, yards otherwise
  if(isPutter(s.club)) return yardsToFeet(s.distance).toString();
  return (Math.round(s.distance*10)/10).toString();
}

function renderShots(){
  const h=holes[currentHole];
  updateCounts();
  updateMetaButtons();
  updateMarkShotEnabled();
  els.shotsList.innerHTML="";

  if(h.teeBox){
    const div=document.createElement("div");
    div.className="shotCard";
    div.innerHTML='<div class="shotLeft"><div class="shotTop">Tee Box</div><div class="shotSub">🏁 saved</div></div><div class="shotRight"></div>';
    els.shotsList.appendChild(div);
  }
  if(h.flag){
    const div=document.createElement("div");
    div.className="shotCard";
    div.innerHTML='<div class="shotLeft"><div class="shotTop">Flag</div><div class="shotSub">🚩 saved</div></div><div class="shotRight"></div>';
    els.shotsList.appendChild(div);
  }

  (h.shots||[]).forEach((s,i)=>{
    const div=document.createElement("div");
    div.className="shotCard";
    div.innerHTML = buildShotCardHTML(s, i);
    els.shotsList.appendChild(div);
  });

  updateTeeFlagButtons();
}

function buildShotCardHTML(s, i){
  const isPen = isPenaltyShot(s);
  const penalty = isPen ? " ⚠️" : "";
  const distVal = isPen ? "" : shotDisplayDistance(s);

  const clubVal = isPen ? "N/A" : (s.club || "Club?");
  const typeVal = isPen ? "penalty" : (s.shotType || DEFAULT_SHOT_TYPE);

  const clubSelect = `<select class="shotSelect clubSelect" data-idx="${i}" ${isPen?"disabled":""}>
    ${CLUB_OPTIONS.map(c=>`<option value="${c}" ${c===clubVal?"selected":""}>${c}</option>`).join("")}
  </select>`;

  const typeSelect = `<select class="shotSelect typeSelect" data-idx="${i}">
    ${SHOT_TYPE_OPTIONS.map(t=>`<option value="${t}" ${t===typeVal?"selected":""}>${t.toUpperCase()}</option>`).join("")}
  </select>`;

  const right = `<div class="shotRight">
      <input class="shotEdit" type="number" inputmode="decimal" data-edit-idx="${i}" value="${distVal}" placeholder="${(!isPen && (s.pendingGPS||s.gpsMissing) && distVal==='') ? (s.gpsMissing ? 'No GPS' : 'GPS…') : ''}" ${isPen?"disabled":""}>
      <div class="shotDist">${isPutter(clubVal) ? "ft" : "yds"}</div>
    </div>`;

  return `
    <div class="shotLeft">
      <div class="shotTop">${isPen?"Penalty":"Shot "+(i+1)}${penalty}</div>
      <div class="shotSubRow">
        ${clubSelect}
        ${typeSelect}
      </div>
    </div>
    ${right}
  `;
}

function appendShotCardForCurrentHole(){
  const h = holes[currentHole];
  if(!h?.shots?.length) return;
  const i = h.shots.length - 1;
  const s = h.shots[i];
  const div = document.createElement("div");
  div.className = "shotCard";
  div.innerHTML = buildShotCardHTML(s, i);
  els.shotsList.appendChild(div);
}

function syncRefForHole(){
  const h=holes[currentHole];
  lastNonPenaltyPos = null;
  if(h?.teeBox) lastNonPenaltyPos = { latitude:h.teeBox.latitude, longitude:h.teeBox.longitude };
  if(h?.shots?.length){
    for(let i=h.shots.length-1;i>=0;i--){ if(!isPenaltyShot(h.shots[i])){ lastNonPenaltyPos={ latitude:h.shots[i].latitude, longitude:h.shots[i].longitude }; break; } }
  }
  updateLiveBadge(true);
}


function getFlagPosForCurrentHole(){
  const h = holes?.[currentHole];
  if(h?.flag){ return { latitude: h.flag.latitude, longitude: h.flag.longitude }; }
  const ch = getCourseHole(courseStore, currentHole);
  if(ch?.flag){ return { latitude: ch.flag.latitude, longitude: ch.flag.longitude }; }
  return null;
}

function updateToFlag(){
  const flagPos = getFlagPosForCurrentHole();
  if(!flagPos || !currentPos){ els.toFlag.textContent = "To Flag:—"; return; }
  const yds = Math.round(distanceYds(currentPos, flagPos));
  els.toFlag.textContent = `To Flag:${yds}y`;
}

function updateLiveBadge(force=false){
  els.liveBadge.classList.toggle("on", liveEnabled);
  els.liveBadge.classList.toggle("off", !liveEnabled);
  if(!liveEnabled){ els.liveBadge.textContent="LIVE:OFF"; return; }
  if(!lastNonPenaltyPos || !currentPos){ els.liveBadge.textContent="LIVE:—"; return; }
  const yds = Math.round(distanceYds(lastNonPenaltyPos, currentPos));
  const now = Date.now();
  const movedEnough = (lastBadgeYds===null) || Math.abs(yds-lastBadgeYds)>=10;
  if(force || movedEnough || (now-lastBadgeTs)>2000){ lastBadgeYds=yds; lastBadgeTs=now; els.liveBadge.textContent=`LIVE:${yds}y`; }
}

let gpsIdleTimer = null;
const GPS_WARM_MS = 30000; // warm GPS for 30s after last button press (battery-friendly)

function stopWatch(){
  if(watchId!==null){
    try{ navigator.geolocation.clearWatch(watchId); }catch(_){}
    watchId = null;
  }
  if(gpsIdleTimer){ clearTimeout(gpsIdleTimer); gpsIdleTimer=null; }
}

function touchGps(){
  // Start GPS watch (if not already running) and keep it alive briefly.
  ensureWatch();
  if(gpsIdleTimer) clearTimeout(gpsIdleTimer);
  gpsIdleTimer = setTimeout(()=>stopWatch(), GPS_WARM_MS);
}

function ensureWatch(){
  if(watchId!==null) return;
  watchId = startWatch(
    (pos)=>{
      currentPos={ latitude:pos.coords.latitude, longitude:pos.coords.longitude, accuracy:Math.round(pos.coords.accuracy), timestamp:new Date().toISOString() };
      updateLiveBadge(false);
      updateToFlag();
    },
    (err)=>toast("❌ GPS error: " + (err.message||err), 3000),
    { enableHighAccuracy:true, maximumAge:2000, timeout:8000 }
  );
}

// ---- Round modal ----
function showModal(){ els.roundModal.classList.add("show"); els.roundModal.setAttribute("aria-hidden","false"); renderRoundList(); }
function hideModal(){ els.roundModal.classList.remove("show"); els.roundModal.setAttribute("aria-hidden","true"); }

function renderRoundList(){
  const rounds = listRounds();
  els.roundList.innerHTML="";
  if(!rounds.length){
    els.roundList.innerHTML = '<div class="modalText">No saved rounds yet.</div>';
    return;
  }
  rounds.forEach(r=>{
    const item=document.createElement("div");
    item.className="roundItem";
    item.innerHTML = `
      <div>
        <div class="roundName">${r.name}</div>
        <div class="roundMeta">Updated ${(r.updatedAt||"").replace("T"," ").slice(0,19)}</div>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="roundLoad" data-load="${r.id}" type="button">Load</button>
        <button class="roundDel" data-del="${r.id}" type="button">Delete</button>
      </div>
    `;
    els.roundList.appendChild(item);
  });
}

async function loadOrCreateInitialRound(){
  const active = getActiveRoundId();
  if(active){ 
    const r = loadRound(active);
    if(r) return activateRound(r);
  }
  // If there are any rounds, ask user; otherwise create new
  const rounds = listRounds();
  if(rounds.length) showModal();
  else activateRound(createRound(""));
}

function activateRound(r){
  activeRoundId = r.id;
  roundMeta = r;
  setActiveRound(r.id);
  setState(r.state || {});
  ensureHole(currentHole);
  ensureWatch();
  syncRefForHole();
  els.roundName.textContent = r.name;
  // restore UI selections
  updateLiveBadge(true);
  updateToFlag();
  renderShots();
  save();
  hideModal();
}

// Events
els.newRound.addEventListener("click", showModal);
els.resetRound.addEventListener("click", ()=>{
  // Keep old rounds for reporting/history; start a fresh blank round.
  const ok = confirm("Reset for a new round? (Your previous rounds stay saved.)");
  if(!ok) return;
  activateRound(createRound("")); 
});
els.closeModal.addEventListener("click", hideModal);
els.roundModal.addEventListener("click",(e)=>{ if(e.target===els.roundModal) hideModal(); });

els.startNewBtn.addEventListener("click", ()=>{
  const title = els.roundTitleInput.value || "";
  els.roundTitleInput.value="";
  activateRound(createRound(title));
});

els.roundList.addEventListener("click", (e)=>{
  const loadBtn = e.target.closest("button[data-load]");
  const delBtn = e.target.closest("button[data-del]");
  if(loadBtn){
    const r = loadRound(loadBtn.dataset.load);
    if(r) activateRound(r);
  }
  if(delBtn){
    const id = delBtn.dataset.del;
    deleteRound(id);
    renderRoundList();
  }
});

// Core events
els.liveBadge.addEventListener("click", ()=>{ liveEnabled=!liveEnabled; updateLiveBadge(true); save(); });
els.manualInput.addEventListener("input", ()=>{ const v=parseFloat(els.manualInput.value); manualValue = Number.isFinite(v)?v:null; updateMarkShotEnabled(); save(); });
els.shotsList.addEventListener("input", (e)=>{
  const inp = e.target.closest("input[data-edit-idx]");
  if(!inp) return;
  const idx = parseInt(inp.dataset.editIdx, 10);
  const v = parseFloat(inp.value);
  const shot = holes[currentHole].shots[idx];
  if(!shot) return;
  const num = Number.isFinite(v) ? v : 0;
  // Manual edit becomes source of truth (never overwritten by GPS recompute)
  shot._manualEdited = true;
  if(isPutter(shot.club)){
    shot.manualUnit = "ft";
    shot.manualValue = Math.round(num*10)/10;
    shot.distance = Math.round(feetToYards(num)*10)/10; // store yards internally
  } else {
    shot.manualUnit = "yds";
    shot.manualValue = Math.round(num*10)/10;
    shot.distance = Math.round(num*10)/10;
  }
  finalizeHoleSummary(currentHole);
  save();
});
els.shotsList.addEventListener("change", (e)=>{
  const sel = e.target.closest("select[data-idx]");
  if(!sel) return;
  const idx=parseInt(sel.dataset.idx,10);
  const shot = holes[currentHole].shots[idx];
  if(!shot) return;

  if(sel.classList.contains("clubSelect")){
    shot.club = sel.value || "Club?";
    // Re-render so distance unit/label updates when switching to/from PT
    renderShots();
  }
  if(sel.classList.contains("typeSelect")){
    const newType = (sel.value || DEFAULT_SHOT_TYPE);
    shot.shotType = newType;
    if(newType === "penalty"){
      // Penalty is 1 stroke by default. Add multiple penalty entries as needed.
      shot.club = "N/A";
      shot.isPenalty = true;
      shot.distance = 0;
      shot.manualUnit = "";
      shot.manualValue = "";
      // Recompute distances for the rest of the hole so penalties don't break sequencing.
      recomputeHoleDistances(currentHole);
    } else {
      // Switching away from penalty restores normal behavior.
      shot.isPenalty = false;
      if(shot.club === "N/A") shot.club = DEFAULT_CLUB;
      // If there was no manual distance, recompute from last non-penalty reference.
      recomputeHoleDistances(currentHole);
    }
  }
  finalizeHoleSummary(currentHole);
  save();
});


els.par3.addEventListener("click", ()=>{ holes[currentHole].par=3; holes[currentHole]._parUserSet=true; setCourseHolePar(courseStore, currentHole, 3); saveCourseStore(courseStore); setCourseHolePar(courseStore, currentHole, 3); saveCourseStore(courseStore); finalizeHoleSummary(currentHole); save(); renderShots(); });
els.par4.addEventListener("click", ()=>{ holes[currentHole].par=4; holes[currentHole]._parUserSet=true; setCourseHolePar(courseStore, currentHole, 4); saveCourseStore(courseStore); setCourseHolePar(courseStore, currentHole, 4); saveCourseStore(courseStore); finalizeHoleSummary(currentHole); save(); renderShots(); });
els.par5.addEventListener("click", ()=>{ holes[currentHole].par=5; holes[currentHole]._parUserSet=true; setCourseHolePar(courseStore, currentHole, 5); saveCourseStore(courseStore); setCourseHolePar(courseStore, currentHole, 5); saveCourseStore(courseStore); finalizeHoleSummary(currentHole); save(); renderShots(); });
els.fw.addEventListener("click", ()=>{ holes[currentHole].fairway=!holes[currentHole].fairway; finalizeHoleSummary(currentHole); save(); renderShots(); });
els.gir.addEventListener("click", ()=>{ holes[currentHole].gir=!holes[currentHole].gir; finalizeHoleSummary(currentHole); save(); renderShots(); });
els.holeYards.addEventListener("input", ()=>{ const v=parseInt(els.holeYards.value,10); holes[currentHole].holeYards = Number.isFinite(v)?v:null; setCourseHoleYards(courseStore, currentHole, holes[currentHole].holeYards); saveCourseStore(courseStore); setCourseHoleYards(courseStore, currentHole, holes[currentHole].holeYards); saveCourseStore(courseStore); finalizeHoleSummary(currentHole); save(); });

els.markTee.addEventListener("click", async ()=>{
  flashButton(els.markTee);
  try{
    touchGps();
    ensureHole(currentHole);
    const h = holes[currentHole];

    // Toggle OFF only if there are no shots yet (tee is used for distance calculations)
    if(h.teeBox){
      const hasShots = (h.shots||[]).some(s=>!isPenaltyShot(s));
      if(hasShots){
        toast("⚠️ Tee locked (shots already recorded)", 2200);
        updateTeeFlagButtons();
        return;
      }
      h.teeBox = null;
      setCourseHoleTee(courseStore, currentHole, null);
      saveCourseStore(courseStore);
      lastNonPenaltyPos = null;
      toast("🧹 Tee cleared", 1600);
      finalizeHoleSummary(currentHole);
      save();
      renderShots();
      updateTeeFlagButtons();
      updateToFlag();
      return;
    }

    const pos = await getFix({ maximumAge: 2000, timeout: 8000 });
    const tee={ latitude:pos.coords.latitude, longitude:pos.coords.longitude, accuracy:Math.round(pos.coords.accuracy), timestamp:new Date().toISOString() };
    h.teeBox=tee;
    setCourseHoleTee(courseStore, currentHole, tee);
    saveCourseStore(courseStore);
    lastNonPenaltyPos={ latitude:tee.latitude, longitude:tee.longitude };
    toast(`✅ Tee marked (±${tee.accuracy}m)`);
    finalizeHoleSummary(currentHole);
    save();
    renderShots();
    updateLiveBadge(true);
    updateTeeFlagButtons();
    updateToFlag();
  } catch(err){
    toast("No GPS yet", 1800);
  }
});


els.markFlag.addEventListener("click", async ()=>{
  flashButton(els.markFlag);
  try{
    touchGps();
    ensureHole(currentHole);
    const h = holes[currentHole];

    // Toggle OFF allowed anytime
    if(h.flag){
      h.flag = null;
      setCourseHoleFlag(courseStore, currentHole, null);
      saveCourseStore(courseStore);
      toast("🧹 Flag cleared", 1600);
      finalizeHoleSummary(currentHole);
      save();
      renderShots();
      updateTeeFlagButtons();
      updateToFlag();
      return;
    }

    const pos = await getFix({ maximumAge: 2000, timeout: 8000 });
    const flag={ latitude:pos.coords.latitude, longitude:pos.coords.longitude, accuracy:Math.round(pos.coords.accuracy), timestamp:new Date().toISOString() };
    h.flag=flag;
    setCourseHoleFlag(courseStore, currentHole, flag);
    saveCourseStore(courseStore);
    toast(`✅ Flag marked (±${flag.accuracy}m)`);
    finalizeHoleSummary(currentHole);
    save();
    renderShots();
    updateTeeFlagButtons();
    updateToFlag();
  } catch(err){
    toast("No GPS yet", 1800);
  }
});


els.markShot.addEventListener("click", async ()=>{
  flashButton(els.markShot);
  try{
    touchGps();
    const h=holes[currentHole];
    if(!h.teeBox) return toast("⚠️ Mark tee first",2200);

    const club = DEFAULT_CLUB;
    const shotType = DEFAULT_SHOT_TYPE;

    // 1) Add placeholder row immediately so you know the press registered
    const shot={
      id: crypto.randomUUID(),
      club,
      shotType,
      latitude:null,
      longitude:null,
      accuracy:null,
      timestamp:new Date().toISOString(),
      isPenalty:false,
      pendingGPS:true,
      gpsMissing:false,
      manualUnit:"",
      manualValue:""
    };

    h.shots.push(shot);
    toast("📍 Shot added (getting GPS…)", 900);
    finalizeHoleSummary(currentHole);
    save();

    // Fast UI: append placeholder row now
    updateCounts();
    updateMetaButtons();
    updateMarkShotEnabled();
    appendShotCardForCurrentHole();
    updateLiveBadge(true);

    // 2) Get GPS fix (may take a moment)
    let pos = null;
    try{
      pos = await getFix({ maximumAge: 2000, timeout: 8000 });
    }catch(_){
      pos = null;
    }

    if(!pos){
      shot.pendingGPS = false;
      shot.gpsMissing = true;
      save();
      refreshLastShotCard();
      return toast("No GPS yet", 1800);
    }

    // 3) Fill in GPS values
    shot.latitude = pos.coords.latitude;
    shot.longitude = pos.coords.longitude;
    shot.accuracy = Math.round(pos.coords.accuracy);
    shot.pendingGPS = false;
    shot.gpsMissing = false;

    // 4) Compute distance unless user already manually edited this shot
    const hasManual = (shot._manualEdited===true) || (shot.manualValue!=="" && shot.manualValue!==null && typeof shot.manualValue !== "undefined" && Number.isFinite(parseFloat(shot.manualValue)));
    const calcYds = lastNonPenaltyPos ? Math.round(distanceYds(lastNonPenaltyPos, shot)*10)/10 : 0;

    // If a per-shot manual override is set in the manual input box, apply it once to THIS shot.
    if(manualValue!==null && Number.isFinite(manualValue) && manualValue>=0){
      shot._manualEdited = true;
      shot.manualUnit = "yds";
      shot.manualValue = Math.round(manualValue*10)/10;
      shot.distance = Math.round(shot.manualValue*10)/10;
    } else if(!hasManual){
      shot.distance = Math.round(calcYds*10)/10;
    }

    // Update last non-penalty position for subsequent shots
    lastNonPenaltyPos = { latitude: shot.latitude, longitude: shot.longitude };

    finalizeHoleSummary(currentHole);
    save();
    refreshLastShotCard();
    updateToFlag();

  } catch(err){
    toast("❌ " + (err?.message||err), 2500);
  }
});


if(els.addPenalty){
  els.addPenalty.addEventListener("click", ()=>{
    try{
      ensureHole(currentHole);
      const h = holes[currentHole];
      const shot = {
        id: crypto.randomUUID(),
        club: "N/A",
        shotType: "penalty",
        isPenalty: true,
        timestamp: new Date().toISOString()
      };
      // No GPS / no distance for penalties
      h.shots.push(shot);

      // Recompute distances so subsequent shots measure from last real shot
      recomputeHoleDistances(currentHole);
      finalizeHoleSummary(currentHole);
      save();
      renderShots();
      toast("⚠️ Penalty +1", 1400);
    }catch(e){
      toast("❌ Penalty error", 2200);
    }
  });
}

els.deleteLast.addEventListener("click", ()=>{
  const h=holes[currentHole];
  if(!h.shots.length) return toast("Nothing to delete",1500);
  h.shots.pop();
  syncRefForHole();
  finalizeHoleSummary(currentHole); save(); renderShots();
  toast("🗑 Deleted last",1500);
});

els.prev.addEventListener("click", ()=>{
  finalizeHoleSummary(currentHole);
  currentHole = (currentHole<=1) ? MAX_HOLES : (currentHole-1);
  ensureHole(currentHole);
  syncRefForHole();
  save(); renderShots();
  updateToFlag();
});

els.next.addEventListener("click", ()=>{
  finalizeHoleSummary(currentHole); // creates/updates HOLE_SUMMARY record on Next (your earlier requirement)
  currentHole = (currentHole>=MAX_HOLES) ? 1 : (currentHole+1);
  ensureHole(currentHole);
  syncRefForHole();
  save(); renderShots();
  updateToFlag();
});

els.exportBtn.addEventListener("click", ()=>{
  finalizeHoleSummary(currentHole);
  Object.keys(holes).forEach(k=>finalizeHoleSummary(parseInt(k,10)));
  saveNow();
  const csv = buildCSV(holes, holeSummaries);
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=`round_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  toast("✅ CSV downloaded",2000);
});

// Init
initCourseUI();
ensureWatch();
loadOrCreateInitialRound();

// Service worker disabled for performance on iOS (can be re-enabled later).
if("serviceWorker" in navigator){
  navigator.serviceWorker.getRegistrations?.().then(rs=>rs.forEach(r=>r.unregister())).catch(()=>{});
}



document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='hidden'){ stopWatch(); } });
