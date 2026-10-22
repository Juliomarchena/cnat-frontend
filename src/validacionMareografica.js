/**
 * validacionMareografica.js — compara la estimación del simulador con lo observado en mareógrafos IOC.
 * Las series IOC vienen en metros brutos, sin datum común: se filtra la marea con un promedio móvil
 * y se trabaja con la anomalía. La amplitud observada es el máximo |anomalía| tras la llegada.
 */

// Puerto del simulador → código de estación IOC (solo las que el backend captura)
export const PORT_STATION={callao:'call',paita:'paita',salaverry:'salav',chimbote:'chimb',pisco:'pisco',matarani:'mata'};

const MIN=60000, HR=3600000;
const MARGIN_HRS=5;        // margen antes del sismo (ruido de fondo + borde del promedio móvil)
const POST_HRS=14;         // ventana de búsqueda tras el ETA estimado
const TIDE_WINDOW_MIN=180; // promedio móvil que elimina la marea

export const parseEventTime=(s)=>{
  const t=Date.parse(String(s||'').replace(' UTC','Z').replace(' ','T'));
  return Number.isNaN(t)?null:t;
};

// Promedio móvil centrado en una ventana de tiempo (puntero doble, tolera huecos)
export function detide(points,windowMin=TIDE_WINDOW_MIN){
  const half=windowMin*MIN/2,out=[];
  let lo=0,hi=0,sum=0,n=0;
  for(let i=0;i<points.length;i++){
    const t=points[i][0];
    while(hi<points.length&&points[hi][0]<=t+half){sum+=points[hi][1];n++;hi++;}
    while(lo<hi&&points[lo][0]<t-half){sum-=points[lo][1];n--;lo++;}
    out.push([t,points[i][1]-sum/n]);
  }
  return out;
}

const std=(a)=>{if(a.length<5)return 0;const m=a.reduce((x,y)=>x+y,0)/a.length;return Math.sqrt(a.reduce((x,y)=>x+(y-m)**2,0)/a.length);};

// points: [[tMs,valorM],...] ordenados. Devuelve null si no hay datos suficientes.
export function analyzeSeries(points,originMs,etaEstHrs){
  if(!points||points.length<120)return null;
  const anom=detide(points);
  const quiet=anom.filter(([t])=>t>=originMs-3*HR&&t<originMs).map(p=>p[1]);
  const sigma=std(quiet);
  const thr=Math.max(0.05,4*sigma);
  const from=originMs+Math.max(0.5,etaEstHrs*0.6)*HR;
  const to=originMs+(etaEstHrs+POST_HRS)*HR;
  const win=anom.filter(([t])=>t>=from&&t<=to);
  if(win.length<30)return null;
  const hit=win.find(([,v])=>Math.abs(v)>=thr);
  if(!hit)return{detected:false,thr,sigma,points:win.length};
  const after=win.filter(([t])=>t>=hit[0]);
  const amp=Math.max(...after.map(([,v])=>Math.abs(v)));
  return{detected:true,arrivalHrs:(hit[0]-originMs)/HR,amplitude:amp,thr,sigma,points:win.length};
}

// Lee la serie desde Supabase (vista sea_level_readings, lectura para usuarios autenticados)
export async function fetchSeries(supabase,code,originMs,etaEstHrs){
  const t0=new Date(originMs-MARGIN_HRS*HR).toISOString();
  const t1=new Date(originMs+(etaEstHrs+POST_HRS+2)*HR).toISOString();
  const rows=[];
  for(let from=0;from<20000;from+=1000){
    const{data,error}=await supabase.from('sea_level_readings')
      .select('sensor,reading_time,value_m').eq('station_code',code)
      .gte('reading_time',t0).lte('reading_time',t1)
      .order('reading_time',{ascending:true}).range(from,from+999);
    if(error)throw new Error(error.message);
    rows.push(...data);
    if(data.length<1000)break;
  }
  const bySensor={};
  rows.forEach(r=>{(bySensor[r.sensor]=bySensor[r.sensor]||[]).push([Date.parse(r.reading_time),Number(r.value_m)]);});
  const best=Object.values(bySensor).sort((a,b)=>b.length-a.length)[0];
  return best||[];
}

// ports: salida de calcETAs. Devuelve una fila por puerto con estimado y observado.
export async function validateEvent(supabase,event,ports){
  const originMs=parseEventTime(event.date);
  if(originMs==null)return[];
  return Promise.all(ports.map(async p=>{
    const code=PORT_STATION[p.id];
    const base={id:p.id,name:p.name,etaEstHrs:p.etaHrs,hEst:Number(p.coastHeight),hLegacy:Number(p.coastHeightLegacy)};
    if(!code)return{...base,status:'sin estación'};
    try{
      const pts=await fetchSeries(supabase,code,originMs,p.etaHrs);
      const r=analyzeSeries(pts,originMs,p.etaHrs);
      if(!r)return{...base,status:'sin datos'};
      if(!r.detected)return{...base,status:'sin señal',thr:r.thr};
      return{...base,status:'ok',etaObsHrs:r.arrivalHrs,hObs:r.amplitude,thr:r.thr};
    }catch(e){return{...base,status:'error: '+e.message};}
  }));
}
