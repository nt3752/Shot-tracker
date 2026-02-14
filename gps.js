export function toRad(x){return x*Math.PI/180;}
export function distanceYds(a,b){
  if(!a||!b) return 0;
  const R=6371000;
  const f1=toRad(a.latitude), f2=toRad(b.latitude);
  const df=toRad(b.latitude-a.latitude);
  const dl=toRad(b.longitude-a.longitude);
  const s=Math.sin(df/2)**2 + Math.cos(f1)*Math.cos(f2)*Math.sin(dl/2)**2;
  const c=2*Math.atan2(Math.sqrt(s), Math.sqrt(1-s));
  return (R*c)*1.09361;
}
export function getFix(opts={}){
  return new Promise((res,rej)=>{
    if(!navigator.geolocation) return rej(new Error("GPS not supported"));
    navigator.geolocation.getCurrentPosition(p=>res(p), e=>rej(e), {enableHighAccuracy:true, timeout:8000, maximumAge:2000, ...opts});
  });
}
export function startWatch(onFix,onError,opts={}){
  if(!navigator.geolocation){ onError?.(new Error("GPS not supported")); return null; }
  return navigator.geolocation.watchPosition(p=>onFix(p), e=>onError?.(e), {enableHighAccuracy:true, maximumAge:2000, timeout:8000, ...opts});
}
