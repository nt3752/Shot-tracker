const ROUNDS_KEY="shotTrackerRounds_v1"; // list + map in one
function nowIso(){ return new Date().toISOString(); }

export function loadRoundsIndex(){
  try{ const raw=localStorage.getItem(ROUNDS_KEY); return raw?JSON.parse(raw):{active:null, rounds:{}}; }catch{ return {active:null, rounds:{}}; }
}
export function saveRoundsIndex(idx){
  try{ localStorage.setItem(ROUNDS_KEY, JSON.stringify(idx)); }catch{}
}
export function listRounds(){
  const idx=loadRoundsIndex();
  const arr=Object.values(idx.rounds||{});
  arr.sort((a,b)=> (b.updatedAt||"").localeCompare(a.updatedAt||""));
  return arr;
}
export function createRound(title=""){
  const idx=loadRoundsIndex();
  const id = "r_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
  const name = title?.trim() || ("Round " + new Date().toLocaleString());
  idx.rounds[id] = {
    id, name,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    state: { currentHole:1, holes:{}, holeSummaries:[], selectedClub:null, selectedShotType:"full", manualValue:null, liveEnabled:true }
  };
  idx.active = id;
  saveRoundsIndex(idx);
  return idx.rounds[id];
}
export function loadRound(id){
  const idx=loadRoundsIndex();
  return idx.rounds?.[id] || null;
}
export function setActiveRound(id){
  const idx=loadRoundsIndex();
  if(idx.rounds?.[id]){
    idx.active = id;
    idx.rounds[id].updatedAt = nowIso();
    saveRoundsIndex(idx);
  }
}
export function deleteRound(id){
  const idx=loadRoundsIndex();
  if(idx.rounds?.[id]){
    delete idx.rounds[id];
    if(idx.active === id) idx.active = null;
    saveRoundsIndex(idx);
  }
}
export function saveRoundState(id, state){
  const idx=loadRoundsIndex();
  if(!idx.rounds?.[id]) return;
  idx.rounds[id].state = state;
  idx.rounds[id].updatedAt = nowIso();
  saveRoundsIndex(idx);
}
export function getActiveRoundId(){
  return loadRoundsIndex().active || null;
}
