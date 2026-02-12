const KEY="shotTrackerActiveRound_v1";
export function saveActiveRoundId(id){ try{ localStorage.setItem(KEY, id); }catch{} }
export function loadActiveRoundId(){ try{ return localStorage.getItem(KEY); }catch{ return null; } }
