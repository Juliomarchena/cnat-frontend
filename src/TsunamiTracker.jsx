/**
 * TsunamiTracker.jsx — CNAT · MICROHELP v4.0
 * Réplica exacta del demo HTML:
 * - Proyección centrada en Pacífico (lon 100..300)
 * - GeoJSON real de continentes
 * - Arcos parabólicos (no círculos) con directividad focal
 * - Múltiples crestas de onda
 * - Flechas de dirección
 * - Línea de ruptura
 * - Countdown HUD completo
 */
import { useState, useEffect, useRef, useCallback } from "react";

// ─── FÍSICA (idéntica al demo) ────────────────────────
const G=9.81, ER=6371, OD=4000, D2R=Math.PI/180, R2D=180/Math.PI;
const waveSpeedKmh=(d=OD)=>Math.sqrt(G*d)*3.6;
const haversineKm=(la1,lo1,la2,lo2)=>{
  const dL=(la2-la1)*D2R,dO=(lo2-lo1)*D2R;
  const a=Math.sin(dL/2)**2+Math.cos(la1*D2R)*Math.cos(la2*D2R)*Math.sin(dO/2)**2;
  return ER*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
};
const bearingDeg=(la1,lo1,la2,lo2)=>{
  const p1=la1*D2R,p2=la2*D2R,dL=(lo2-lo1)*D2R;
  return(Math.atan2(Math.sin(dL)*Math.cos(p2),Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dL))*R2D+360)%360;
};
const dipDirection=(s)=>(s+90)%360;
const radiationPattern=(tb,st,rk=90)=>{
  const dd=dipDirection(st);let a=tb-dd;
  while(a>180)a-=360;while(a<-180)a+=360;
  return 0.15+0.85*Math.pow(Math.cos(Math.abs(a)*D2R),2)*Math.abs(Math.sin(rk*D2R));
};
const directionalRadiusFactor=(b,s,r=90)=>{
  const dd=dipDirection(s);let a=b-dd;
  while(a>180)a-=360;while(a<-180)a+=360;
  const cf=Math.cos(Math.abs(a)*D2R),rf=Math.abs(Math.sin(r*D2R));
  const ecc=0.15+0.10*rf;
  return 1.0-ecc*(1-Math.pow(cf,2));
};
const greensLaw=(h,dd=4000,cd=50)=>h*Math.pow(dd/cd,0.25);
const initWaveH=(m)=>m<6.5?0:Math.max(0.1,Math.pow(10,0.5*m-3.5));
const waveFrontRadiusKm=(eh)=>waveSpeedKmh(OD)*eh;
const hasWaveArrived=(epi,tgt,eh,fp)=>{
  const d=haversineKm(epi.lat,epi.lon,tgt.lat,tgt.lon);
  const b=bearingDeg(epi.lat,epi.lon,tgt.lat,tgt.lon);
  const df=directionalRadiusFactor(b,fp.strike,fp.rake);
  const effectiveDf=Math.max(0.72,df);
  return waveFrontRadiusKm(eh)*effectiveDf>=d;
};
const classifyAlert=(h)=>{
  if(h<0.3)return{level:0,color:'#4CAF50',label:'SIN AMENAZA'};
  if(h<1.0)return{level:1,color:'#FFEB3B',label:'AVISO'};
  if(h<3.0)return{level:2,color:'#FF9800',label:'ALERTA'};
  return{level:3,color:'#F44336',label:'ALARMA'};
};
const fmtHrs=(h)=>{if(h<0)return'--:--';const hh=Math.floor(h),mm=Math.floor((h-hh)*60);return`${hh}h ${String(mm).padStart(2,'0')}min`;};
const fmtCnt=(h)=>{if(h<=0)return'LLEGÓ';const hh=Math.floor(h),mm=Math.floor((h-hh)*60),ss=Math.floor(((h-hh)*60-mm)*60);return`${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;};
const ruptureEndpoints=(epi,strike,lengthKm)=>{
  const hl=lengthKm/2,sr=strike*D2R;
  const lf=111,of=111*Math.cos(epi.lat*D2R);
  const dL=(hl*Math.cos(sr))/lf,dO=(hl*Math.sin(sr))/of;
  return[{lat:epi.lat+dL,lon:epi.lon+dO},{lat:epi.lat-dL,lon:epi.lon-dO}];
};

// ─── PROYECCIÓN PACÍFICO (lon 100..300) ──────────────
const MC={lonMin:100,lonMax:300,latMin:-60,latMax:70,width:900,height:600};
const nL=(l)=>l<0?l+360:l;
const pC=(lat,lon)=>({
  x:((nL(lon)-MC.lonMin)/(MC.lonMax-MC.lonMin))*MC.width,
  y:((MC.latMax-lat)/(MC.latMax-MC.latMin))*MC.height
});

// ─── ARCOS PARABÓLICOS (idéntico al demo) ────────────
const computeFrontArc=(epi,waveRadiusKm,fp,centerBearing,nPoints=40,arcSpread=70)=>{
  const points=[];
  for(let i=0;i<=nPoints;i++){
    const angleOffset=-arcSpread/2+(arcSpread*i/nPoints);
    const b=(centerBearing+angleOffset+360)%360;
    const df=directionalRadiusFactor(b,fp.strike,fp.rake);
    const r=waveRadiusKm*df;
    const br=b*D2R;
    const latOffset=(r*Math.cos(br))/111;
    const lonOffset=(r*Math.sin(br))/(111*Math.cos(epi.lat*D2R));
    points.push({lat:epi.lat+latOffset,lon:epi.lon+lonOffset,intensity:radiationPattern(b,fp.strike,fp.rake)});
  }
  return points;
};
const pointsToPath=(points)=>{
  if(!points.length)return'';
  return points.map((p,i)=>{const proj=pC(p.lat,p.lon);return`${i===0?'M':'L'}${proj.x.toFixed(1)},${proj.y.toFixed(1)}`;}).join(' ');
};

// ─── PUERTOS PERÚ ────────────────────────────────────
const PP=[
  {id:'paita',    name:'Paita',    lat:-5.087, lon:-81.114,coastDepth:30},
  {id:'salaverry',name:'Salaverry',lat:-8.223, lon:-78.976,coastDepth:40},
  {id:'chimbote', name:'Chimbote', lat:-9.075, lon:-78.590,coastDepth:35},
  {id:'callao',   name:'Callao',   lat:-12.055,lon:-77.156,coastDepth:50},
  {id:'pisco',    name:'Pisco',    lat:-13.713,lon:-76.218,coastDepth:45},
  {id:'matarani', name:'Matarani', lat:-17.002,lon:-72.108,coastDepth:55},
  {id:'ilo',      name:'Ilo',      lat:-17.643,lon:-71.342,coastDepth:60},
];
const calcETAs=(event)=>{
  const ih=initWaveH(event.magnitude);
  const fp=event.faultParams||{strike:0,rake:90,dip:20};
  return PP.map(port=>{
    const d=haversineKm(event.epicenter.lat,event.epicenter.lon,port.lat,port.lon);
    const b=bearingDeg(event.epicenter.lat,event.epicenter.lon,port.lat,port.lon);
    const rf=radiationPattern(b,fp.strike,fp.rake);
    const df=directionalRadiusFactor(b,fp.strike,fp.rake);
    const spd=waveSpeedKmh(OD)*(0.95+0.05*df);
    const etaHrs=d/spd;
    const coastH=greensLaw(ih*rf,4000,port.coastDepth);
    const alert=classifyAlert(coastH);
    return{...port,distKm:Math.round(d),bearing:Math.round(b),etaHrs,etaFmt:fmtHrs(etaHrs),
      coastHeight:coastH.toFixed(2),radiationFactor:rf.toFixed(2),dirRadFactor:df,alert};
  });
};

// ─── CATÁLOGO DE ESCENARIOS DEMO ──────────────────────
const DEMO_SCENARIOS=[
  {
    id:'demo-iquique-2014',
    name:'Iquique, Chile (M8.2 — 2014)',
    shortName:'Iquique 2014',
    date:'2014-04-01 23:46:47 UTC',
    epicenter:{lat:-19.610,lon:-70.769,depth:25},
    magnitude:8.2,mechanism:'Subducción (Thrust)',
    faultParams:{strike:350,dip:18,rake:104,lengthKm:180,widthKm:80,slipM:5},
    usgsUrl:'https://earthquake.usgs.gov/earthquakes/eventpage/usc000nzvd',
    color:'#FB8C00',source:'DEMO',
    description:'Sismo frente a costa norte de Chile. Impacto directo en puertos peruanos en ~1-3h.',
    zoomVB:{x:100,y:180,w:580,h:380},
  },
  {
    id:'demo-tohoku-2011',
    name:'Tohoku, Japón (M9.1 — 2011)',
    shortName:'Tohoku 2011',
    date:'2011-03-11 05:46:23 UTC',
    epicenter:{lat:38.297,lon:142.373,depth:29},
    magnitude:9.1,mechanism:'Subducción (Thrust)',
    faultParams:{strike:193,dip:14,rake:81,lengthKm:450,widthKm:150,slipM:20},
    usgsUrl:'https://earthquake.usgs.gov/earthquakes/eventpage/official20110311054624120_30',
    color:'#E53935',source:'DEMO',
    description:'Megasismo en Japón. La ola cruzó el Pacífico en ~22h y llegó a Perú con altura de 1-2m.',
    zoomVB:{x:0,y:0,w:MC.width,h:MC.height},
  },
  {
    id:'demo-maule-2010',
    name:'Maule, Chile (M8.8 — 2010)',
    shortName:'Maule 2010',
    date:'2010-02-27 06:34:14 UTC',
    epicenter:{lat:-35.909,lon:-72.733,depth:35},
    magnitude:8.8,mechanism:'Subducción (Thrust)',
    faultParams:{strike:17,dip:18,rake:104,lengthKm:500,widthKm:140,slipM:15},
    usgsUrl:'https://earthquake.usgs.gov/earthquakes/eventpage/official20100227063411530_30',
    color:'#8E24AA',source:'DEMO',
    description:'Gran sismo en Chile central. Energía principal hacia el Oeste/Suroeste. Afectó Perú en ~4-6h.',
    zoomVB:{x:80,y:200,w:620,h:380},
  },
  {
    id:'demo-kamchatka-2006',
    name:'Kamchatka, Rusia (M8.3 — 2006)',
    shortName:'Kamchatka 2006',
    date:'2006-11-15 11:14:13 UTC',
    epicenter:{lat:46.607,lon:153.266,depth:10},
    magnitude:8.3,mechanism:'Subducción (Thrust)',
    faultParams:{strike:219,dip:22,rake:92,lengthKm:350,widthKm:110,slipM:8},
    usgsUrl:'https://earthquake.usgs.gov/earthquakes/eventpage/usp000evsq',
    color:'#00BCD4',source:'DEMO',
    description:'Sismo en trinchera Kuril. La ola viajó hacia el sureste cruzando el Pacífico norte hacia Perú en ~18h.',
    zoomVB:{x:0,y:0,w:MC.width,h:MC.height},
  },
];
const DEMO_EQ=DEMO_SCENARIOS[0]; // default

// ─── FETCH USGS ───────────────────────────────────────
const estimateStrike=(lat,lon)=>{const nLon=lon<0?lon+360:lon;if(nLon>=130&&nLon<=160&&lat>=30&&lat<=50)return 220;if(nLon>=155&&nLon<=175&&lat>=45&&lat<=60)return 210;if(nLon>=270&&nLon<=295&&lat>=-45&&lat<=-15)return 10;if(nLon>=278&&nLon<=285&&lat>=-18&&lat<=-3)return 315;return 0;};
async function fetchUSGS(){
  const base='https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=6.5&orderby=time&limit=15&minlatitude=-60&maxlatitude=70&starttime='+new Date(Date.now()-86400000).toISOString();
  const[rA,rB]=await Promise.all([fetch(base+'&minlongitude=100&maxlongitude=180'),fetch(base+'&minlongitude=-180&maxlongitude=-60')]);
  const[dA,dB]=await Promise.all([rA.ok?rA.json():{features:[]},rB.ok?rB.json():{features:[]}]);
  const seen=new Set();
  return[...dA.features,...dB.features]
    .filter(f=>{if(!f.properties||!f.geometry||f.properties.mag==null)return false;if(seen.has(f.id))return false;seen.add(f.id);return true;})
    .sort((a,b)=>b.properties.mag-a.properties.mag).slice(0,20)
    .map(f=>{
      const p=f.properties,g=f.geometry.coordinates;
      const lon=g[0]||0,lat=g[1]||0,depth=g[2]||0,mag=parseFloat(p.mag)||6.5;
      const strike=estimateStrike(lat,lon);
      return{
        id:f.id||('eq-'+Math.random()),
        name:(p.place||'Sismo Pacífico'),
        date:p.time?new Date(p.time).toISOString().replace('T',' ').substring(0,19)+' UTC':'Fecha desconocida',
        epicenter:{lat,lon,depth},magnitude:mag,mechanism:'Subducción (estimado)',
        faultParams:{strike,dip:20,rake:90,lengthKm:Math.round(Math.pow(10,-2.42+0.58*mag)),widthKm:Math.round(Math.pow(10,-1.61+0.41*mag)),slipM:Math.max(0,Math.round(mag-5))},
        usgsUrl:p.url||null,color:mag>=8.5?'#E53935':mag>=7.5?'#FB8C00':mag>=7.0?'#FFEB3B':'#00E5FF',source:'USGS',
      };
    });
}

// ─── CONTINENTES: se cargan desde GeoJSON mundial (mismo que tab MAPA) ─────
// ringToPath usa la proyección pC del Pacífico (lon 100..300)
const ringToPath=(ring)=>{
  // Proyectar cada punto y detectar saltos en SVG (líneas que cruzan el mapa de lado a lado)
  const projected=ring.map(([lon,lat])=>{
    const p=pC(lat,lon); // pC ya normaliza con nL()
    return{x:p.x,y:p.y};
  });
  // Si dos puntos consecutivos saltan más de 30% del ancho del mapa = antimeridiano
  const JUMP=MC.width*0.3;
  const parts=[]; let current=[];
  projected.forEach((pt,i)=>{
    if(i>0){
      const prev=projected[i-1];
      if(Math.abs(pt.x-prev.x)>JUMP){
        if(current.length>1)parts.push(current);
        current=[];
      }
    }
    current.push(pt);
  });
  if(current.length>1)parts.push(current);
  if(parts.length===0)return'';
  return parts.map(pts=>
    pts.map((p,i)=>`${i===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  ).join(' ')+'Z';
};
const featureToPaths=(f)=>{
  const g=f.geometry;
  if(g.type==='Polygon')return g.coordinates.map(ringToPath);
  if(g.type==='MultiPolygon'){const ps=[];g.coordinates.forEach(poly=>poly.forEach(r=>ps.push(ringToPath(r))));return ps;}
  return[];
};

// ─── MAPA SVG ─────────────────────────────────────────
function PacificMap({event,elapsedHours,portsETA,viewBox,mapRef,onWheel,onMouseDown,onMouseMove,onMouseUp,onMouseLeave,worldPaths=[]}){
  // Siempre mostrar el mapa base; epicentro/ondas solo si hay event
  const hasEvent=!!event;
  const epi=hasEvent?pC(event.epicenter.lat,event.epicenter.lon):{x:-999,y:-999};
  const fp=hasEvent?(event.faultParams||{strike:0,dip:20,rake:90,lengthKm:200}):{strike:0,dip:20,rake:90,lengthKm:200};
  const rupPts=hasEvent?ruptureEndpoints(event.epicenter,fp.strike,fp.lengthKm||200):[{lat:0,lon:0},{lat:0,lon:0}];
  const rupA=hasEvent?pC(rupPts[0].lat,rupPts[0].lon):{x:-999,y:-999};
  const rupB=hasEvent?pC(rupPts[1].lat,rupPts[1].lon):{x:-999,y:-999};
  const dipDir=dipDirection(fp.strike);
  const oppDir=(dipDir+180)%360;
  const waveKm=waveFrontRadiusKm(elapsedHours);
  const showWaves=hasEvent&&elapsedHours>0&&waveKm>50;

  // Crestas primarias y opuestas (idéntico al demo)
  const primaryCrests=[],oppositeCrests=[];
  if(showWaves){
    for(let i=0;i<5;i++){
      const rf=1-(i*0.10);
      if(rf>0.3){
        const r=waveKm*rf;
        primaryCrests.push({
          points:computeFrontArc(event.epicenter,r,fp,dipDir,60,90),
          opacity:0.85-(i*0.12),width:i===0?3:1.5,isMain:i===0
        });
        oppositeCrests.push({
          points:computeFrontArc(event.epicenter,r,fp,oppDir,30,50),
          opacity:(0.85-(i*0.12))*0.20,width:i===0?1.5:0.8,isMain:i===0
        });
      }
    }
  }

  // Flechas de dirección
  const arrowLen=75;
  const primRad=dipDir*D2R,oppRad=oppDir*D2R;
  const arrowPX=epi.x+arrowLen*Math.sin(primRad),arrowPY=epi.y-arrowLen*Math.cos(primRad);
  const arrowOX=epi.x+(arrowLen*0.6)*Math.sin(oppRad),arrowOY=epi.y-(arrowLen*0.6)*Math.cos(oppRad);

  // Puerto Callao para línea guía
  const callaoSVG=pC(-12.055,-77.156);

  // Países clave de la costa pacífico con sus etiquetas
  const COUNTRY_LABELS=[
    {name:'PERÚ',       lat:-10.0, lon:-76.0,  color:'#D4AF37', bold:true},
    {name:'CHILE',      lat:-30.0, lon:-70.5,  color:'#94a3b8'},
    {name:'ECUADOR',    lat: -1.8, lon:-78.5,  color:'#94a3b8'},
    {name:'COLOMBIA',   lat:  4.5, lon:-74.5,  color:'#94a3b8'},
    {name:'BOLIVIA',    lat:-17.0, lon:-65.0,  color:'#64748b'},
    {name:'ARGENTINA',  lat:-38.0, lon:-66.0,  color:'#64748b'},
    {name:'MEXICO',     lat: 23.0, lon:-103.0, color:'#64748b'},
    {name:'JAPÓN',      lat: 36.5, lon:138.5,  color:'#94a3b8'},
    {name:'AUSTRALIA',  lat:-26.0, lon:135.0,  color:'#64748b'},
    {name:'INDONESIA',  lat: -2.0, lon:117.0,  color:'#64748b'},
  ];

  const vb=`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`;

  return(
    <svg ref={mapRef} viewBox={vb}
      style={{width:'100%',height:'100%',display:'block',cursor:'grab',userSelect:'none'}}
      onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseLeave}>
      <defs>
        <radialGradient id="oceanBg" cx="50%" cy="50%" r="80%">
          <stop offset="0%" stopColor="#0D1F3D"/>
          <stop offset="40%" stopColor="#0A1530"/>
          <stop offset="80%" stopColor="#060B1F"/>
          <stop offset="100%" stopColor="#030614"/>
        </radialGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="4" result="cb"/><feMerge><feMergeNode in="cb"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="sglow"><feGaussianBlur stdDeviation="2" result="cb"/><feMerge><feMergeNode in="cb"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <marker id="arrowCyan" markerWidth="12" markerHeight="12" refX="10" refY="4" orient="auto">
          <polygon points="0 0, 12 4, 0 8" fill="#00E5FF"/>
        </marker>
        <marker id="arrowYellow" markerWidth="12" markerHeight="12" refX="10" refY="4" orient="auto">
          <polygon points="0 0, 12 4, 0 8" fill="#FFE600"/>
        </marker>
        <marker id="arrowGold" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 10 3, 0 6" fill="#D4AF37" opacity="0.5"/>
        </marker>
      </defs>

      {/* OCÉANO */}
      <rect x={0} y={0} width={MC.width} height={MC.height} fill="url(#oceanBg)"/>

      {/* GRATICULE (carta náutica) */}
      {Array.from({length:11},(_,i)=>100+i*20).map(lon=>{
        const p1=pC(MC.latMax,lon>180?lon-360:lon),p2=pC(MC.latMin,lon>180?lon-360:lon);
        return<line key={`m${lon}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#D4AF37" strokeOpacity={0.08} strokeWidth={0.5}/>;
      })}
      {[-60,-45,-30,-15,0,15,30,45,60].map(lat=>{
        const isEq=lat===0,isTr=Math.abs(lat)===30;
        return<line key={`p${lat}`} x1={0} y1={pC(lat,0).y} x2={MC.width} y2={pC(lat,0).y}
          stroke="#D4AF37" strokeOpacity={isEq?0.25:isTr?0.15:0.08} strokeWidth={isEq?0.8:0.5}
          strokeDasharray={isEq?'0':isTr?'4,4':'2,3'}/>;
      })}

      {/* CONTINENTES (GeoJSON real del demo) */}
      {worldPaths.map((d,i)=>(
        <path key={`f${i}`} d={d} fill="#1A2E4A" fillOpacity={0.9} stroke="none"/>
      ))}
      {worldPaths.map((d,i)=>(
        <path key={`s${i}`} d={d} fill="none" stroke="#2d6a9f" strokeWidth={0.8} strokeOpacity={0.85} strokeLinejoin="round"/>
      ))}

      {/* LÍNEA GUÍA EPICENTRO → CALLAO */}
      <line x1={epi.x} y1={epi.y} x2={callaoSVG.x} y2={callaoSVG.y}
        stroke="#D4AF37" strokeWidth={1} strokeOpacity={0.15} strokeDasharray="3,6"/>

      {/* CRESTAS OPUESTAS (debajo) */}
      {oppositeCrests.map((c,i)=>(
        <path key={`opp${i}`} d={pointsToPath(c.points)} fill="none"
          stroke="#FFD700" strokeWidth={c.isMain?1:0.5} strokeOpacity={c.isMain?0.18:0.08}
          filter={c.isMain?'url(#sglow)':''}/>
      ))}

      {/* CRESTAS PRIMARIAS — amarillo chillón para máxima visibilidad */}
      {primaryCrests.map((c,i)=>(
        <path key={`prim${i}`} d={pointsToPath(c.points)} fill="none"
          stroke={c.isMain?"#FFE600":"#FFD700"} strokeWidth={c.isMain?c.width+1:c.width} strokeOpacity={c.isMain?1.0:0.75}
          filter={c.isMain?'url(#glow)':'url(#sglow)'}/>
      ))}

      {/* FLECHAS DE DIRECCIÓN */}
      {showWaves&&(
        <>
          <line x1={epi.x} y1={epi.y} x2={arrowPX} y2={arrowPY}
            stroke="#FFE600" strokeWidth={3} markerEnd="url(#arrowYellow)" filter="url(#glow)"/>
          <line x1={epi.x} y1={epi.y} x2={arrowOX} y2={arrowOY}
            stroke="#D4AF37" strokeWidth={1.5} strokeOpacity={0.6} markerEnd="url(#arrowGold)"/>
        </>
      )}

      {/* LÍNEA DE RUPTURA — solo si hay evento */}
      {hasEvent&&<line x1={rupA.x} y1={rupA.y} x2={rupB.x} y2={rupB.y} stroke="#E53935" strokeWidth={4} strokeLinecap="round" opacity={0.9}/>
      <line x1={rupA.x} y1={rupA.y} x2={rupB.x} y2={rupB.y} stroke="#FF6B6B" strokeWidth={1.5} strokeLinecap="round" strokeDasharray="4,3"/>
      <circle cx={rupA.x} cy={rupA.y} r={4} fill="#E53935" stroke="#FFF" strokeWidth={1}/>
      <circle cx={rupB.x} cy={rupB.y} r={4} fill="#E53935" stroke="#FFF" strokeWidth={1}/>}

      {/* EPICENTRO */}
      <circle cx={epi.x} cy={epi.y} r={14} fill="#E53935" opacity={0.3}>
        <animate attributeName="r" from="10" to="20" dur="2s" repeatCount="indefinite"/>
      </circle>
      <circle cx={epi.x} cy={epi.y} r={6} fill="#E53935" stroke="#FFF" strokeWidth={2}/>
      <text x={epi.x} y={epi.y-18} fill="#E53935" fontSize={11} fontFamily="'Space Mono',monospace" textAnchor="middle" fontWeight="bold">EPICENTRO</text>

      {/* PUERTOS PERUANOS — solo si hay evento */}
      {hasEvent&&portsETA.map(port=>{
        const p=pC(port.lat,port.lon);
        const arrived=hasWaveArrived(event.epicenter,port,elapsedHours,event.faultParams||{strike:0,rake:90});
        const color=arrived?port.alert.color:'#FFB300';
        return(
          <g key={port.id}>
            {arrived&&(
              <circle cx={p.x} cy={p.y} r={10} fill={color} opacity={0.3}>
                <animate attributeName="r" from="8" to="18" dur="1.5s" repeatCount="indefinite"/>
                <animate attributeName="opacity" from="0.6" to="0" dur="1.5s" repeatCount="indefinite"/>
              </circle>
            )}
            <circle cx={p.x} cy={p.y} r={4} fill={color} stroke="#FFFFFF" strokeWidth={1}/>
            <text x={p.x-8} y={p.y+15} fill={color} fontSize={10} fontFamily="'Space Mono',monospace" textAnchor="end" fontWeight="bold">{port.name}</text>
          </g>
        );
      })}
      {/* ETIQUETAS DE PAÍSES */}
      {COUNTRY_LABELS.map(country=>{
        const p=pC(country.lat,country.lon);
        return(
          <text key={country.name} x={p.x} y={p.y}
            fill={country.color} fontSize={country.bold?11:9}
            fontFamily="'Space Mono',monospace"
            fontWeight={country.bold?'bold':'normal'}
            textAnchor="middle" opacity={0.75}
            style={{pointerEvents:'none',userSelect:'none'}}>
            {country.name}
          </text>
        );
      })}

      {/* Indicador cargando mapa */}
      {worldPaths.length===0&&(
        <text x={MC.width/2} y={MC.height/2} fill="rgba(212,175,55,0.4)"
          fontSize={11} fontFamily="'Space Mono',monospace" textAnchor="middle">
          Cargando mapa mundial...
        </text>
      )}
    </svg>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────
export default function TsunamiTracker({backendUrl='https://cnat-backend-1.onrender.com'}){
  const[earthquakes,setEarthquakes]=useState([]);
  const[selectedEq,setSelectedEq]=useState(null);
  const[portsETA,setPortsETA]=useState([]);
  const[elapsed,setElapsed]=useState(0);
  const[playing,setPlaying]=useState(false);
  const[speedMult,setSpeedMult]=useState(3600);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState(null);
  const[lastUpdate,setLastUpdate]=useState(null);
  const[dataSource,setDataSource]=useState('USGS');
  const[demoMode,setDemoMode]=useState(false);
  const[demoScenario,setDemoScenario]=useState(0);
  const[viewBox,setViewBox]=useState({x:0,y:50,w:MC.width,h:MC.height-80});
  const[worldPaths,setWorldPaths]=useState([]);

  // Cargar GeoJSON mundial (mismo que tab MAPA) al montar
  useEffect(()=>{
    fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson')
      .then(r=>r.json())
      .then(geo=>{
        const paths=[];
        geo.features.forEach(f=>{
          try{ featureToPaths(f).forEach(p=>p&&paths.push(p)); }catch(e){}
        });
        setWorldPaths(paths);
      })
      .catch(()=>{
        // Fallback silencioso si falla el fetch
      });
  },[]);
  const animRef=useRef(null),lastRef=useRef(0),mapRef=useRef(null),panRef=useRef({isPanning:false});

  // ── Carga ─────────────────────────────────────────
  const loadEarthquakes=useCallback(async()=>{
    setLoading(true);setError(null);
    try{
      let eqs=[];
      if(dataSource==='USGS'){eqs=await fetchUSGS();}
      else{
        const res=await fetch(`${backendUrl}/api/earthquakes?min_magnitude=6.5&limit=20`);
        if(!res.ok)throw new Error('Backend CNAT no responde');
        const json=await res.json();
        eqs=(json.earthquakes||json).map(e=>({
          id:e.id||e.event_id,name:e.place||'Sismo',
          date:e.time||e.timestamp||'',
          epicenter:{lat:parseFloat(e.latitude||e.lat)||0,lon:parseFloat(e.longitude||e.lon)||0,depth:parseFloat(e.depth)||0},
          magnitude:parseFloat(e.magnitude||e.mag)||6.5,mechanism:'Subducción (estimado)',
          faultParams:{strike:estimateStrike(parseFloat(e.latitude||e.lat)||0,parseFloat(e.longitude||e.lon)||0),dip:20,rake:90,lengthKm:200,widthKm:80,slipM:5},
          color:'#00E5FF',source:'CNAT',usgsUrl:e.url||null,
        }));
      }
      const finalEqs=eqs.length>0?eqs:[{...DEMO_EQ,name:'REFERENCIA (sin sismos M6.5+ hoy): '+DEMO_SCENARIOS[0].name}];
      setEarthquakes(finalEqs);
      setLastUpdate(new Date().toLocaleTimeString('es-PE'));
      // Auto-seleccionar: primero sismo real crítico, si no el primero disponible
      if(!selectedEq){
        const critical=eqs.find(e=>e.magnitude>=7.5&&e.source==='USGS');
        const top=critical||finalEqs[0];
        if(top){setSelectedEq(top);setPortsETA(calcETAs(top));setElapsed(0);}
      }
    }catch(err){
      setError(err.message);
      const fb=DEMO_SCENARIOS[0];setEarthquakes([fb]);// No auto-seleccionar en error
    }
    setLoading(false);
  },[dataSource,backendUrl]);

  useEffect(()=>{loadEarthquakes();const id=setInterval(loadEarthquakes,5*60*1000);return()=>clearInterval(id);},[dataSource]);

  const activateDemo=(idx=demoScenario)=>{
    const sc=DEMO_SCENARIOS[idx];
    setDemoMode(true);setDemoScenario(idx);
    setSelectedEq(sc);setPortsETA(calcETAs(sc));
    setElapsed(0);setPlaying(true);setSpeedMult(7200);
    setViewBox(sc.zoomVB||{x:0,y:0,w:MC.width,h:MC.height});
  };
  const clearAll=()=>{
    setElapsed(0);
    setPlaying(false);
    setDemoMode(false);
    setSelectedEq(null);
    setPortsETA([]);
    setDemoScenario(0);
    lastRef.current=0;
    loadEarthquakes();
  };
  const selectEq=(eq)=>{setSelectedEq(eq);setPortsETA(calcETAs(eq));setElapsed(0);setPlaying(false);setDemoMode(false);};

  // ── Animación ─────────────────────────────────────
  // ETA máxima: el puerto más lejano + 20% para ver la ola llegar
  const maxEtaHrs = portsETA.length>0 ? Math.max(...portsETA.map(p=>p.etaHrs))*1.15 : 30;

  useEffect(()=>{
    if(!playing){cancelAnimationFrame(animRef.current);return;}
    const step=(now)=>{
      if(lastRef.current){
        const dt=(now-lastRef.current)/1000;
        setElapsed(p=>{
          const next=p+(dt*speedMult)/3600;
          // Auto-stop cuando supera el máximo (última ola llegó + margen)
          if(next>=maxEtaHrs){
            setPlaying(false);
            return maxEtaHrs;
          }
          return next;
        });
      }
      lastRef.current=now;animRef.current=requestAnimationFrame(step);
    };
    lastRef.current=0;animRef.current=requestAnimationFrame(step);
    return()=>cancelAnimationFrame(animRef.current);
  },[playing,speedMult,maxEtaHrs]);

  // ── Zoom / Pan ────────────────────────────────────
  const handleWheel=useCallback((e)=>{
    e.preventDefault();
    const svg=mapRef.current;if(!svg)return;
    const rect=svg.getBoundingClientRect();
    const mx=viewBox.x+((e.clientX-rect.left)/rect.width)*viewBox.w;
    const my=viewBox.y+((e.clientY-rect.top)/rect.height)*viewBox.h;
    const zf=e.deltaY<0?0.85:1.18;
    const nw=Math.max(150,Math.min(MC.width*1.5,viewBox.w*zf));
    const nh=Math.max(100,Math.min(MC.height*1.5,viewBox.h*zf));
    setViewBox({x:mx-((e.clientX-rect.left)/rect.width)*nw,y:my-((e.clientY-rect.top)/rect.height)*nh,w:nw,h:nh});
  },[viewBox]);
  const handleMouseDown=(e)=>{panRef.current={isPanning:true,sx:e.clientX,sy:e.clientY,svb:{...viewBox}};};
  const handleMouseMove=(e)=>{
    if(!panRef.current.isPanning)return;
    const svg=mapRef.current;if(!svg)return;
    const rect=svg.getBoundingClientRect();
    const dx=((panRef.current.sx-e.clientX)/rect.width)*viewBox.w;
    const dy=((panRef.current.sy-e.clientY)/rect.height)*viewBox.h;
    setViewBox({...panRef.current.svb,x:panRef.current.svb.x+dx,y:panRef.current.svb.y+dy});
  };
  const handleMouseUp=()=>{panRef.current.isPanning=false;};

  const zoomTo=(preset)=>{
    const P={
      global:{x:0,y:0,w:MC.width,h:MC.height},
      peru:{x:180,y:280,w:150,h:180},
      pacifico:{x:50,y:50,w:750,h:450},
      asia:{x:530,y:60,w:300,h:320},
      america:{x:130,y:80,w:200,h:430},
    };
    setViewBox(P[preset]||P.global);
  };

  // ── Datos derivados ───────────────────────────────
  const callao=portsETA.find(p=>p.id==='callao');
  const callaoArrived=callao&&selectedEq?hasWaveArrived(selectedEq.epicenter,callao,elapsed,selectedEq.faultParams||{strike:0,rake:90}):false;
  const remainingCallao=callao?Math.max(0,callao.etaHrs-elapsed):null;
  const percentComplete=callao?Math.min(100,(elapsed/callao.etaHrs)*100):0;
  const waveKm=waveFrontRadiusKm(elapsed);
  const distTraveled=callao?waveKm*callao.dirRadFactor:0;
  const remainingKm=callao?Math.max(0,(callao.distKm||0)-distTraveled):0;
  const maxAlert=portsETA.reduce((mx,p)=>(p.alert.level>(mx?.alert?.level??-1)?p:mx),null);

  // ── ESTILOS ───────────────────────────────────────
  const F="'Space Mono',monospace";
  const sBtn=(active,col='#00E5FF',bg)=>({
    padding:'6px 14px',fontFamily:F,fontSize:11,fontWeight:'bold',letterSpacing:1,cursor:'pointer',borderRadius:4,
    background:active?(bg||`rgba(0,229,255,0.12)`):'rgba(10,21,53,0.6)',
    border:`1px solid ${active?col:'rgba(212,175,55,0.2)'}`,
    color:active?col:'#6B7B9F',transition:'all 0.15s',
  });
  const panel={background:'rgba(10,21,53,0.6)',border:'1px solid rgba(212,175,55,0.12)',borderRadius:6,padding:12};
  const sT={fontSize:9,color:'#D4AF37',letterSpacing:'2px',fontWeight:'bold',marginBottom:8,paddingBottom:4,borderBottom:'1px solid rgba(212,175,55,0.1)',fontFamily:F};

  return(
    <div style={{fontFamily:F,color:'#E0E6F0',padding:4}}>

      {/* ══ HEADER ══ */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 18px',background:'rgba(10,21,53,0.7)',border:'1px solid rgba(212,175,55,0.2)',borderRadius:8,marginBottom:14,flexWrap:'wrap',gap:8}}>
        <div>
          <div style={{fontSize:13,letterSpacing:'2px',fontWeight:'bold',display:'flex',alignItems:'center',gap:8}}>
            <span style={{color:'#D4AF37'}}>CNAT</span>
            <span style={{color:'#4A5878'}}>·</span>
            <span>SEGUIMIENTO DE TSUNAMI</span>
            {demoMode&&<span style={{fontSize:9,color:'#a78bfa',background:'rgba(167,139,250,0.12)',padding:'2px 8px',borderRadius:3,border:'1px solid rgba(167,139,250,0.35)',letterSpacing:1}}>● DEMO: {DEMO_SCENARIOS[demoScenario]?.shortName}</span>}
          </div>
          <div style={{fontSize:9,color:'#6B7B9F',marginTop:3,letterSpacing:'1px'}}>
            DATOS EN TIEMPO REAL · {lastUpdate?`Actualizado: ${lastUpdate}`:'Conectando...'}
          </div>
        </div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
          <button style={sBtn(dataSource==='USGS')} onClick={()=>setDataSource('USGS')}>● USGS</button>
          <button style={sBtn(dataSource==='CNAT','#FB8C00','rgba(251,140,0,0.1)')} onClick={()=>setDataSource('CNAT')}>● CNAT</button>
          <button style={sBtn(false,'#D4AF37')} onClick={loadEarthquakes}>↻ REFRESCAR</button>

          <button style={sBtn(false,'#6B7B9F')} onClick={clearAll}>↺ LIMPIAR</button>
        </div>
      </div>

      {error&&<div style={{padding:'8px 14px',background:'rgba(251,140,0,0.1)',border:'1px solid rgba(251,140,0,0.4)',borderRadius:6,marginBottom:10,fontSize:10,color:'#FB8C00'}}>⚠ {error} — Usando datos de referencia (Tohoku 2011).</div>}



      {/* ══ GRID PRINCIPAL: [mapa+toolbar] [panel-der-datos] ══ */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 360px',gap:10,alignItems:'start'}}>

        {/* ── COLUMNA IZQUIERDA: Toolbar + Mapa ── */}
        <div style={{display:'flex',flexDirection:'column',gap:6}}>

          {/* MAPA */}
          {loading?(
            <div style={{height:520,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(5,8,24,0.6)',borderRadius:8,border:'1px solid rgba(212,175,55,0.15)',color:'#00E5FF',fontSize:12,letterSpacing:'2px',fontFamily:F}}>
              CARGANDO DATOS SÍSMICOS...
            </div>
          ):(
            <div style={{position:'relative',borderRadius:8,overflow:'hidden',border:'1px solid rgba(212,175,55,0.15)',borderBottom:'none',borderRadius:'6px 6px 0 0',height:520,background:'rgba(5,8,24,0.6)'}}>
              {/* Zoom overlay */}
              <div style={{position:'absolute',top:10,right:10,zIndex:10,display:'flex',flexDirection:'column',gap:3,background:'rgba(10,21,53,0.85)',border:'1px solid rgba(212,175,55,0.3)',borderRadius:6,padding:4}}>
                {[{sym:'+',zf:0.85},{sym:'−',zf:1.18}].map(({sym,zf})=>(
                  <button key={sym} onClick={()=>setViewBox(v=>({x:v.x+v.w*(1-zf)/2,y:v.y+v.h*(1-zf)/2,w:Math.max(150,Math.min(MC.width*1.5,v.w*zf)),h:Math.max(100,Math.min(MC.height*1.5,v.h*zf))}))}
                    style={{width:34,height:34,background:'rgba(5,8,24,0.8)',border:'1px solid rgba(212,175,55,0.2)',color:'#D4AF37',borderRadius:4,cursor:'pointer',fontSize:18,fontWeight:'bold',fontFamily:F,display:'flex',alignItems:'center',justifyContent:'center'}}>
                    {sym}
                  </button>
                ))}
                <div style={{height:1,background:'rgba(212,175,55,0.25)',margin:'2px'}}/>
                <button onClick={()=>setViewBox({x:0,y:0,w:MC.width,h:MC.height})}
                  style={{width:34,height:26,background:'rgba(5,8,24,0.8)',border:'1px solid rgba(212,175,55,0.15)',color:'#6B7B9F',borderRadius:4,cursor:'pointer',fontSize:8,fontFamily:F}}>FIT</button>
              </div>
              {/* Indicador T+ */}
              {elapsed>0&&(
                <div style={{position:'absolute',top:10,left:10,zIndex:10,background:'rgba(10,21,53,0.9)',border:`1px solid ${elapsed>=maxEtaHrs?'rgba(212,175,55,0.5)':'rgba(0,229,255,0.3)'}`,borderRadius:4,padding:'4px 10px',fontSize:10,color:elapsed>=maxEtaHrs?'#D4AF37':'#00E5FF',fontFamily:F}}>
                  {elapsed>=maxEtaHrs?'✓ SIMULACIÓN COMPLETA':'T+ '+fmtHrs(elapsed)}
                </div>
              )}
              {/* Mini-countdown sobre el mapa (siempre visible) */}
              {callao&&elapsed>0&&(
                <div style={{position:'absolute',bottom:10,left:'50%',transform:'translateX(-50%)',zIndex:10,background:callaoArrived?'rgba(76,175,80,0.9)':'rgba(229,57,53,0.85)',border:`1px solid ${callaoArrived?'#4CAF50':'#E53935'}`,borderRadius:6,padding:'5px 18px',textAlign:'center',backdropFilter:'blur(4px)'}}>
                  <div style={{fontSize:8,color:'rgba(255,255,255,0.7)',letterSpacing:'2px',fontFamily:F}}>🎯 CALLAO</div>
                  <div style={{fontSize:22,fontWeight:'bold',color:'#FFF',letterSpacing:'3px',fontFamily:F,lineHeight:1.1}}>
                    {callaoArrived?'✓ LLEGÓ':fmtCnt(remainingCallao)}
                  </div>
                  {!callaoArrived&&<div style={{fontSize:8,color:'rgba(255,255,255,0.6)',fontFamily:F}}>{Math.round(remainingKm).toLocaleString()} km restantes</div>}
                </div>
              )}
              <PacificMap event={selectedEq} elapsedHours={elapsed} portsETA={portsETA} viewBox={viewBox} mapRef={mapRef} onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} worldPaths={worldPaths}/>
            </div>
          )}
          {/* ── TOOLBAR HORIZONTAL ── */}
          <div style={{display:'flex',gap:6,alignItems:'center',background:'rgba(10,21,53,0.7)',borderTop:'1px solid rgba(212,175,55,0.15)',borderRadius:'0 0 6px 6px',padding:'6px 10px',flexWrap:'nowrap',overflowX:'auto'}}>

            {/* Simular / Pausar */}
            <button
              style={{...sBtn(playing,playing?'#FB8C00':'#00E5FF',playing?'rgba(251,140,0,0.12)':'rgba(0,229,255,0.08)'),
                padding:'5px 16px',fontSize:13,whiteSpace:'nowrap',border:`2px solid ${playing?'#FB8C00':'#00E5FF'}`,flexShrink:0}}
              onClick={()=>{setPlaying(p=>!p);lastRef.current=0;}}>
              {playing?'⏸ PAUSAR':'▶ SIMULAR'}
            </button>

            {/* Reset */}
            <button style={{...sBtn(false),padding:'5px 10px',fontSize:12,flexShrink:0}} onClick={clearAll} title="Limpiar">↺</button>

            <div style={{width:1,height:20,background:'rgba(212,175,55,0.2)',flexShrink:0}}/>

            {/* Velocidad dropdown */}
            <div style={{display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
              <span style={{fontSize:9,color:'#D4AF37',fontFamily:F,whiteSpace:'nowrap'}}>VEL.</span>
              <select
                value={speedMult}
                onChange={e=>setSpeedMult(Number(e.target.value))}
                style={{background:'rgba(5,8,24,0.9)',border:'1px solid rgba(212,175,55,0.3)',color:'#D4AF37',
                  padding:'4px 6px',borderRadius:4,fontSize:10,fontFamily:F,cursor:'pointer'}}>
                <option value={1800}>½×</option>
                <option value={3600}>1×</option>
                <option value={7200}>2×</option>
              </select>
            </div>

            <div style={{width:1,height:20,background:'rgba(212,175,55,0.2)',flexShrink:0}}/>

            {/* Escenario DEMO dropdown */}
            <div style={{display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
              <span style={{fontSize:9,color:'#a78bfa',fontFamily:F,whiteSpace:'nowrap'}}>DEMO</span>
              <select
                value={demoScenario}
                onChange={e=>activateDemo(Number(e.target.value))}
                style={{background:'rgba(5,8,24,0.9)',border:`1px solid ${demoMode?'rgba(167,139,250,0.6)':'rgba(167,139,250,0.25)'}`,
                  color:'#a78bfa',padding:'4px 6px',borderRadius:4,fontSize:10,fontFamily:F,cursor:'pointer',maxWidth:200}}>
                {DEMO_SCENARIOS.map((sc,i)=>(
                  <option key={sc.id} value={i}>{sc.shortName}</option>
                ))}
              </select>
            </div>

            <div style={{width:1,height:20,background:'rgba(212,175,55,0.2)',flexShrink:0}}/>

            {/* Presets de vista */}
            <div style={{display:'flex',gap:3,flexShrink:0}}>
              {[['global','🌍'],['peru','🇵🇪'],['america','🌎'],['pacifico','🌊'],['asia','🌏']].map(([z,ic])=>(
                <button key={z} style={{...sBtn(false),padding:'4px 7px',fontSize:9,whiteSpace:'nowrap'}}
                  onClick={()=>zoomTo(z)} title={z.toUpperCase()}>
                  {ic}
                </button>
              ))}
            </div>

            <div style={{width:1,height:20,background:'rgba(212,175,55,0.2)',flexShrink:0}}/>

            {/* Fuente */}
            <div style={{display:'flex',gap:3,flexShrink:0}}>
              <button style={{...sBtn(dataSource==='USGS'),padding:'4px 8px',fontSize:9}} onClick={()=>setDataSource('USGS')}>USGS</button>
              <button style={{...sBtn(dataSource==='CNAT','#FB8C00','rgba(251,140,0,0.1)'),padding:'4px 8px',fontSize:9}} onClick={()=>setDataSource('CNAT')}>CNAT</button>
            </div>

            {/* Indicador live — empuja al extremo derecho */}
            <span style={{marginLeft:'auto',fontSize:9,color:'#22c55e',background:'rgba(34,197,94,0.08)',
              padding:'3px 8px',borderRadius:3,border:'1px solid rgba(34,197,94,0.25)',
              letterSpacing:'1px',fontFamily:F,flexShrink:0,whiteSpace:'nowrap'}}>
              {dataSource==='USGS'?'● USGS LIVE':'● CNAT'}
            </span>
          </div>
        </div>

        {/* ── COLUMNA DERECHA: ancho fijo, no se achica con zoom ── */}
        <div style={{display:'flex',flexDirection:'column',gap:8,width:360,minWidth:360}}>

          {/* COUNTDOWN COMPACTO CALLAO — solo si hay sismo seleccionado y simulación activa */}
          {!selectedEq&&(
            <div style={{background:'rgba(10,21,53,0.7)',border:'1px solid rgba(212,175,55,0.2)',borderRadius:8,padding:'14px',textAlign:'center'}}>
              <div style={{fontSize:11,color:'#D4AF37',letterSpacing:'2px',fontFamily:F,marginBottom:8}}>SISTEMA LISTO</div>
              <div style={{fontSize:10,color:'#6B7B9F',fontFamily:F,lineHeight:1.7}}>
                Seleccione un sismo de la lista<br/>o active un escenario DEMO<br/>para iniciar el seguimiento
              </div>
              <div style={{marginTop:10,fontSize:9,color:'#4A5878',fontFamily:F}}>
                ▶ SIMULAR → ↺ LIMPIAR
              </div>
            </div>
          )}
          {callao&&elapsed>0&&(
            <div style={{background:callaoArrived?'linear-gradient(135deg,rgba(76,175,80,0.15),rgba(10,21,53,0.9))':percentComplete<50?'linear-gradient(135deg,rgba(76,175,80,0.12),rgba(10,21,53,0.9))':percentComplete<80?'linear-gradient(135deg,rgba(251,140,0,0.12),rgba(10,21,53,0.9))':'linear-gradient(135deg,rgba(229,57,53,0.15),rgba(10,21,53,0.9))',border:`2px solid ${callaoArrived?'#4CAF50':percentComplete<50?'#4CAF50':percentComplete<80?'#FB8C00':'#E53935'}`,borderRadius:8,padding:'10px 14px',boxShadow:`0 0 20px rgba(${callaoArrived?'76,175,80':'229,57,53'},0.2)`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                <div style={{fontSize:9,color:callaoArrived?'#4CAF50':'#E53935',letterSpacing:'2px',fontWeight:'bold',fontFamily:F,display:'flex',alignItems:'center',gap:5}}>
                  <span style={{width:7,height:7,borderRadius:'50%',background:callaoArrived?'#4CAF50':'#E53935',display:'inline-block'}}/>
                  🎯 ETA · CALLAO
                </div>
                <span style={{fontSize:9,color:'#8B95B8',fontFamily:F}}>{(callao.distKm||0).toLocaleString()} km</span>
              </div>
              <div style={{textAlign:'center',margin:'4px 0'}}>
                <div style={{fontFamily:F,fontSize:36,fontWeight:'bold',color:callaoArrived?'#4CAF50':percentComplete<50?'#4CAF50':percentComplete<80?'#FB8C00':'#FF5252',letterSpacing:'4px',textShadow:`0 0 15px rgba(${callaoArrived?'76,175,80':'255,82,82'},0.7)`,lineHeight:1}}>
                  {callaoArrived?'✓ LLEGÓ':fmtCnt(remainingCallao)}
                </div>
                {!callaoArrived&&<div style={{fontSize:9,color:'#8B95B8',marginTop:3,fontFamily:F}}>
                  {Math.round(remainingKm).toLocaleString()} km restantes · {callao.alert.label} {callao.coastHeight}m
                </div>}
              </div>
              <div style={{height:4,background:'rgba(255,255,255,0.06)',borderRadius:2,overflow:'hidden',marginTop:6}}>
                <div style={{height:'100%',width:`${percentComplete}%`,background:`linear-gradient(90deg,${callaoArrived?'#4CAF50':'#E53935'},#D4AF37)`,transition:'width 0.1s linear'}}/>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:8,color:'#6B7B9F',marginTop:3,fontFamily:F}}>
                <span>{Math.round(distTraveled).toLocaleString()} km recorridos</span>
                <span style={{color:'#D4AF37',fontWeight:'bold'}}>{percentComplete.toFixed(1)}%</span>
              </div>
            </div>
          )}

          {/* Alerta máxima — solo si hay simulación activa */}
          {maxAlert&&elapsed>0&&(
            <div style={{...panel,textAlign:'center',padding:'10px',border:`1px solid ${maxAlert.alert.color}40`}}>
              <div style={sT}>NIVEL MÁXIMO DE AMENAZA</div>
              <div style={{fontSize:22,fontWeight:'bold',color:maxAlert.alert.color,letterSpacing:'3px'}}>{maxAlert.alert.label}</div>
              <div style={{fontSize:9,color:'#6B7B9F',marginTop:4}}>{maxAlert.name} · {maxAlert.coastHeight}m estimado</div>
            </div>
          )}

          {/* Lista sismos */}
          <div style={panel}>
            <div style={sT}>SISMOS M≥6.5 · ÚLTIMAS 24H · PACÍFICO</div>
            {loading?(
              <div style={{color:'#6B7B9F',fontSize:10,textAlign:'center',padding:14,fontFamily:F}}>Consultando USGS...</div>
            ):(
              <div style={{maxHeight:200,overflowY:'auto'}}>
                {earthquakes.map(eq=>(
                  <div key={eq.id||Math.random()} onClick={()=>selectEq(eq)}
                    style={{padding:'8px 10px',marginBottom:3,borderRadius:4,cursor:'pointer',border:selectedEq?.id===eq.id?'1px solid rgba(212,175,55,0.5)':'1px solid transparent',background:selectedEq?.id===eq.id?'rgba(212,175,55,0.08)':'rgba(255,255,255,0.02)',transition:'all 0.2s'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{fontSize:10,color:'#E0E6F0'}}>{(eq.name||'Sismo').substring(0,32)}</span>
                      <span style={{background:eq.color||'#00E5FF',color:'#000',fontSize:9,padding:'2px 6px',borderRadius:3,fontWeight:'bold'}}>M{(eq.magnitude||0).toFixed(1)}</span>
                    </div>
                    <div style={{fontSize:9,color:'#6B7B9F',marginTop:2}}>{(eq.date||'').substring(0,16)} · {eq.epicenter?.depth??0}km prof.</div>
                    <div style={{fontSize:9,color:eq.source==='DEMO'?'#a78bfa':eq.source==='REFERENCIA'?'#4A5878':'#4CAF50',marginTop:1}}>
                      {eq.source}{eq.usgsUrl&&<a href={eq.usgsUrl} target="_blank" rel="noreferrer" style={{color:'#3A508C',textDecoration:'none',marginLeft:6}}>→ USGS</a>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ETAs puertos */}
          {selectedEq&&(
            <div style={panel}>
              <div style={sT}>ETA Y ALTURA ESTIMADA · PUERTOS PERÚ</div>
              <div style={{fontSize:9,color:'#6B7B9F',marginBottom:8}}>
                Epicentro: {selectedEq.epicenter.lat.toFixed(2)}°, {selectedEq.epicenter.lon.toFixed(2)}° · {selectedEq.epicenter.depth}km
              </div>
              <div style={{display:'grid',gridTemplateColumns:'65px 1fr 60px 75px',gap:5,fontSize:8,color:'#6B7B9F',marginBottom:4,padding:'0 8px',fontFamily:F}}>
                <span>PUERTO</span><span>ETA</span><span>DIST</span><span>ALTURA</span>
              </div>
              {portsETA.map(port=>{
                const arrived=hasWaveArrived(selectedEq.epicenter,port,elapsed,selectedEq.faultParams||{strike:0,rake:90});
                return(
                  <div key={port.id} style={{padding:'5px 8px',marginBottom:3,borderRadius:4,background:port.alert.bg||'rgba(0,0,0,0.2)',border:`1px solid ${port.alert.color}20`,display:'grid',gridTemplateColumns:'65px 1fr 60px 75px',gap:5,alignItems:'center',fontSize:10}}>
                    <span style={{color:arrived?port.alert.color:'#E0E6F0',fontWeight:arrived?'bold':'normal'}}>
                      {arrived?'⚡':''}{port.name}
                    </span>
                    <span style={{color:'#00E5FF',fontSize:9,fontFamily:F}}>{port.etaFmt}</span>
                    <span style={{color:'#6B7B9F',fontSize:9}}>{(port.distKm/1000).toFixed(1)}Mm</span>
                    <span style={{color:port.alert.color,fontWeight:'bold'}}>
                      {port.coastHeight}m
                      <div style={{fontSize:8,fontWeight:'normal',color:port.alert.color}}>{port.alert.label}</div>
                    </span>
                  </div>
                );
              })}
              <div style={{fontSize:8,color:'#4A5878',marginTop:8,lineHeight:1.6,fontFamily:F}}>
                * ~{Math.round(waveSpeedKmh())} km/h · Modelo físico + directividad focal<br/>
                * Altura ajustable con datos de boyas DART en tiempo real
              </div>
            </div>
          )}

          {/* Parámetros */}
          {selectedEq&&(
            <div style={panel}>
              <div style={sT}>PARÁMETROS DEL EVENTO</div>
              {[
                ['Magnitud',`M${selectedEq.magnitude.toFixed(1)} Mw`],
                ['Latitud/Longitud',`${selectedEq.epicenter.lat.toFixed(2)}°, ${selectedEq.epicenter.lon.toFixed(2)}°`],
                ['Profundidad',`${selectedEq.epicenter.depth} km`],
                ['Mecanismo',selectedEq.mechanism||'Subducción'],
                ['Strike / Rake',`${selectedEq.faultParams?.strike||0}° / ${selectedEq.faultParams?.rake||90}°`],
                ['Ruptura',`${selectedEq.faultParams?.lengthKm||'—'}×${selectedEq.faultParams?.widthKm||'—'} km`],
                ['Dirección max. radiación',`${dipDirection(selectedEq.faultParams?.strike||0)}°`],
                ['Fuente',selectedEq.source],
              ].map(([k,v])=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:9,padding:'3px 0',borderBottom:'1px solid rgba(212,175,55,0.06)',fontFamily:F}}>
                  <span style={{color:'#6B7B9F'}}>{k}</span>
                  <span style={{color:'#E0E6F0'}}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
