export function buildCSV(holes, holeSummaries){
  const rows=[];
  rows.push("Hole,Par,ShotIndex,Club,ShotType,Penalty,ManualUnit,ManualValue,DistanceYds,Timestamp,AccuracyM,Latitude,Longitude");
  Object.values(holes).sort((a,b)=>a.holeNumber-b.holeNumber).forEach(h=>{
    const par=(h.par ?? 4);
    (h.shots||[]).forEach((s,i)=>{
      const dist=(typeof s.distance==="number")?s.distance:0;
      rows.push([
        h.holeNumber, par, i+1,
        s.club||"", (s.shotType||"full"),
        s.isPenalty?"YES":"",
        (s.manualUnit||""), (s.manualValue ?? ""),
        dist,
        (s.timestamp||""),
        (typeof s.accuracy==="number"?s.accuracy:""),
        (s.latitude ?? ""),
        (s.longitude ?? "")
      ].join(","));
    });
  });
  rows.push("");
  rows.push("HOLE_SUMMARY");
  rows.push("Hole,Par,HoleYards,Score,Fairway,GIR,PenaltyStrokes,TeeLat,TeeLon,FlagLat,FlagLon,Timestamp");
  (holeSummaries||[]).sort((a,b)=>a.hole-b.hole).forEach(r=>{
    rows.push([
      r.hole, r.par, (r.holeYards ?? ""),
      r.score, r.fairway, r.gir, r.penaltyStrokes,
      (r.teeLat ?? ""), (r.teeLon ?? ""),
      (r.flagLat ?? ""), (r.flagLon ?? ""),
      r.timestamp
    ].join(","));
  });
  return rows.join("\n");
}
