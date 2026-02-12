import { distanceYds, getFix, startWatch } from "./gps.js";
import { listRounds, createRound, loadRound, setActiveRound, saveRoundState, getActiveRoundId } from "./rounds.js";
import { loadCourseStore, saveCourseStore, getActiveCourse, getCourseHole, setCourseHoleTee, setCourseHoleFlag } from "./courseProfile.js";

const $ = (id)=>document.getElementById(id);
const els = {
  courseName: $("courseName"),
  roundName: $("roundName"),
  holeNum: $("holeNum"),
  shotCount: $("shotCount"),
  liveBadge: $("liveBadge"),
  toFlag: $("toFlag"),
  prevHole: $("prevHole"),
  nextHole: $("nextHole"),
  markTee: $("markTee"),
  markFlag: $("markFlag"),
  markShot: $("markShot"),
  addPenalty: $("addPenalty"),
  deleteLast: $("deleteLast"),
  toast: $("toast"),
};

function toast(msg, ms=1800){
  els.toast.textContent = msg;
  els.toast.style.display = "block";
  setTimeout(()=>els.toast.style.display="none", ms);
}

// Round state (minimal)
let activeRoundId = null;
let roundMeta = null;
let currentHole = 1;
let holes = {};
let holeSummaries = []; // kept for compatibility if needed later
let liveEnabled = true;

let courseStore = loadCourseStore();

let lastNonPenaltyPos = null;
let currentPos = null;
let watchId = null;
let lastBadgeYds = null;
let lastBadgeTs = 0;

function isPenaltyShot(s){
  return !!(s && (s.isPenalty===true || (s.shotType||"")==="penalty"));
}

function ensureHole(n){
  if(!holes[n]) holes[n] = { holeNumber:n, par:4, fairway:false, gir:false, holeYards:null, handicap:null, teeBox:null, flag:null, shots:[] };
  // Prefill tee/flag from course baseline if not already in round
  const ch = getCourseHole(courseStore, n);
  if(ch){
    if(!holes[n].teeBox && ch.teeBox) holes[n].teeBox = ch.teeBox;
    if(!holes[n].flag && ch.flag) holes[n].flag = ch.flag;
  }
}

function getState(){
  return { currentHole, holes, holeSummaries, manualValue:null, liveEnabled };
}
function save(){
  if(activeRoundId) saveRoundState(activeRoundId, getState());
}

function updateCourseHeader(){
  const c = getActiveCourse(courseStore);
  els.courseName.textContent = c?.name || "—";
}
function updateRoundHeader(){
  els.roundName.textContent = roundMeta?.name || "—";
}

function updateCounts(){
  const h = holes[currentHole];
  els.holeNum.textContent = String(currentHole);
  els.shotCount.textContent = String((h?.shots||[]).length);
}

function syncRefForHole(){
  const h = holes[currentHole];
  lastNonPenaltyPos = null;
  if(h?.teeBox) lastNonPenaltyPos = { latitude:h.teeBox.latitude, longitude:h.teeBox.longitude };
  if(h?.shots?.length){
    for(let i=h.shots.length-1;i>=0;i--){
      if(!isPenaltyShot(h.shots[i])){ lastNonPenaltyPos = { latitude:h.shots[i].latitude, longitude:h.shots[i].longitude }; break; }
    }
  }
  updateLiveBadge(true);
}

function getFlagPosForCurrentHole(){
  const h = holes?.[currentHole];
  if(h?.flag) return { latitude:h.flag.latitude, longitude:h.flag.longitude };
  const ch = getCourseHole(courseStore, currentHole);
  if(ch?.flag) return { latitude: ch.flag.latitude, longitude: ch.flag.longitude };
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
  if(force || movedEnough || (now-lastBadgeTs)>2000){
    lastBadgeYds = yds; lastBadgeTs = now;
    els.liveBadge.textContent = `LIVE:${yds}y`;
  }
}

function ensureWatch(){
  if(watchId!==null) return;
  watchId = startWatch(
    (pos)=>{
      currentPos = { latitude:pos.coords.latitude, longitude:pos.coords.longitude, accuracy:Math.round(pos.coords.accuracy), timestamp:new Date().toISOString() };
      updateLiveBadge(false);
      updateToFlag();
    },
    (err)=>toast("❌ GPS: " + (err.message||err), 2400)
  );
}


function bestPos(maxAgeMs=6000){
  // Prefer the live watch position if it's recent enough; fallback to getFix().
  if(currentPos){
    const ts = currentPos.timestamp ? Date.parse(currentPos.timestamp) : NaN;
    const age = Number.isFinite(ts) ? (Date.now()-ts) : 0;
    if(age <= maxAgeMs) return currentPos;
  }
  return null;
}

function activateRound(r){
  activeRoundId = r.id;
  roundMeta = r;
  setActiveRound(r.id);
  currentHole = r.state?.currentHole || 1;
  holes = r.state?.holes || {};
  holeSummaries = r.state?.holeSummaries || [];
  liveEnabled = (r.state?.liveEnabled !== undefined) ? r.state.liveEnabled : true;

  ensureHole(currentHole);
  ensureWatch();
  syncRefForHole();
  updateCourseHeader();
  updateRoundHeader();
  updateCounts();
  updateToFlag();
  save();
}

function loadOrCreateRound(){
  const active = getActiveRoundId();
  if(active){
    const r = loadRound(active);
    if(r) return activateRound(r);
  }
  const rounds = listRounds();
  if(rounds.length){
    // Default to most recent round if available
    const r = loadRound(rounds[0].id);
    if(r) return activateRound(r);
  }
  activateRound(createRound(""));
}

// --- Button handlers ---
els.prevHole.addEventListener("click", ()=>{
  if(currentHole<=1) return toast("Hole 1", 900);
  currentHole -= 1;
  ensureHole(currentHole);
  syncRefForHole();
  updateCounts();
  updateToFlag();
  save();
});

els.nextHole.addEventListener("click", ()=>{
  currentHole += 1;
  ensureHole(currentHole);
  syncRefForHole();
  updateCounts();
  updateToFlag();
  save();
});

els.markTee.addEventListener("click", async ()=>{
  try{
    ensureWatch();
    let p = bestPos();
    if(!p){
      const pos = await getFix();
      p = { latitude:pos.coords.latitude, longitude:pos.coords.longitude, accuracy:Math.round(pos.coords.accuracy), timestamp:new Date().toISOString() };
    }
    const tee = { latitude:p.latitude, longitude:p.longitude, accuracy:(p.accuracy??0), timestamp:p.timestamp || new Date().toISOString() };
    ensureHole(currentHole);
    holes[currentHole].teeBox = tee;
    setCourseHoleTee(courseStore, currentHole, tee);
    saveCourseStore(courseStore);
    syncRefForHole();
    updateCounts();
    toast(`🏁 Tee (±${tee.accuracy}m)`);
    save();
  }catch(err){
    toast("❌ GPS: " + (err.message||err), 2400);
  }
});

els.markFlag.addEventListener("click", async ()=>{
  try{
    ensureWatch();
    let p = bestPos();
    if(!p){
      const pos = await getFix();
      p = { latitude:pos.coords.latitude, longitude:pos.coords.longitude, accuracy:Math.round(pos.coords.accuracy), timestamp:new Date().toISOString() };
    }
    const flag = { latitude:p.latitude, longitude:p.longitude, accuracy:(p.accuracy??0), timestamp:p.timestamp || new Date().toISOString() };
    ensureHole(currentHole);
    holes[currentHole].flag = flag;
    setCourseHoleFlag(courseStore, currentHole, flag);
    saveCourseStore(courseStore);
    updateToFlag();
    toast(`🚩 Flag (±${flag.accuracy}m)`);
    save();
  }catch(err){
    toast("❌ GPS: " + (err.message||err), 2400);
  }
});

els.markShot.addEventListener("click", async ()=>{
  try{
    ensureWatch();
    ensureHole(currentHole);
    const h = holes[currentHole];
    if(!h.teeBox) return toast("⚠️ Mark tee first", 1400);

    let p = bestPos();
    if(!p){
      const pos = await getFix();
      p = { latitude:pos.coords.latitude, longitude:pos.coords.longitude, accuracy:Math.round(pos.coords.accuracy), timestamp:new Date().toISOString() };
    }
    const shot = { id: crypto.randomUUID(), club:"Club?", shotType:"full", latitude:p.latitude, longitude:p.longitude, accuracy:(p.accuracy??0), timestamp:p.timestamp || new Date().toISOString(), isPenalty:false };

    // distance from last non-penalty reference
    const calc = lastNonPenaltyPos ? Math.round(distanceYds(lastNonPenaltyPos, shot)*10)/10 : 0;
    shot.distance = calc;
    shot.manualUnit = "";
    shot.manualValue = "";

    h.shots.push(shot);
    lastNonPenaltyPos = { latitude:shot.latitude, longitude:shot.longitude };
    updateCounts();
    updateLiveBadge(true);
    toast("➕ Shot");
    save();
  }catch(err){
    toast("❌ GPS: " + (err.message||err), 2400);
  }
});

els.addPenalty.addEventListener("click", ()=>{
  ensureHole(currentHole);
  const h = holes[currentHole];
  h.shots.push({ id: crypto.randomUUID(), club:"N/A", shotType:"penalty", isPenalty:true, timestamp:new Date().toISOString(), distance:0, manualUnit:"", manualValue:"" });
  syncRefForHole();
  updateCounts();
  toast("⚠️ +1");
  save();
});

els.deleteLast.addEventListener("click", ()=>{
  ensureHole(currentHole);
  const h = holes[currentHole];
  if(!h.shots.length) return toast("Nothing to undo", 1000);
  h.shots.pop();
  syncRefForHole();
  updateCounts();
  toast("🗑 Undid");
  save();
});

// Init
updateCourseHeader();
loadOrCreateRound();
ensureWatch();
