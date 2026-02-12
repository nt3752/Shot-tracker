import { loadCourseStore, saveCourseStore, getActiveCourse, setActiveCourse, getCourseHole, setCourseHolePar, setCourseHoleYards, setCourseHoleHandicap, clearActiveCourseData, deleteCourse } from "./courseProfile.js";

const $ = (id)=>document.getElementById(id);

function getQueryParam(name){
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}

let store = loadCourseStore();

// If a course id is provided, make it active for setup.
const courseId = getQueryParam("course");
if(courseId){
  setActiveCourse(store, courseId);
  saveCourseStore(store);
}

const course = getActiveCourse(store);
const els = {
  courseName: $("courseName"),
  rows: $("rows"),
  saveBtn: $("saveBtn"),
  backBtn: $("backBtn"),
  clearBtn: $("clearBtn"),
  deleteCourseBtn: $("deleteCourseBtn"),
};

els.courseName.textContent = course?.name || "Course";

function holeRow(holeNum){
  const h = getCourseHole(store, holeNum) || {};
  const par = (h.par===3||h.par===4||h.par===5) ? h.par : "";
  const yards = (typeof h.holeYards === "number") ? h.holeYards : "";
  const hdcp = (typeof h.handicap === "number") ? h.handicap : "";

  const row = document.createElement("div");
  row.className = "grid row";
  row.innerHTML = `
    <div><strong>${holeNum}</strong></div>
    <div>
      <select data-par="${holeNum}">
        <option value=""></option>
        <option value="3" ${par===3?"selected":""}>3</option>
        <option value="4" ${par===4?"selected":""}>4</option>
        <option value="5" ${par===5?"selected":""}>5</option>
      </select>
    </div>
    <div><input data-yards="${holeNum}" type="number" inputmode="numeric" min="0" placeholder="e.g. 412" value="${yards}"></div>
    <div><input data-hdcp="${holeNum}" type="number" inputmode="numeric" min="1" max="18" placeholder="1–18" value="${hdcp}"></div>
  `;
  return row;
}

function render(){
  els.rows.innerHTML = "";
  for(let i=1;i<=18;i++){
    els.rows.appendChild(holeRow(i));
  }
}

function applyFromUI(){
  // Read values from the inputs and update store.
  for(let i=1;i<=18;i++){
    const parSel = els.rows.querySelector(`select[data-par="${i}"]`);
    const yardsInp = els.rows.querySelector(`input[data-yards="${i}"]`);
    const hdcpInp = els.rows.querySelector(`input[data-hdcp="${i}"]`);

    setCourseHolePar(store, i, parSel?.value ?? "");
    setCourseHoleYards(store, i, yardsInp?.value ?? "");
    setCourseHoleHandicap(store, i, hdcpInp?.value ?? "");
  }
}

els.saveBtn.addEventListener("click", ()=>{
  applyFromUI();
  saveCourseStore(store);
  els.saveBtn.textContent = "Saved ✓";
  setTimeout(()=>els.saveBtn.textContent="Save", 1200);
});

els.backBtn.addEventListener("click", ()=>{
  // Go back to main app (preserve as much as possible)
  window.location.href = "./index.html";
});

els.clearBtn.addEventListener("click", ()=>{
  const cname = course?.name || "this course";
  if(!confirm(`Clear setup (par/yards/handicap/tee/flag) for ${cname}?`)) return;
  clearActiveCourseData(store);
  saveCourseStore(store);
  
els.deleteCourseBtn?.addEventListener("click", ()=>{
  const c = getActiveCourse(store);
  const cname = c?.name || "this course";
  const ids = Object.keys(store.courses || {});
  if(ids.length <= 1){
    alert("You can’t delete the last remaining course.");
    return;
  }
  if(!confirm(`Delete course "${cname}"?\n\nThis removes saved par/yards/handicap/tee/flag for that course. Your rounds remain saved.`)) return;

  const ok = deleteCourse(store, c.id);
  saveCourseStore(store);

  if(!ok){
    alert("Could not delete this course.");
    return;
  }
  window.location.href = "./index.html";
});

render();
});


els.deleteCourseBtn?.addEventListener("click", ()=>{
  const c = getActiveCourse(store);
  const cname = c?.name || "this course";
  const ids = Object.keys(store.courses || {});
  if(ids.length <= 1){
    alert("You can’t delete the last remaining course.");
    return;
  }
  if(!confirm(`Delete course "${cname}"?\n\nThis removes saved par/yards/handicap/tee/flag for that course. Your rounds remain saved.`)) return;

  const ok = deleteCourse(store, c.id);
  saveCourseStore(store);

  if(!ok){
    alert("Could not delete this course.");
    return;
  }
  window.location.href = "./index.html";
});

render();
