import { saveState, loadState } from "./storage.js";
import { distanceYds, getFix, startWatch } from "./gps.js";
import { buildCSV } from "./csv.js";

const $ = (id) => document.getElementById(id);
const els = {
  liveBadge: $("liveBadge"),
  holeNum: $("holeNum"),
  shotCount: $("shotCount"),
  totalShots: $("totalShots"),
  par3: $("par3"), par4: $("par4"), par5: $("par5"),
  fw: $("fw"), gir: $("gir"),
  holeYards: $("holeYards"),
  clubGrid: $("clubGrid"),
  shotTypeGrid: $("shotTypeGrid"),
  manualWrap: $("manualWrap"),
  manualInput: $("manualInput"),
  manualUnit: $("manualUnit"),
  markTee: $("markTee"),
  markFlag: $("markFlag"),
  markShot: $("markShot"),
  penalty: $("penalty"),
  deleteLast: $("deleteLast"),
  prev: $("prev"),
  next: $("next"),
  exportBtn: $("export"),
  shotsList: $("shotsList"),
  toast: $("toast"),
};

function toast(msg, ms=2200){
  els.toast.textContent = msg;
  els.toast.style.display = "block";
  setTimeout(()=>els.toast.style.display="none", ms);
}

let currentHole = 1;
let holes = {};
let holeSummaries = [];
let selectedClub = null;
let selectedShotType = "full";
let manualValue = null;
let liveEnabled = true;

let lastNonPenaltyPos = null;
let currentPos = null;
let watchId = null;
let lastBadgeYds = null;
let lastBadgeTs = 0;

function ensureHole(n){
  if(!holes[n]){
    holes[n] = { holeNumber:n, par:4, fairway:false, gir:false, holeYards:null, teeBox:null, flag:null, shots:[] };
  }
}

function save(){
  saveState({ currentHole, holes, holeSummaries, selectedClub, selectedShotType, manualValue, liveEnabled });
}

function load(){
  const d = loadState();
  if(!d) return;
  currentHole = d.currentHole || 1;
  holes = d.holes || {};
  holeSummaries = d.holeSummaries || [];
  selectedClub = d.selectedClub || null;
  selectedShotType = d.selectedShotType || "full";
  manualValue = (d.manualValue !== undefined) ? d.manualValue : null;
  liveEnabled = (d.liveEnabled !== undefined) ? d.liveEnabled : true;
}

function setSelectedShotType(type){
  selectedShotType = type;
  const needsManual = (selectedShotType !== "full");
  els.manualWrap.style.display = needsManual ? "flex" : "none";
  els.manualUnit.textContent = (selectedShotType === "putt") ? "ft" : "yds";
  els.manualInput.placeholder = (selectedShotType === "putt") ? "e.g. 12" : "e.g. 25";
  if(!needsManual){
    manualValue = null;
    els.manualInput.value = "";
  }
}

function resetSelectors(){
  selectedClub = null;
  setSelectedShotType("full");
  manualValue = null;
  els.clubGrid.querySelectorAll("button[data-club]").forEach(b=>b.classList.remove("selected"));
  els.shotTypeGrid.querySelectorAll("button[data-shot]").forEach(b=>b.classList.toggle("selected", b.dataset.shot === "full"));
  els.manualWrap.style.display = "none";
  els.manualInput.value = "";
  els.manualUnit.textContent = "yds";
  updateMarkShotEnabled();
}

function updateMetaButtons(){
  const h = holes[currentHole];
  els.par3.classList.toggle("on", h.par === 3);
  els.par4.classList.toggle("on", h.par === 4);
  els.par5.classList.toggle("on", h.par === 5);
  els.fw.classList.toggle("on", !!h.fairway);
  els.gir.classList.toggle("on", !!h.gir);
  els.holeYards.value = (h.holeYards ?? "");
}

function updateCounts(){
  const h = holes[currentHole];
  els.holeNum.textContent = String(currentHole);
  els.shotCount.textContent = String((h.shots||[]).length);
  const total = Object.values(holes).reduce((acc,hh)=>acc + (hh.shots?hh.shots.length:0), 0);
  els.totalShots.textContent = String(total);
}

function computeScore(h){
  const penaltyStrokes = (h.shots||[]).filter(s=>s.isPenalty).length;
  const nonPenalty = (h.shots||[]).filter(s=>!s.isPenalty).length;
  return { score: nonPenalty + penaltyStrokes, penaltyStrokes };
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

function updateMarkShotEnabled(){
  const h = holes[currentHole];
  const needsManual = (selectedShotType !== "full");
  const hasManual = (!needsManual) || (manualValue !== null && Number.isFinite(manualValue) && manualValue >= 0);
  els.markShot.disabled = !(h.teeBox && selectedClub && hasManual);
  els.markShot.textContent = "📍 Mark Shot";
}

function shotDisplayDistance(s){
  if(typeof s.distance !== "number") return "";
  return (Math.round(s.distance*10)/10).toString();
}

function renderShots(){
  const h = holes[currentHole];
  updateCounts();
  updateMetaButtons();
  updateMarkShotEnabled();
  els.shotsList.innerHTML = "";

  if(h.teeBox){
    const div=document.createElement("div");
    div.className="shotCard";
    div.innerHTML = '<div class="shotLeft"><div class="shotTop">Tee Box</div><div class="shotSub">🏁 saved</div></div><div class="shotRight"></div>';
    els.shotsList.appendChild(div);
  }
  if(h.flag){
    const div=document.createElement("div");
    div.className="shotCard";
    div.innerHTML = '<div class="shotLeft"><div class="shotTop">Flag</div><div class="shotSub">🚩 saved</div></div><div class="shotRight"></div>';
    els.shotsList.appendChild(div);
  }

  (h.shots||[]).forEach((s,i)=>{
    const div=document.createElement("div");
    div.className="shotCard";
    const st = (s.shotType && s.shotType !== "full") ? ` (${s.shotType.toUpperCase()})` : "";
    const penalty = s.isPenalty ? " ⚠️" : "";
    const distVal = shotDisplayDistance(s);
    const editable = (!s.isPenalty && s.shotType === "full");

    const right = editable
      ? `<div class="shotRight"><input class="shotEdit" type="number" inputmode="decimal" data-edit-idx="${i}" value="${distVal}"><div class="shotDist">yds</div></div>`
      : `<div class="shotRight"><div class="shotDist">${distVal} yds</div></div>`;

    div.innerHTML = `
      <div class="shotLeft">
        <div class="shotTop">Shot ${i+1}${penalty}</div>
        <div class="shotSub">${s.club || ""}${st}</div>
      </div>
      ${right}
    `;
    els.shotsList.appendChild(div);
  });
}

function syncRefForHole(){
  const h = holes[currentHole];
  lastNonPenaltyPos = null;
  if(h?.teeBox) lastNonPenaltyPos = { latitude: h.teeBox.latitude, longitude: h.teeBox.longitude };
  if(h?.shots?.length){
    for(let i=h.shots.length-1;i>=0;i--){
      if(!h.shots[i].isPenalty){
        lastNonPenaltyPos = { latitude: h.shots[i].latitude, longitude: h.shots[i].longitude };
        break;
      }
    }
  }
  updateLiveBadge(true);
}

function updateLiveBadge(force=false){
  els.liveBadge.classList.toggle("on", liveEnabled);
  els.liveBadge.classList.toggle("off", !liveEnabled);
  if(!liveEnabled){ els.liveBadge.textContent="LIVE:OFF"; return; }
  if(!lastNonPenaltyPos || !currentPos){ els.liveBadge.textContent="LIVE:—"; return; }
  const yds = Math.round(distanceYds(lastNonPenaltyPos, currentPos));
  const now = Date.now();
  const movedEnough = (lastBadgeYds === null) || Math.abs(yds-lastBadgeYds) >= 10;
  if(force || movedEnough || (now-lastBadgeTs)>2000){
    lastBadgeYds=yds; lastBadgeTs=now;
    els.liveBadge.textContent = `LIVE:${yds}y`;
  }
}

function ensureWatch(){
  if(watchId !== null) return;
  watchId = startWatch(
    (pos)=>{
      currentPos = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: Math.round(pos.coords.accuracy),
        timestamp: new Date().toISOString()
      };
      updateLiveBadge(false);
    },
    (err)=>toast("❌ GPS error: " + (err.message || err), 3000)
  );
}

// ---------- Events ----------
els.liveBadge.addEventListener("click", ()=>{ liveEnabled=!liveEnabled; updateLiveBadge(true); save(); });

els.clubGrid.addEventListener("click", (e)=>{
  const btn=e.target.closest("button[data-club]");
  if(!btn) return;
  selectedClub = btn.dataset.club;
  els.clubGrid.querySelectorAll("button[data-club]").forEach(b=>b.classList.toggle("selected", b===btn));
  updateMarkShotEnabled(); save();
});

els.shotTypeGrid.addEventListener("click", (e)=>{
  const btn=e.target.closest("button[data-shot]");
  if(!btn) return;
  setSelectedShotType(btn.dataset.shot);
  els.shotTypeGrid.querySelectorAll("button[data-shot]").forEach(b=>b.classList.toggle("selected", b===btn));
  updateMarkShotEnabled(); save();
});

els.manualInput.addEventListener("input", ()=>{
  const v=parseFloat(els.manualInput.value);
  manualValue = Number.isFinite(v) ? v : null;
  updateMarkShotEnabled(); save();
});

els.shotsList.addEventListener("input", (e)=>{
  const inp=e.target.closest("input[data-edit-idx]");
  if(!inp) return;
  const idx=parseInt(inp.dataset.editIdx,10);
  if(!Number.isFinite(idx)) return;
  const v=parseFloat(inp.value);
  holes[currentHole].shots[idx].distance = Number.isFinite(v) ? v : 0;
  finalizeHoleSummary(currentHole); save();
});

els.par3.addEventListener("click", ()=>{ holes[currentHole].par=3; finalizeHoleSummary(currentHole); save(); renderShots(); });
els.par4.addEventListener("click", ()=>{ holes[currentHole].par=4; finalizeHoleSummary(currentHole); save(); renderShots(); });
els.par5.addEventListener("click", ()=>{ holes[currentHole].par=5; finalizeHoleSummary(currentHole); save(); renderShots(); });
els.fw.addEventListener("click", ()=>{ holes[currentHole].fairway=!holes[currentHole].fairway; finalizeHoleSummary(currentHole); save(); renderShots(); });
els.gir.addEventListener("click", ()=>{ holes[currentHole].gir=!holes[currentHole].gir; finalizeHoleSummary(currentHole); save(); renderShots(); });
els.holeYards.addEventListener("input", ()=>{
  const v=parseInt(els.holeYards.value,10);
  holes[currentHole].holeYards = Number.isFinite(v) ? v : null;
  finalizeHoleSummary(currentHole); save();
});

els.markTee.addEventListener("click", async ()=>{
  try{
    ensureWatch();
    const pos=await getFix();
    const tee={
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: Math.round(pos.coords.accuracy),
      timestamp: new Date().toISOString()
    };
    holes[currentHole].teeBox=tee;
    lastNonPenaltyPos = { latitude: tee.latitude, longitude: tee.longitude };
    toast(`✅ Tee marked (±${tee.accuracy}m)`);
    finalizeHoleSummary(currentHole); save(); renderShots(); updateLiveBadge(true);
  }catch(err){ toast("❌ GPS: " + (err.message || err), 3000); }
});

els.markFlag.addEventListener("click", async ()=>{
  try{
    ensureWatch();
    const pos=await getFix();
    const flag={
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: Math.round(pos.coords.accuracy),
      timestamp: new Date().toISOString()
    };
    holes[currentHole].flag=flag;
    toast(`✅ Flag marked (±${flag.accuracy}m)`);
    finalizeHoleSummary(currentHole); save(); renderShots();
  }catch(err){ toast("❌ GPS: " + (err.message || err), 3000); }
});

els.markShot.addEventListener("click", async ()=>{
  try{
    ensureWatch();
    const h=holes[currentHole];
    if(!h.teeBox) return toast("⚠️ Mark tee first", 2200);
    if(!selectedClub) return toast("⚠️ Select a club", 2200);
    const needsManual = (selectedShotType !== "full");
    if(needsManual && !(manualValue!==null && Number.isFinite(manualValue) && manualValue>=0)){
      return toast("⚠️ Enter distance", 2200);
    }
    const pos=await getFix();
    const shot={
      club:selectedClub,
      shotType:selectedShotType,
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: Math.round(pos.coords.accuracy),
      timestamp: new Date().toISOString(),
      isPenalty:false
    };
    if(needsManual){
      const unit = (selectedShotType === "putt") ? "ft" : "yds";
      shot.manualUnit = unit;
      shot.manualValue = Math.round(manualValue*10)/10;
      const yds = (unit === "ft") ? (manualValue/3.0) : manualValue;
      shot.distance = Math.round(yds*10)/10;
    }else{
      shot.manualUnit = "";
      shot.manualValue = "";
      shot.distance = lastNonPenaltyPos ? Math.round(distanceYds(lastNonPenaltyPos, shot)*10)/10 : 0;
    }
    h.shots.push(shot);
    lastNonPenaltyPos = { latitude: shot.latitude, longitude: shot.longitude };
    toast("✅ Shot recorded");
    finalizeHoleSummary(currentHole); save(); renderShots(); updateLiveBadge(true);
    resetSelectors();
  }catch(err){ toast("❌ GPS: " + (err.message || err), 3000); }
});

els.penalty.addEventListener("click", ()=>{
  const h=holes[currentHole];
  if(!h.teeBox) return toast("⚠️ Mark tee first", 2200);
  const shot={
    club:"PENALTY",
    shotType:"penalty",
    latitude: currentPos?.latitude ?? "",
    longitude: currentPos?.longitude ?? "",
    accuracy: currentPos?.accuracy ?? "",
    timestamp: new Date().toISOString(),
    isPenalty:true,
    manualUnit:"",
    manualValue:"",
    distance:0
  };
  h.shots.push(shot);
  toast("⚠️ Penalty added");
  finalizeHoleSummary(currentHole); save(); renderShots();
});

els.deleteLast.addEventListener("click", ()=>{
  const h=holes[currentHole];
  if(!h.shots.length) return toast("Nothing to delete", 1500);
  h.shots.pop();
  syncRefForHole();
  finalizeHoleSummary(currentHole); save(); renderShots();
  toast("🗑 Deleted last", 1500);
});

els.prev.addEventListener("click", ()=>{
  if(currentHole<=1) return;
  finalizeHoleSummary(currentHole);
  currentHole -= 1;
  ensureHole(currentHole);
  syncRefForHole();
  resetSelectors();
  save(); renderShots();
});

els.next.addEventListener("click", ()=>{
  finalizeHoleSummary(currentHole);
  currentHole += 1;
  ensureHole(currentHole);
  syncRefForHole();
  resetSelectors();
  save(); renderShots();
});

els.exportBtn.addEventListener("click", ()=>{
  finalizeHoleSummary(currentHole);
  Object.keys(holes).forEach(k=>finalizeHoleSummary(parseInt(k,10)));
  save();
  const csv = buildCSV(holes, holeSummaries);
  const blob=new Blob([csv], {type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download = `round_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("✅ CSV downloaded", 2000);
});

// Init
load();
ensureHole(currentHole);
ensureWatch();
syncRefForHole();

setSelectedShotType(selectedShotType);
els.shotTypeGrid.querySelectorAll("button[data-shot]").forEach(b=>b.classList.toggle("selected", b.dataset.shot === selectedShotType));
if(selectedClub){
  els.clubGrid.querySelectorAll("button[data-club]").forEach(b=>b.classList.toggle("selected", b.dataset.club === selectedClub));
}
updateLiveBadge(true);
renderShots();

if("serviceWorker" in navigator){
  navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
}
