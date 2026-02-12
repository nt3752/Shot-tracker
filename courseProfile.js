const STORE_KEY = "shotTrackerCourseStore_v1";

/**
 * Course store shape:
 * {
 *   activeCourseId: "course_...",
 *   courses: {
 *     [id]: { id, name, holes: { "1": { teeBox, flag, holeYards, par, handicap }, ... } }
 *   }
 * }
 */

function makeId(){
  return "course_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,8);
}

function ensureDefault(store){
  if(!store || typeof store !== "object") store = {};
  if(!store.courses || typeof store.courses !== "object") store.courses = {};
  if(!store.activeCourseId) store.activeCourseId = Object.keys(store.courses)[0] || null;

  // If no courses exist, create a default one
  if(!store.activeCourseId || !store.courses[store.activeCourseId]){
    const id = makeId();
    store.courses[id] = { id, name: "Home", holes: {} };
    store.activeCourseId = id;
  }

  // Normalize holes container
  const active = store.courses[store.activeCourseId];
  if(!active.holes || typeof active.holes !== "object") active.holes = {};
  return store;
}

export function loadCourseStore(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    return ensureDefault(raw ? JSON.parse(raw) : null);
  }catch{
    return ensureDefault(null);
  }
}

export function saveCourseStore(store){
  try{
    localStorage.setItem(STORE_KEY, JSON.stringify(ensureDefault(store)));
  }catch{}
}

export function listCourses(store){
  store = ensureDefault(store);
  return Object.values(store.courses).map(c => ({ id: c.id, name: c.name || "Course" }));
}

export function getActiveCourse(store){
  store = ensureDefault(store);
  return store.courses[store.activeCourseId] || null;
}

export function setActiveCourse(store, id){
  store = ensureDefault(store);
  if(id && store.courses[id]){
    store.activeCourseId = id;
  }
  return getActiveCourse(store);
}

export function createCourse(store, name){
  store = ensureDefault(store);
  const id = makeId();
  store.courses[id] = { id, name: (name || "New Course").trim() || "New Course", holes: {} };
  store.activeCourseId = id;
  return store.courses[id];
}

export function deleteCourse(store, id){
  store = ensureDefault(store);
  if(!id || !store.courses[id]) return false;

  // Don't allow deleting the last remaining course.
  const ids = Object.keys(store.courses);
  if(ids.length <= 1) return false;

  delete store.courses[id];

  // If the deleted course was active, switch active to another existing course.
  if(store.activeCourseId === id){
    store.activeCourseId = Object.keys(store.courses)[0] || null;
  }

  // Ensure store still has a valid active course
  ensureDefault(store);
  return true;
}

export function clearActiveCourseData(store){
  store = ensureDefault(store);
  const active = getActiveCourse(store);
  if(active) active.holes = {};
}

export function getCourseHole(store, holeNumber){
  const active = getActiveCourse(store);
  if(!active) return null;
  return active.holes?.[String(holeNumber)] || null;
}

function ensureHole(store, holeNumber){
  const active = getActiveCourse(store);
  if(!active) return null;
  if(!active.holes) active.holes = {};
  const k = String(holeNumber);
  if(!active.holes[k]) active.holes[k] = {};
  return active.holes[k];
}

function cleanFix(fix){
  if(!fix) return null;
  return {
    latitude: fix.latitude,
    longitude: fix.longitude,
    accuracy: fix.accuracy,
    timestamp: fix.timestamp
  };
}

export function setCourseHoleTee(store, holeNumber, tee){
  const h = ensureHole(store, holeNumber);
  if(!h) return;
  h.teeBox = cleanFix(tee);
}

export function setCourseHoleFlag(store, holeNumber, flag){
  const h = ensureHole(store, holeNumber);
  if(!h) return;
  h.flag = cleanFix(flag);
}

export function setCourseHoleYards(store, holeNumber, holeYards){
  const h = ensureHole(store, holeNumber);
  if(!h) return;
  const v = parseInt(holeYards, 10);
  h.holeYards = Number.isFinite(v) ? v : null;
}

export function setCourseHolePar(store, holeNumber, par){
  const h = ensureHole(store, holeNumber);
  if(!h) return;
  const v = parseInt(par, 10);
  h.par = (v===3 || v===4 || v===5) ? v : null;
}

export function setCourseHoleHandicap(store, holeNumber, handicap){
  const h = ensureHole(store, holeNumber);
  if(!h) return;
  const v = parseInt(handicap, 10);
  // Handicap is typically 1-18 (or null)
  h.handicap = (Number.isFinite(v) && v>=1 && v<=18) ? v : null;
}
