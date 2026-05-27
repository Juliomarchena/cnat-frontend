import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, LineChart, Line, ReferenceLine,
} from 'recharts';
import { supabase }         from './supabaseClient';
import TsunamiTracker       from './TsunamiTracker';
import ModuloAlertasDHN     from './ModuloAlertasDHN';
import ModuloVIGIA          from './ModuloVIGIA';
import ModuloARIA            from './ModuloARIA';
import AutoReport            from './AutoReport';
import PanelIGP              from './PanelIGP';
import ModuloIGP             from './ModuloIGP';   // [FASE 3] Fuentes IGP

/* ════════════════════════════════════════════
   CONFIG
   ════════════════════════════════════════════ */
const API_BASE = process.env.REACT_APP_API_URL || 'https://cnat-backend-1.onrender.com';
const API      = API_BASE + '/api';

async function apiFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
    },
  });
}

/* ════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════ */
const sevColor = s =>
  s === 'critical' ? '#ef4444' :
  s === 'warning'  ? '#f59e0b' :
  s === 'moderate' ? '#fb923c' : '#64748b';

const thrColor = a =>
  a === 'ALARMA'      ? '#ef4444' :
  a === 'ALERTA'      ? '#f59e0b' :
  a === 'INFORMACION' ? '#3b82f6' : '#22c55e';

const COLORS = ['#3b82f6','#ef4444','#f59e0b','#22c55e','#8b5cf6','#ec4899','#06b6d4','#84cc16'];

function useAlarmSound() {
  const c = useRef(null);
  return useCallback(() => {
    try {
      if (!c.current) c.current = new (window.AudioContext || window.webkitAudioContext)();
      const o = c.current.createOscillator(), g = c.current.createGain();
      o.connect(g); g.connect(c.current.destination);
      o.frequency.setValueAtTime(800, c.current.currentTime);
      o.frequency.setValueAtTime(600, c.current.currentTime + 0.15);
      g.gain.setValueAtTime(0.3, c.current.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, c.current.currentTime + 0.5);
      o.start(); o.stop(c.current.currentTime + 0.5);
    } catch (e) {}
  }, []);
}

const CTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#0d1a2e', border:'1px solid #1e3a5f', borderRadius:6, padding:'8px 12px', fontSize:11, color:'#e2e8f0' }}>
      <p style={{ color:'#fbbf24', fontWeight:700, marginBottom:4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
        </p>
      ))}
    </div>
  );
};

/* ════════════════════════════════════════════
   STATS PANEL
   ════════════════════════════════════════════ */
function StatsSummary({ earthquakes = [], alerts = [], buoys = [], onFocus }) {
  const mags   = earthquakes.map(e => e.magnitude).filter(Boolean);
  const depths = earthquakes.map(e => e.depth_km).filter(Boolean);
  const magMax  = mags.length   ? Math.max(...mags) : 0;
  const magAvg  = mags.length   ? mags.reduce((a,b)=>a+b,0)/mags.length : 0;
  const depthAvg= depths.length ? depths.reduce((a,b)=>a+b,0)/depths.length : 0;
  const depthMax= depths.length ? Math.max(...depths) : 0;
  const critical = earthquakes.filter(e => e.severity === 'critical').length;
  const warning  = earthquakes.filter(e => e.severity === 'warning').length;
  const moderate = earthquakes.filter(e => e.severity === 'moderate').length;
  const normal   = earthquakes.filter(e => e.severity === 'normal').length;
  const lastSig  = earthquakes.filter(e => e.magnitude >= 4.5)[0];

  const timeSince = d => {
    if (!d) return 'N/A';
    const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    return m < 60 ? `${m}min` : m < 1440 ? `${Math.floor(m/60)}h${m%60}m` : `${Math.floor(m/1440)}d`;
  };

  return (
    <div style={{ padding:12, borderBottom:'1px solid #1e3a5f' }}>
      <div style={{ fontSize:11, color:'#fbbf24', letterSpacing:2, fontWeight:700, marginBottom:8 }}>RESUMEN NUMERICO</div>
      {lastSig && (
        <div
          onClick={() => onFocus && onFocus(lastSig.id)}
          style={{ background:'#0d1a2e', borderRadius:8, padding:10, marginBottom:8, borderLeft:`4px solid ${sevColor(lastSig.severity)}`, cursor:'pointer', transition:'background 0.2s' }}
          title="Ver en mapa"
          onMouseOver={e => e.currentTarget.style.background='#1e3a5f33'}
          onMouseOut={e  => e.currentTarget.style.background='#0d1a2e'}
        >
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontSize:9, color:'#fbbf24', fontWeight:700, marginBottom:3 }}>ULTIMO SIGNIFICATIVO</div>
            <span style={{ fontSize:8, color:'#475569' }}>▶ ver en mapa</span>
          </div>
          <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
            <span style={{ fontSize:18, fontWeight:700, color:sevColor(lastSig.severity), fontFamily:"'Orbitron'" }}>M{lastSig.magnitude}</span>
            <span style={{ fontSize:10, color:'#94a3b8' }}>hace {timeSince(lastSig.event_time)}</span>
          </div>
          <div style={{ fontSize:10, color:'#cbd5e1', marginTop:2 }}>{lastSig.place}</div>
        </div>
      )}
      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <tbody>
          {[
            ['Mag. maxima',   magMax.toFixed(1),   magMax >= 6 ? '#ef4444' : '#f59e0b'],
            ['Mag. promedio', magAvg.toFixed(1),   '#06b6d4'],
            ['Prof. promedio',`${depthAvg.toFixed(0)}km`, '#8b5cf6'],
            ['Prof. maxima',  `${depthMax.toFixed(0)}km`, '#8b5cf6'],
            [null],
            ['Criticos M7.5+', critical, critical > 0 ? '#ef4444' : '#22c55e'],
            ['Alerta M6.0+',   warning,  warning  > 0 ? '#f59e0b' : '#22c55e'],
            ['Moderados M4.5+',moderate, '#fb923c'],
            ['Menores',        normal,   '#64748b'],
            [null],
            ['Boyas anomalia', `${buoys.filter(b=>b.status!=='normal').length}/${buoys.length}`, buoys.some(b=>b.status!=='normal')?'#ef4444':'#22c55e'],
            ['Alertas tsunami', alerts.length, alerts.length > 0 ? '#ef4444' : '#22c55e'],
          ].map((r, i) =>
            r[0] === null
              ? <tr key={i}><td colSpan={2} style={{ height:4 }}></td></tr>
              : <tr key={i}>
                  <td style={{ padding:'3px 0', fontSize:10, color:'#94a3b8' }}>{r[0]}</td>
                  <td style={{ padding:'3px 0', fontSize:12, color:r[2], fontWeight:700, textAlign:'right', fontFamily:"'Orbitron'" }}>{r[1]}</td>
                </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ════════════════════════════════════════════
   ANALYTICS
   ════════════════════════════════════════════ */
function AnalyticsDashboard({ earthquakes = [], buoys = [], sources = [], data = null }) {
  const tl = (() => {
    const h = {};
    earthquakes.forEach(eq => {
      const hr = new Date(eq.event_time).getHours(), k = `${hr}:00`;
      if (!h[k]) h[k] = { hora:k, cantidad:0, magMax:0 };
      h[k].cantidad++;
      h[k].magMax = Math.max(h[k].magMax, eq.magnitude);
    });
    return Object.values(h).sort((a,b) => parseInt(a.hora)-parseInt(b.hora));
  })();

  const md = (() => {
    const r = {'M2-3':0,'M3-4':0,'M4-5':0,'M5-6':0,'M6+':0};
    earthquakes.forEach(eq => {
      const m = eq.magnitude;
      if (m>=6) r['M6+']++; else if (m>=5) r['M5-6']++; else if (m>=4) r['M4-5']++;
      else if (m>=3) r['M3-4']++; else r['M2-3']++;
    });
    return Object.entries(r).map(([n,v]) => ({ name:n, value:v }));
  })();

  const sv = (() => {
    const c = { Normal:0, Moderado:0, Alerta:0, Critico:0 };
    earthquakes.forEach(eq => {
      if (eq.severity==='critical') c.Critico++;
      else if (eq.severity==='warning') c.Alerta++;
      else if (eq.severity==='moderate') c.Moderado++;
      else c.Normal++;
    });
    return Object.entries(c).filter(([,v])=>v>0).map(([n,v])=>({name:n,value:v}));
  })();

  const sc = { Normal:'#64748b', Moderado:'#fb923c', Alerta:'#f59e0b', Critico:'#ef4444' };

  const rg = (() => {
    const r = {};
    earthquakes.forEach(eq => {
      let g = 'Otro'; const p = (eq.place||'').toLowerCase();
      if (p.includes('peru'))                                   g='Peru';
      else if (p.includes('chile'))                             g='Chile';
      else if (p.includes('alaska'))                            g='Alaska';
      else if (p.includes('japan'))                             g='Japon';
      else if (p.includes('indonesia')||p.includes('ternate')) g='Indonesia';
      else if (p.includes('mexico')||p.includes('oaxaca'))     g='Mexico';
      else if (p.includes('kermadec')||p.includes('fiji'))     g='Pacifico S';
      else if (p.includes('argentina'))                         g='Argentina';
      else if (p.includes('california')||p.includes('nevada')) g='EEUU';
      r[g] = (r[g]||0)+1;
    });
    return Object.entries(r).map(([n,v])=>({name:n,value:v})).sort((a,b)=>b.value-a.value).slice(0,8);
  })();

  const scat = earthquakes.slice(0,50).map(eq=>({ x:eq.magnitude, y:eq.depth_km, z:eq.magnitude*10 }));
  const bs   = (() => {
    const s={};
    earthquakes.forEach(eq=>{ const src=(eq.source_id||'?').toUpperCase(); s[src]=(s[src]||0)+1; });
    return Object.entries(s).map(([n,c])=>({name:n,cantidad:c})).sort((a,b)=>b.cantidad-a.cantidad);
  })();

  const cd = { background:'#0d1a2e', borderRadius:10, border:'1px solid #1e3a5f44', padding:14 };
  const tt = { fontSize:11, color:'#fbbf24', letterSpacing:2, fontWeight:700, marginBottom:10 };

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, overflow:'auto', padding:4 }}>
      <div style={{ ...cd, gridColumn:'span 2' }}>
        <div style={tt}>ACTIVIDAD SISMICA POR HORA</div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={tl}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f33" />
            <XAxis dataKey="hora" tick={{ fill:'#94a3b8', fontSize:9 }} />
            <YAxis tick={{ fill:'#94a3b8', fontSize:9 }} />
            <Tooltip content={<CTooltip />} />
            <Area type="monotone" dataKey="cantidad" stroke="#3b82f6" fill="#3b82f620" strokeWidth={2} name="Eventos" />
            <Area type="monotone" dataKey="magMax"   stroke="#f59e0b" fill="#f59e0b10" strokeWidth={2} name="Mag.Max" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={cd}>
        <div style={tt}>SEVERIDAD</div>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={sv} cx="50%" cy="50%" innerRadius={30} outerRadius={60} dataKey="value"
              label={({ name, value, percent }) => `${name} ${value} (${(percent*100).toFixed(0)}%)`}>
              {sv.map((e,i) => <Cell key={i} fill={sc[e.name]||COLORS[i]} />)}
            </Pie>
            <Tooltip content={<CTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ gridColumn:'span 3' }}>
        <AutoReport data={data} />
      </div>
      <div style={cd}>
        <div style={tt}>POR MAGNITUD</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={md}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f33" />
            <XAxis dataKey="name" tick={{ fill:'#fbbf24', fontSize:10, fontWeight:700 }} />
            <YAxis tick={{ fill:'#94a3b8', fontSize:9 }} />
            <Tooltip content={<CTooltip />} />
            <Bar dataKey="value" name="Cantidad" radius={[4,4,0,0]}>
              {md.map((_,i) => <Cell key={i} fill={i>=3?'#ef4444':i>=2?'#f59e0b':i>=1?'#fb923c':'#3b82f6'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={cd}>
        <div style={tt}>POR REGION</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={rg} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f33" />
            <XAxis type="number" tick={{ fill:'#94a3b8', fontSize:9 }} />
            <YAxis type="category" dataKey="name" tick={{ fill:'#fbbf24', fontSize:10, fontWeight:600 }} width={75} />
            <Tooltip content={<CTooltip />} />
            <Bar dataKey="value" name="Eventos" radius={[0,4,4,0]}>
              {rg.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={cd}>
        <div style={tt}>POR FUENTE</div>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={bs} cx="50%" cy="50%" outerRadius={60} dataKey="cantidad"
              label={({ name, cantidad }) => `${name}:${cantidad}`} labelLine={false}>
              {bs.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
            </Pie>
            <Tooltip content={<CTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ ...cd, gridColumn:'span 3' }}>
        <div style={tt}>PROFUNDIDAD vs MAGNITUD</div>
        <ResponsiveContainer width="100%" height={180}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f33" />
            <XAxis type="number" dataKey="x" name="Magnitud" tick={{ fill:'#94a3b8', fontSize:9 }} />
            <YAxis type="number" dataKey="y" name="Prof.(km)" tick={{ fill:'#94a3b8', fontSize:9 }} />
            <ZAxis type="number" dataKey="z" range={[20,200]} />
            <Tooltip content={<CTooltip />} />
            <Scatter data={scat} fill="#3b82f6" fillOpacity={0.6} stroke="#60a5fa" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   PACIFIC MAP (Leaflet)
   ════════════════════════════════════════════ */
function PacificMapLeaflet({ earthquakes=[], buoys=[], focusedEqId=null, onClearFocus }) {
  const mapRef         = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef     = useRef([]);
  const buoyMarkersRef = useRef([]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    if (!document.getElementById('leaflet-css-main')) {
      const link = document.createElement('link');
      link.id='leaflet-css-main'; link.rel='stylesheet';
      link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    const L = require('leaflet');
    const map = L.map(mapRef.current, { center:[10,-150], zoom:3, minZoom:2, maxZoom:10, zoomControl:true, attributionControl:false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { subdomains:'abcd', maxZoom:19 }).addTo(map);
    L.control.attribution({ position:'bottomright', prefix:false }).addAttribution('CNAT - MICROHELP | CartoDB').addTo(map);
    mapInstanceRef.current = map;
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current=null; } };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const L = require('leaflet');
    const map = mapInstanceRef.current;
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];
    earthquakes.forEach(eq => {
      if (!eq.latitude || !eq.longitude) return;
      const c = sevColor(eq.severity);
      const r = Math.max(5, (eq.magnitude||0)*2.5);
      const isFocused  = eq.id === focusedEqId;
      const horasAtras = (Date.now() - new Date(eq.event_time).getTime()) / 3600000;
      const isPulse    = ((eq.severity==='critical' || eq.severity==='warning') && horasAtras <= 24) || isFocused;
      const icon = L.divIcon({
        className:'',
        html: `<div style="position:relative;width:${r*2}px;height:${r*2}px;">${isPulse?`<div style="position:absolute;inset:0;border-radius:50%;background:${c};opacity:0.25;animation:pulse-map 1.5s infinite;transform:scale(2.5);"></div>`:''}<div style="position:absolute;inset:0;border-radius:50%;background:${c};border:2px solid ${isFocused?'#fff':c};box-shadow:0 0 ${isFocused?14:6}px ${c};"></div>${eq.magnitude>=4.5||isFocused?`<div style="position:absolute;top:${r*2+3}px;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:10px;font-weight:700;color:${isFocused?'#fff':c};font-family:monospace;text-shadow:0 1px 3px #000;">M${eq.magnitude}</div>`:''}</div>`,
        iconSize:[r*2,r*2], iconAnchor:[r,r],
      });
      const marker = L.marker([eq.latitude,eq.longitude],{icon});
      marker.bindTooltip(
        `<div style="font-family:monospace;font-size:11px;line-height:1.6;min-width:200px"><b style="color:#fbbf24;font-size:14px">M${eq.magnitude}</b> <span style="color:${c};font-size:10px">${(eq.severity||'').toUpperCase()}</span><br/><span style="color:#e2e8f0">${eq.place||'N/A'}</span><br/><span style="color:#94a3b8">Prof: ${eq.depth_km}km | ${(eq.source_id||'').toUpperCase()}</span><br/><span style="color:#64748b">${new Date(eq.event_time).toLocaleString('es-PE')}</span></div>`,
        { className:'cnat-map-tooltip', direction:'top', offset:[0,-r] }
      );
      if (isFocused) marker.on('click', onClearFocus);
      marker.addTo(map);
      markersRef.current.push(marker);
    });
  }, [earthquakes, focusedEqId, onClearFocus]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const L = require('leaflet');
    const map = mapInstanceRef.current;
    buoyMarkersRef.current.forEach(m => map.removeLayer(m));
    buoyMarkersRef.current = [];
    buoys.forEach(b => {
      if (!b.latitude || !b.longitude) return;
      const c = b.status==='alert'?'#ef4444':b.status==='warning'?'#f59e0b':'#22c55e';
      const icon = L.divIcon({
        className:'',
        html: `<div style="display:flex;align-items:center;gap:4px;white-space:nowrap;"><div style="width:10px;height:10px;background:${c};border:2px solid #fff;border-radius:50%;box-shadow:0 0 6px ${c};flex-shrink:0;"></div><span style="font-size:9px;color:#fbbf24;font-family:monospace;background:rgba(5,11,24,0.85);padding:1px 3px;border-radius:2px;">${(b.name||'').replace('DART ','').substring(0,12)}</span></div>`,
        iconSize:[90,14], iconAnchor:[5,7],
      });
      const marker = L.marker([b.latitude,b.longitude],{icon});
      marker.bindTooltip(`<b style="color:#fbbf24">${b.name}</b><br/><span style="color:${c}">${(b.status||'').toUpperCase()}</span>`,{className:'cnat-map-tooltip',direction:'top'});
      marker.addTo(map);
      buoyMarkersRef.current.push(marker);
    });
  }, [buoys]);

  useEffect(() => {
    if (!mapInstanceRef.current || !focusedEqId) return;
    const eq = earthquakes.find(e => e.id === focusedEqId);
    if (eq?.latitude && eq?.longitude) mapInstanceRef.current.flyTo([eq.latitude,eq.longitude],6,{duration:1.5});
  }, [focusedEqId, earthquakes]);

  return (
    <>
      <style>{`@keyframes pulse-map{0%,100%{transform:scale(1.5);opacity:0.35}50%{transform:scale(2.8);opacity:0.08}}.cnat-map-tooltip{background:#0d1a2e!important;border:1px solid #1e3a5f!important;border-radius:6px!important;color:#e2e8f0!important;padding:8px 12px!important;box-shadow:0 4px 20px rgba(0,0,0,0.6)!important}.leaflet-control-zoom a{background:#0d1a2e!important;color:#fbbf24!important;border-color:#1e3a5f!important}.leaflet-control-zoom a:hover{background:#1e3a5f!important}.leaflet-control-attribution{background:#0d1a2ecc!important;color:#475569!important;font-size:9px!important}`}</style>
      <div ref={mapRef} style={{ width:'100%', height:'100%', background:'#060B18' }} />
    </>
  );
}

/* ════════════════════════════════════════════
   MAP LEGEND
   ════════════════════════════════════════════ */
function MapLegend() {
  return (
    <div style={{ display:'flex', gap:20, padding:'8px 16px', background:'#070e1f', borderTop:'1px solid #1e3a5f33', flexWrap:'wrap', alignItems:'center' }}>
      <span style={{ fontSize:10, color:'#fbbf24', fontWeight:700, letterSpacing:2 }}>LEYENDA:</span>
      {[['#ef4444','Critico M7.5+'],['#f59e0b','Alerta M6.0+'],['#fb923c','Moderado M4.5+'],['#64748b','Menor']].map(([c,l]) =>
        <div key={l} style={{ display:'flex', alignItems:'center', gap:5 }}>
          <div style={{ width:9, height:9, borderRadius:'50%', background:c }} />
          <span style={{ fontSize:10, color:c }}>{l}</span>
        </div>
      )}
      <span style={{ color:'#1e3a5f', fontSize:10 }}>|</span>
      {[['#22c55e','Boya OK'],['#f59e0b','Boya Anomalia'],['#ef4444','Boya Alerta']].map(([c,l]) =>
        <div key={l} style={{ display:'flex', alignItems:'center', gap:5 }}>
          <div style={{ width:9, height:9, borderRadius:'50%', background:c, border:'1.5px solid #fff' }} />
          <span style={{ fontSize:10, color:c }}>{l}</span>
        </div>
      )}
      <span style={{ fontSize:9, color:'#475569' }}>• Halo parpadeante = mayor peligro</span>
    </div>
  );
}

/* ════════════════════════════════════════════
   TIDE GAUGE MAP (Mareógrafo)
   ════════════════════════════════════════════ */
function TideGaugeMap() {
  const [stations,        setStations]        = useState([]);
  const [selectedStation, setSelectedStation] = useState(null);
  const [tideData,        setTideData]        = useState([]);
  const [loadingStations, setLoadingStations] = useState(true);
  const [loadingTide,     setLoadingTide]     = useState(false);
  const [stats,           setStats]           = useState(null);
  const [hours,           setHours]           = useState(24);
  const [filter,          setFilter]          = useState('all');
  const [debugInfo,       setDebugInfo]       = useState('');
  const mapRef         = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef     = useRef([]);

  const isInPacific = (lat, lon) =>
    ((lon >= -180 && lon <= -70) || (lon >= 100 && lon <= 180)) && lat >= -60 && lat <= 65;

  const mapStationFields = s => {
    const code      = s.code||s.Code||s.ID||s.id||'';
    const name      = s.name||s.location||s.Location||s.Name||'Unknown';
    const country   = s.country||s.Country||s.countryname||'';
    const lat       = parseFloat(s.lat||s.Lat||s.latitude||0);
    const lon       = parseFloat(s.lon||s.Lon||s.longitude||0);
    const apiStatus = s.api_status||s.status||'';
    let status = 'online';
    if (apiStatus==='offline'||apiStatus==='Closed') status='offline';
    return { code:String(code).trim(), name:String(name).trim(), country:String(country).trim(), lat, lon, status,
             sensor_type:s.sensor_type||s.sensor||'', performance:s.performance||'',
             operator:s.operator||s.localoperator||'', last_value:s.last_value||s.lastvalue||null, last_time:s.last_time||s.lasttime||'' };
  };

  const PERU_STATIONS = [
    {code:'tala2',name:'Talara',        country:'PER',lat:-4.58, lon:-81.28,status:'online', sensor_type:'prs',operator:'DHN Peru'},
    {code:'paita',name:'Paita',         country:'PER',lat:-5.08, lon:-81.11,status:'online', sensor_type:'prs',operator:'DHN Peru'},
    {code:'bayo', name:'Bayovar',       country:'PER',lat:-5.79, lon:-81.01,status:'offline',sensor_type:'prs',operator:'DHN Peru'},
    {code:'lobos',name:'Lobos de Afuera',country:'PER',lat:-6.94,lon:-80.71,status:'online',sensor_type:'prs',operator:'DHN Peru'},
    {code:'salav',name:'Salaverry',     country:'PER',lat:-8.23, lon:-78.98,status:'online', sensor_type:'prs',operator:'DHN Peru'},
    {code:'chimb',name:'Chimbote',      country:'PER',lat:-9.08, lon:-78.61,status:'online', sensor_type:'prs',operator:'DHN Peru'},
    {code:'huarm',name:'Huarmey',       country:'PER',lat:-10.07,lon:-78.15,status:'offline',sensor_type:'prs',operator:'DHN Peru'},
    {code:'chan', name:'Chancay',        country:'PER',lat:-11.59,lon:-77.27,status:'online', sensor_type:'prs',operator:'DHN Peru'},
    {code:'IsHor',name:'Isla Hormiga',  country:'PER',lat:-11.96,lon:-77.34,status:'online', sensor_type:'prs',operator:'DHN Peru'},
    {code:'call', name:'Callao',         country:'PER',lat:-12.07,lon:-77.17,status:'online', sensor_type:'prs',operator:'DHN Peru'},
    {code:'huach',name:'Huacho',        country:'PER',lat:-11.12,lon:-77.61,status:'offline',sensor_type:'prs',operator:'DHN Peru'},
    {code:'cazul',name:'Cerro Azul',    country:'PER',lat:-13.03,lon:-76.48,status:'offline',sensor_type:'prs',operator:'DHN Peru'},
    {code:'pdas', name:'Pisco / San Andres',country:'PER',lat:-13.72,lon:-76.22,status:'online',sensor_type:'prs',operator:'DHN Peru'},
    {code:'sjuan',name:'San Juan',      country:'PER',lat:-15.36,lon:-75.16,status:'online', sensor_type:'prs',operator:'DHN Peru'},
    {code:'chala',name:'Chala',         country:'PER',lat:-15.87,lon:-74.23,status:'online', sensor_type:'prs',operator:'DHN Peru'},
    {code:'mata', name:'Matarani',       country:'PER',lat:-17.00,lon:-72.11,status:'online', sensor_type:'prs',operator:'DHN Peru'},
    {code:'ilom', name:'Ilo',            country:'PER',lat:-17.64,lon:-71.34,status:'online', sensor_type:'prs',operator:'DHN Peru'},
  ];

  const mergeWithPeru = stations => {
    const peruCodesLower = new Set(PERU_STATIONS.map(s => s.code.toLowerCase()));
    const isPeruStation  = s => {
      if (peruCodesLower.has((s.code||'').toLowerCase())) return true;
      if (s.country==='PER'||s.country==='Peru')
        return PERU_STATIONS.some(p => Math.abs(p.lat-s.lat)<0.15 && Math.abs(p.lon-s.lon)<0.15);
      return false;
    };
    return [...PERU_STATIONS, ...stations.filter(s => !isPeruStation(s))];
  };

  useEffect(() => {
    const load = async () => {
      try {
        const r = await apiFetch('/sealevel/stations');
        const d = await r.json();
        if (d.stations?.length > 0) {
          const mapped = d.stations.map(mapStationFields).filter(s => s.code && s.lat && s.lon);
          const final  = mergeWithPeru(mapped);
          setStations(final);
          setDebugInfo(`${final.length} estaciones (${PERU_STATIONS.length} Peru prioritarias)`);
          setLoadingStations(false);
          return;
        }
        const r2      = await fetch('https://www.ioc-sealevelmonitoring.org/service.php?query=stationlist&showall=all&output=json');
        const allSt   = await r2.json();
        const pacific = allSt.map(mapStationFields).filter(s => s.code && s.lat && s.lon && isInPacific(s.lat, s.lon));
        const final   = mergeWithPeru(pacific);
        setStations(final);
        setDebugInfo(`${final.length} estaciones (${PERU_STATIONS.length} Peru prioritarias)`);
      } catch (e) { setDebugInfo(`Error: ${e.message}`); }
      setLoadingStations(false);
    };
    load();
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current || loadingStations) return;
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id='leaflet-css'; link.rel='stylesheet';
      link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    const L   = require('leaflet');
    const map = L.map(mapRef.current, { center:[0,-150], zoom:3, minZoom:2, maxZoom:12, zoomControl:true, attributionControl:false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { subdomains:'abcd', maxZoom:19 }).addTo(map);
    L.control.attribution({ position:'bottomright', prefix:false }).addAttribution('CNAT - MICROHELP | UNESCO/IOC SLSMF').addTo(map);
    mapInstanceRef.current = map;
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current=null; } };
  }, [loadingStations]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const L   = require('leaflet');
    const map = mapInstanceRef.current;
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];
    stations.filter(s => filter==='all' || s.status===filter).forEach(s => {
      const isOnline = s.status==='online', color=isOnline?'#22c55e':'#ef4444', isSel=selectedStation?.code===s.code;
      const icon = L.divIcon({
        className:'',
        html:`<div style="display:flex;align-items:center;gap:4px;white-space:nowrap;"><div style="width:${isSel?14:10}px;height:${isSel?14:10}px;flex-shrink:0;background:${color};border:2px solid ${isSel?'#fbbf24':'#fff'};border-radius:${isOnline?'50%':'2px'};box-shadow:0 0 ${isSel?12:6}px ${color};"></div><span style="font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:${isSel?700:400};color:${isSel?'#fbbf24':'#cbd5e1'};background:rgba(5,11,24,0.78);padding:1px 3px;border-radius:2px;pointer-events:none;">${s.name}</span></div>`,
        iconSize:[10,14], iconAnchor:[5,7],
      });
      const marker = L.marker([s.lat,s.lon],{icon}).addTo(map);
      marker.bindTooltip(
        `<div style="font-family:monospace;font-size:11px;line-height:1.4"><b style="color:#fbbf24">${s.name}</b><br/><span style="color:#94a3b8">${s.country} | <b>${s.code}</b></span><br/><span style="color:${color}">${isOnline?'● ONLINE':'■ OFFLINE'}</span><span style="color:#64748b"> | ${s.lat?.toFixed(2)}, ${s.lon?.toFixed(2)}</span></div>`,
        { className:'cnat-tooltip', direction:'top', offset:[0,-8] }
      );
      marker.on('click', () => handleStationClick(s));
      markersRef.current.push(marker);
    });
  }, [stations, filter, selectedStation]); // eslint-disable-line

  const handleStationClick = useCallback(async station => {
    setSelectedStation(station); setLoadingTide(true); setTideData([]); setStats(null);
    if (mapInstanceRef.current) mapInstanceRef.current.flyTo([station.lat,station.lon],6,{duration:1.5});
    if (!station.code) { setLoadingTide(false); return; }
    try {
      const r = await apiFetch(`/sealevel/station/${station.code}?hours=${hours}`);
      const d = await r.json();
      if (d.data?.length > 0) {
        const rawValues = d.data.map(p => p.value).filter(v => v!=null);
        const sorted    = [...rawValues].sort((a,b)=>a-b);
        const median    = sorted.length%2===0
          ? (sorted[sorted.length/2-1]+sorted[sorted.length/2])/2
          : sorted[Math.floor(sorted.length/2)];
        const processed = d.data.map(p => ({
          ...p,
          value: parseFloat((p.value-median).toFixed(4)),
          time:  new Date(p.timestamp).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}),
        }));
        setTideData(processed);
        const rel = processed.map(p=>p.value);
        setStats({ min:Math.min(...rel).toFixed(3), max:Math.max(...rel).toFixed(3),
                   mean:(rel.reduce((a,b)=>a+b,0)/rel.length).toFixed(3),
                   range:(Math.max(...rel)-Math.min(...rel)).toFixed(3), points:rel.length, median_abs:median.toFixed(3) });
      } else {
        try {
          const now2=new Date(), start2=new Date(now2.getTime()-hours*3600000);
          const r2 = await fetch(`https://www.ioc-sealevelmonitoring.org/service.php?query=data&code=${station.code}&timestart=${start2.toISOString().slice(0,16)}&timeend=${now2.toISOString().slice(0,16)}&format=json`);
          const raw = await r2.json();
          if (Array.isArray(raw)&&raw.length>0) {
            const proc = raw.filter(p=>p.slevel!=null&&p.slevel!=='').map(p=>({
              timestamp:p.stime||'', value:parseFloat(p.slevel),
              time:new Date(p.stime).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}),
            }));
            setTideData(proc);
            if (proc.length>0) {
              const vals=proc.map(p=>p.value);
              setStats({ min:Math.min(...vals).toFixed(3), max:Math.max(...vals).toFixed(3),
                         mean:(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(3),
                         range:(Math.max(...vals)-Math.min(...vals)).toFixed(3), points:vals.length });
            }
          }
        } catch(corsErr) { console.warn('[CNAT] IOC v1 CORS:', corsErr.message); }
      }
    } catch (e) { console.error('[CNAT] Error datos marea:', e); }
    setLoadingTide(false);
  }, [hours]);

  const onlineCount  = stations.filter(s=>s.status==='online').length;
  const offlineCount = stations.length - onlineCount;

  return (
    <div style={{ display:'flex', height:'100%', gap:0 }}>
      <style>{`.cnat-tooltip{background:#0d1a2e!important;border:1px solid #1e3a5f!important;border-radius:6px!important;color:#e2e8f0!important;padding:8px 12px!important;box-shadow:0 4px 20px rgba(0,0,0,0.5)!important}.leaflet-control-zoom a{background:#0d1a2e!important;color:#fbbf24!important;border-color:#1e3a5f!important}.leaflet-control-zoom a:hover{background:#1e3a5f!important}`}</style>
      <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', borderBottom:'1px solid #1e3a5f', background:'#0d1a2e' }}>
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:'#fbbf24', letterSpacing:1 }}>MAPA MAREOGRAFICO DEL PACIFICO</div>
            <div style={{ fontSize:9, color:'#64748b', marginTop:2 }}>Fuente: UNESCO/IOC Sea Level Station Monitoring Facility | Mapa: CartoDB Dark</div>
          </div>
          <div style={{ display:'flex', gap:14, fontSize:11 }}>
            <span style={{ color:'#22c55e' }}>● ONLINE: <b>{onlineCount}</b></span>
            <span style={{ color:'#ef4444' }}>■ OFFLINE: <b>{offlineCount}</b></span>
            <span style={{ color:'#94a3b8' }}>TOTAL: <b>{stations.length}</b></span>
            {debugInfo && <span style={{ color:'#8b5cf6', fontSize:9 }}>({debugInfo})</span>}
          </div>
        </div>
        <div style={{ display:'flex', gap:6, padding:'6px 16px', borderBottom:'1px solid #1e3a5f22', background:'#070e1f', justifyContent:'space-between' }}>
          <div style={{ display:'flex', gap:6 }}>
            {['all','online','offline'].map(f => (
              <button key={f} onClick={()=>setFilter(f)} style={{ background:filter===f?'#3b82f622':'transparent', border:`1px solid ${filter===f?'#3b82f6':'#1e3a5f'}`, color:filter===f?'#3b82f6':'#64748b', padding:'3px 12px', borderRadius:4, cursor:'pointer', fontSize:10, fontFamily:'inherit', letterSpacing:1 }}>
                {f==='all'?`TODAS (${stations.length})`:f==='online'?`ONLINE (${onlineCount})`:`OFFLINE (${offlineCount})`}
              </button>
            ))}
          </div>
          <div style={{ display:'flex', gap:4 }}>
            {[{name:'PACIFICO',lat:0,lon:-150,zoom:3},{name:'PERU',lat:-10,lon:-77,zoom:6},{name:'CHILE',lat:-33,lon:-72,zoom:5},{name:'JAPON',lat:36,lon:140,zoom:5}].map(v => (
              <button key={v.name} onClick={()=>mapInstanceRef.current?.flyTo([v.lat,v.lon],v.zoom,{duration:1.5})} style={{ background:'transparent', border:'1px solid #1e3a5f', color:'#fbbf24', padding:'3px 10px', borderRadius:4, cursor:'pointer', fontSize:9, fontFamily:'inherit', letterSpacing:1, fontWeight:700 }}>{v.name}</button>
            ))}
          </div>
        </div>
        <div style={{ flex:1, minHeight:400, position:'relative' }}>
          {loadingStations && <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'#060B18', zIndex:1000, color:'#fbbf24', fontSize:14, letterSpacing:2 }}>CARGANDO ESTACIONES DEL PACIFICO...</div>}
          <div ref={mapRef} style={{ width:'100%', height:'100%', background:'#060B18' }} />
        </div>
        <div style={{ maxHeight:140, overflow:'auto', borderTop:'1px solid #1e3a5f', background:'#0d1a2e' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
            <thead>
              <tr style={{ color:'#64748b', textAlign:'left', position:'sticky', top:0, background:'#0d1a2e' }}>
                {['STATUS','CODIGO','ESTACION','PAIS','LAT','LON'].map(h => <th key={h} style={{ padding:'5px 10px' }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {stations.filter(s=>filter==='all'||s.status===filter).slice(0,50).map((s,idx) => (
                <tr key={`${s.code}-${idx}`} onClick={()=>handleStationClick(s)} style={{ cursor:'pointer', background:selectedStation?.code===s.code?'#3b82f622':'transparent', borderBottom:'1px solid #1e3a5f22' }}>
                  <td style={{ padding:'4px 10px' }}><span style={{ display:'inline-block', width:8, height:8, borderRadius:s.status==='online'?'50%':2, background:s.status==='online'?'#22c55e':'#ef4444' }}/></td>
                  <td style={{ padding:'4px 8px', color:'#3b82f6', fontWeight:700 }}>{s.code}</td>
                  <td style={{ padding:'4px 8px', color:'#e2e8f0' }}>{s.name}</td>
                  <td style={{ padding:'4px 8px', color:'#64748b' }}>{s.country}</td>
                  <td style={{ padding:'4px 8px', color:'#64748b' }}>{s.lat?.toFixed(2)}</td>
                  <td style={{ padding:'4px 8px', color:'#64748b' }}>{s.lon?.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {selectedStation && (
        <div style={{ width:380, borderLeft:'1px solid #1e3a5f', background:'#0d1a2e', display:'flex', flexDirection:'column', overflow:'auto' }}>
          <div style={{ padding:'12px 14px', borderBottom:'1px solid #1e3a5f', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div style={{ fontSize:9, color:'#64748b', letterSpacing:1 }}>ESTACION SELECCIONADA</div>
              <div style={{ fontSize:16, fontWeight:700, color:'#fbbf24', marginTop:4 }}>{selectedStation.name}</div>
              <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>{selectedStation.country} • Codigo: <span style={{ color:'#3b82f6' }}>{selectedStation.code||'⚠ SIN CODIGO'}</span></div>
            </div>
            <button onClick={()=>{setSelectedStation(null);setTideData([]);setStats(null);}} style={{ background:'transparent', border:'1px solid #1e3a5f', color:'#64748b', padding:'3px 8px', borderRadius:4, cursor:'pointer', fontSize:14, fontFamily:'inherit' }}>✕</button>
          </div>
          <div style={{ padding:'8px 14px', display:'flex', gap:10, alignItems:'center' }}>
            <span style={{ display:'flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:4, background:selectedStation.status==='online'?'#22c55e22':'#ef444422', border:`1px solid ${selectedStation.status==='online'?'#22c55e44':'#ef444444'}`, fontSize:11 }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:selectedStation.status==='online'?'#22c55e':'#ef4444' }}/>
              {selectedStation.status==='online'?'OPERATIVA':'SIN DATOS'}
            </span>
            <span style={{ fontSize:10, color:'#64748b' }}>{selectedStation.lat?.toFixed(4)}, {selectedStation.lon?.toFixed(4)}</span>
          </div>
          <div style={{ display:'flex', gap:5, padding:'6px 14px', borderBottom:'1px solid #1e3a5f' }}>
            <span style={{ fontSize:9, color:'#64748b', alignSelf:'center', marginRight:8 }}>PERIODO:</span>
            {[6,12,24,48].map(h => (
              <button key={h} onClick={()=>{setHours(h);handleStationClick(selectedStation);}} style={{ background:hours===h?'#06b6d422':'transparent', border:`1px solid ${hours===h?'#06b6d4':'#1e3a5f'}`, color:hours===h?'#06b6d4':'#64748b', padding:'2px 10px', borderRadius:4, cursor:'pointer', fontSize:11, fontFamily:'inherit' }}>{h}h</button>
            ))}
          </div>
          <div style={{ padding:'12px 8px 8px 0', height:260 }}>
            <div style={{ fontSize:9, color:'#64748b', letterSpacing:1, paddingLeft:14, marginBottom:6 }}>NIVEL DEL MAR RELATIVO (metros)</div>
            {loadingTide
              ? <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:200, color:'#64748b' }}><div style={{ textAlign:'center' }}><div style={{ fontSize:24, marginBottom:8 }}>~</div>Cargando datos...</div></div>
              : tideData.length > 0
                ? <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={tideData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f33" vertical={false}/>
                      <XAxis dataKey="time" tick={{ fill:'#64748b', fontSize:9 }} axisLine={{ stroke:'#1e3a5f' }} tickLine={false} interval={Math.floor(tideData.length/8)}/>
                      <YAxis tick={{ fill:'#64748b', fontSize:9 }} axisLine={{ stroke:'#1e3a5f' }} tickLine={false} domain={['auto','auto']} tickFormatter={v=>`${v}m`}/>
                      <Tooltip contentStyle={{ background:'#0d1a2e', border:'1px solid #1e3a5f', borderRadius:6, fontSize:11, color:'#e2e8f0' }} formatter={value=>[`${value} m`,'Nivel del mar']} labelFormatter={label=>`Hora: ${label}`}/>
                      <ReferenceLine y={0} stroke="#64748b" strokeDasharray="5 5"/>
                      <Line type="monotone" dataKey="value" stroke="#06b6d4" strokeWidth={2} dot={false} activeDot={{ r:4, fill:'#06b6d4', stroke:'#060B18', strokeWidth:2 }}/>
                    </LineChart>
                  </ResponsiveContainer>
                : <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:200, color:'#64748b', fontSize:12, flexDirection:'column', gap:8 }}>
                    {!selectedStation.code
                      ? <><span style={{ color:'#ef4444', fontSize:14 }}>⚠</span><span>Estacion sin codigo IOC</span></>
                      : <><span>No hay datos disponibles</span><span style={{ fontSize:10, color:'#475569' }}>Codigo: {selectedStation.code} | Periodo: {hours}h</span></>}
                  </div>}
          </div>
          {stats && stats.points > 0 && (
            <div style={{ padding:'10px 14px', borderTop:'1px solid #1e3a5f' }}>
              <div style={{ fontSize:9, color:'#64748b', letterSpacing:1, marginBottom:8 }}>RESUMEN ESTADISTICO</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {[{l:'Maximo',v:`${stats.max} m`,c:'#ef4444'},{l:'Minimo',v:`${stats.min} m`,c:'#3b82f6'},{l:'Promedio',v:`${stats.mean} m`,c:'#06b6d4'},{l:'Rango',v:`${stats.range} m`,c:'#f59e0b'}].map(item => (
                  <div key={item.l} style={{ background:'#070e1f', border:'1px solid #1e3a5f44', borderRadius:6, padding:'6px 10px' }}>
                    <div style={{ fontSize:9, color:'#64748b' }}>{item.l}</div>
                    <div style={{ fontSize:15, fontWeight:700, color:item.c, marginTop:1, fontFamily:"'Orbitron'" }}>{item.v}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:9, color:'#475569', marginTop:6, textAlign:'center' }}>{stats.points} puntos • Ultimas {hours} horas</div>
            </div>
          )}
          <div style={{ padding:'10px 14px', borderTop:'1px solid #1e3a5f', fontSize:11 }}>
            <div style={{ fontSize:9, color:'#64748b', letterSpacing:1, marginBottom:6 }}>METADATA</div>
            {[['Fuente','IOC/SLSMF (UNESCO)'],['Sensor',selectedStation.sensor_type||'prs'],['Performance',selectedStation.performance||'N/A'],['Operador',selectedStation.operator||'N/A']].map(([k,v]) => (
              <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'2px 0' }}>
                <span style={{ color:'#64748b' }}>{k}</span>
                <span style={{ color:'#e2e8f0', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textAlign:'right' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   VIGÍA RESUMEN CRT
   ════════════════════════════════════════════ */
function VigiaResumenCRT({ summary, procesando = false }) {
  const [displayText, setDisplayText] = useState('');
  const [typing,      setTyping]      = useState(false);
  const [dots,        setDots]        = useState('');
  const timerRef  = useRef(null);
  const dotsRef   = useRef(null);
  const prevIdRef = useRef(null);

  useEffect(() => {
    if (procesando) {
      setDisplayText(''); setTyping(false);
      if (timerRef.current) clearInterval(timerRef.current);
      dotsRef.current = setInterval(() => setDots(d => d.length>=6?'':d+'.'), 300);
    } else {
      clearInterval(dotsRef.current); setDots('');
    }
    return () => clearInterval(dotsRef.current);
  }, [procesando]);

  const fechaEmision = summary?.generated_at
    ? new Date(summary.generated_at).toLocaleString('es-PE',{weekday:'long',day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'}).toUpperCase()
    : '';

  const textoCompleto = summary?.summary_text
    ? `> BOLETÍN VIGÍA -- ${fechaEmision}\n> ARTÍCULOS: ${summary.articles_count} | SCORE: ${summary.relevance_score}/10\n${'─'.repeat(60)}\n${summary.summary_text.substring(0,900)}${summary.summary_text.length>900?'\n[...ver VIGÍA (IA) para detalle completo]':''}`
    : '';

  useEffect(() => {
    if (!textoCompleto || summary?.id===prevIdRef.current || procesando) return;
    prevIdRef.current = summary?.id;
    setDisplayText(''); setTyping(true);
    if (timerRef.current) clearInterval(timerRef.current);
    let i=0;
    setTimeout(() => {
      timerRef.current = setInterval(() => {
        i++;
        setDisplayText(textoCompleto.substring(0,i));
        if (i>=textoCompleto.length) { clearInterval(timerRef.current); setTyping(false); }
      }, 10);
    }, 200);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [summary?.id, textoCompleto, procesando]);

  const scoreColor  = summary?.relevance_score>=6?'#ff4444':summary?.relevance_score>=4?'#ffaa00':'#00ff00';
  const borderColor = procesando?'#ffaa0044':'#00ff0033';
  const dotColor    = procesando?'#ffaa00':'#00ff00';

  return (
    <div style={{ marginTop:16, background:'#000000', border:`2px solid ${borderColor}`, borderRadius:8, padding:16, position:'relative', overflow:'hidden', boxShadow:`inset 0 0 60px rgba(0,255,0,0.03), 0 0 15px rgba(0,255,0,0.08)` }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, background:'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,0,0.012) 2px, rgba(0,255,0,0.012) 4px)', pointerEvents:'none', zIndex:1 }} />
      <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,transparent,#00ff0066,transparent)', zIndex:2 }} />
      <div style={{ position:'relative', zIndex:3, fontFamily:"'Courier New', Courier, monospace" }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, paddingBottom:8, borderBottom:'1px solid #00ff0022' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:13, color:'#00ff00', fontWeight:700, letterSpacing:3, textShadow:'0 0 8px rgba(0,255,0,0.6)' }}>{'>'} VIGÍA::ESCUCHA_SOCIAL</span>
            <div style={{ width:8, height:8, borderRadius:'50%', background:dotColor, animation:'blink 1.5s infinite', boxShadow:`0 0 6px ${dotColor}` }} />
            {(typing||procesando) && <span style={{ fontSize:9, color:`${dotColor}88`, animation:'blink 0.4s infinite' }}>{procesando?'PROCESANDO...':'TRANSMITIENDO...'}</span>}
          </div>
          {!procesando && summary && <div style={{ fontSize:9, color:'#00ff0066' }}>SCORE: <span style={{ color:scoreColor, fontWeight:700 }}>{summary.relevance_score}/10</span></div>}
        </div>
        <div style={{ fontSize:12, color:'#00cc00', lineHeight:1.4, whiteSpace:'pre-wrap', textShadow:'0 0 4px rgba(0,255,0,0.2)', letterSpacing:0.3, minHeight:70 }}>
          {procesando
            ? <div style={{ paddingTop:8 }}>
                <div style={{ color:'#ffaa00', fontSize:14, fontWeight:700, letterSpacing:2, textShadow:'0 0 10px rgba(255,170,0,0.6)', animation:'blink 1s infinite' }}>{`> PROCESANDO${dots}`}</div>
                <div style={{ color:'#ffaa0088', fontSize:11, marginTop:8 }}>{'> Capturando noticias y generando análisis...'}</div>
                <div style={{ color:'#ffaa0055', fontSize:10, marginTop:4 }}>{'> Por favor espere un momento'}</div>
              </div>
            : <>
                {displayText || <span style={{ color:'#00ff0033' }}>{'> INICIANDO TRANSMISIÓN...'}</span>}
                {typing  && <span style={{ animation:'blink 0.4s infinite', color:'#00ff00', textShadow:'0 0 8px #00ff00' }}>█</span>}
                {!typing && displayText && <span style={{ animation:'blink 0.8s infinite', color:'#00ff0066' }}>█</span>}
              </>}
        </div>
        <div style={{ marginTop:10, paddingTop:8, borderTop:'1px solid #00ff0015', display:'flex', justifyContent:'space-between', fontSize:9, color:'#00ff0033' }}>
          <span>CNAT::VIGÍA::v2.0 | Claude AI</span>
          <span>BBC MUNDO · NYT ESPAÑOL · WASHINGTON POST</span>
          <span>AUTO: 06:00 UTC DIARIO</span>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   FUENTES TAB  ← [FASE 3] ModuloIGP integrado
   ════════════════════════════════════════════ */
function FuentesTab({ sr=[], data, session }) {
  const [ejecutandoFetch,    setEjecutandoFetch]    = useState(false);
  const [ejecutandoNoticias, setEjecutandoNoticias] = useState(false);
  const [ejecutandoResumen,  setEjecutandoResumen]  = useState(false);
  const [mensaje,            setMensaje]            = useState('');
  const [vistaIGP,           setVistaIGP]           = useState(false);  // [FASE 3]
  const ahora   = Date.now();
  const BACKEND = process.env.REACT_APP_API_URL || 'https://cnat-backend-1.onrender.com';

  const getToken = async () => {
    const { data: { session: s } } = await supabase.auth.getSession();
    return s?.access_token;
  };

  const getEstado = s => {
    const fm = s.fetch_mode;
    if (!fm || fm==='pending') return 'construccion';
    if (s.status==='error') return 'error';
    if (!s.last_fetch) return fm==='daily'?'en_espera':'iniciando';
    const mins = (ahora - new Date(s.last_fetch).getTime())/60000;
    if (fm==='realtime') return mins<=15?'en_linea':'iniciando';
    if (fm==='daily')    return 'en_espera';
    return 'construccion';
  };

  const ORDEN = { en_linea:0, en_espera:1, iniciando:2, error:3, construccion:4 };
  const CFG = {
    en_linea:     {label:'EN LÍNEA',       color:'#22c55e',bg:'#22c55e15',border:'#22c55e44',icono:'⚙️', anim:'spin 2s linear infinite',         pulso:true },
    en_espera:    {label:'EN ESPERA',       color:'#f59e0b',bg:'#f59e0b15',border:'#f59e0b44',icono:'⏳',anim:'hourglass 3s ease-in-out infinite',pulso:false},
    iniciando:    {label:'INICIANDO',       color:'#3b82f6',bg:'#3b82f615',border:'#3b82f644',icono:'🔄',anim:'spin 1.5s linear infinite',        pulso:false},
    error:        {label:'ERROR',           color:'#ef4444',bg:'#ef444415',border:'#ef444444',icono:'⛔',anim:'none',                             pulso:false},
    construccion: {label:'EN CONSTRUCCIÓN', color:'#475569',bg:'#47556915',border:'#47556944',icono:'🔧',anim:'none',                             pulso:false},
  };

  const catLabels = {
    sismo:    '🔴 SISMOLÓGICAS',
    alerta:   '🚨 CENTROS DE ALERTA',
    boya:     '🌊 BOYAS / NIVEL DEL MAR',
    noticias: '📰 NOTICIAS / ESCUCHA SOCIAL',
  };

  const ordenarFuentes = fuentes =>
    [...fuentes].sort((a,b)=>(ORDEN[getEstado(a)]??9)-(ORDEN[getEstado(b)]??9));

  const counts = {
    en_linea:     sr.filter(s=>getEstado(s)==='en_linea').length,
    en_espera:    sr.filter(s=>getEstado(s)==='en_espera').length,
    error:        sr.filter(s=>getEstado(s)==='error').length,
    construccion: sr.filter(s=>getEstado(s)==='construccion').length,
  };

  const ejecutarFetchGeneral = async () => {
    setEjecutandoFetch(true); setMensaje('');
    try { const token=await getToken(); await fetch(`${BACKEND}/fetch`,{headers:{Authorization:`Bearer ${token}`}}); setMensaje(`✅ Fetch general ejecutado: ${new Date().toLocaleTimeString('es-PE')}`); }
    catch { setMensaje('❌ Error al ejecutar fetch'); }
    setEjecutandoFetch(false);
  };

  const ejecutarNoticias = async () => {
    setEjecutandoNoticias(true); setMensaje('');
    try {
      const token=await getToken();
      setMensaje('⏳ Capturando noticias (BBC · NYT · WaPo)...');
      await fetch(`${BACKEND}/fetch`,{headers:{Authorization:`Bearer ${token}`}});
      setMensaje('⏳ Generando resumen VIGÍA con Claude...');
      await fetch(`${BACKEND}/fetch-summary`,{headers:{Authorization:`Bearer ${token}`}});
      setMensaje(`✅ Noticias y resumen VIGÍA actualizados: ${new Date().toLocaleTimeString('es-PE')} — Recarga para ver`);
    } catch { setMensaje('❌ Error al ejecutar noticias'); }
    setEjecutandoNoticias(false);
  };

  const ejecutarResumen = async () => {
    setEjecutandoResumen(true); setMensaje('');
    try { const token=await getToken(); await fetch(`${BACKEND}/fetch-summary`,{headers:{Authorization:`Bearer ${token}`}}); setMensaje(`✅ Resumen VIGÍA generado: ${new Date().toLocaleTimeString('es-PE')}`); }
    catch { setMensaje('❌ Error al generar resumen'); }
    setEjecutandoResumen(false);
  };

  // ── Token para ModuloIGP ──
  const [tokenStr, setTokenStr] = useState('');
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s?.access_token) setTokenStr(s.access_token);
    });
  }, []);

  return (
    <div style={{ padding:4 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes hourglass{0%,100%{transform:rotate(0deg)}50%{transform:rotate(180deg)}}@keyframes pulse-dot{0%,100%{box-shadow:0 0 0 0 #22c55e88}50%{box-shadow:0 0 0 5px #22c55e00}}`}</style>

      {/* ── Cabecera con toggle IGP ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:10 }}>
        <h3 style={{ fontSize:14, color:'#fbbf24', letterSpacing:2, margin:0 }}>FUENTES DE INFORMACIÓN — CNAT</h3>
        <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
          <span style={{ fontSize:11, color:'#22c55e' }}>⚙️ <b>{counts.en_linea}</b></span>
          <span style={{ fontSize:11, color:'#f59e0b' }}>⏳ <b>{counts.en_espera}</b></span>
          <span style={{ fontSize:11, color:'#ef4444' }}>⛔ <b>{counts.error}</b></span>
          <span style={{ fontSize:11, color:'#475569' }}>🔧 <b>{counts.construccion}</b></span>
          {/* [FASE 3] Botón IGP */}
          <button onClick={()=>setVistaIGP(v=>!v)} style={{ padding:'5px 14px', borderRadius:5, border:`1px solid ${vistaIGP?'#00bfff':'#1e3a5f'}`, background:vistaIGP?'#00bfff18':'transparent', color:vistaIGP?'#00bfff':'#64748b', fontSize:10, cursor:'pointer', fontFamily:'inherit', fontWeight:700, letterSpacing:1 }}>
            {vistaIGP ? '◀ VOLVER A FUENTES' : '◈ INTELIGENCIA IGP'}
          </button>
          <button onClick={ejecutarFetchGeneral} disabled={ejecutandoFetch} style={{ padding:'5px 12px', borderRadius:5, border:'1px solid #3b82f666', background:'#3b82f618', color:'#60a5fa', fontSize:10, cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>{ejecutandoFetch?'⏳':'▶ FETCH GENERAL'}</button>
          <button onClick={ejecutarResumen} disabled={ejecutandoResumen} style={{ padding:'5px 12px', borderRadius:5, border:'1px solid #8b5cf666', background:'#8b5cf618', color:'#c4b5fd', fontSize:10, cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>{ejecutandoResumen?'⏳':'📰 RESUMEN VIGÍA'}</button>
        </div>
      </div>

      {mensaje && <div style={{ marginBottom:10, padding:'7px 12px', borderRadius:6, background:mensaje.startsWith('✅')?'#22c55e15':'#ef444415', border:`1px solid ${mensaje.startsWith('✅')?'#22c55e44':'#ef444444'}`, fontSize:11, color:mensaje.startsWith('✅')?'#22c55e':'#ef4444' }}>{mensaje}</div>}

      {/* ══════════════════════════════════════
          [FASE 3] MÓDULO IGP — toggle
      ══════════════════════════════════════ */}
      {vistaIGP ? (
        <ModuloIGP apiBase={API_BASE} token={tokenStr} />
      ) : (
        <>
          {['sismo','alerta','boya','noticias'].map(tipo => {
            const fuentes  = ordenarFuentes(sr.filter(s=>s.source_type===tipo));
            if (!fuentes.length) return null;
            const esNoticias = tipo==='noticias';
            return (
              <div key={tipo} style={{ marginBottom:18 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8, paddingBottom:4, borderBottom:'1px solid #1e3a5f' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', letterSpacing:2 }}>{catLabels[tipo]}</div>
                  {esNoticias && <button onClick={ejecutarNoticias} disabled={ejecutandoNoticias} style={{ padding:'4px 12px', borderRadius:5, border:'1px solid #f59e0b66', background:'#f59e0b18', color:'#fbbf24', fontSize:10, cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>{ejecutandoNoticias?'⏳ Ejecutando...':'▶ EJECUTAR NOTICIAS (BBC · NYT · WaPo)'}</button>}
                </div>
                <div style={{ borderRadius:8, overflow:'hidden', border:'1px solid #1e3a5f44' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', background:'#0d1a2e' }}>
                    <thead><tr style={{ background:'#0a1628' }}>{['Estado','Fuente','País','Descripción','Último fetch','Acción'].map(h=><th key={h} style={{ padding:'8px 12px', fontSize:9, fontWeight:700, color:'#64748b', textAlign:'left', borderBottom:'1px solid #1e3a5f', letterSpacing:1, whiteSpace:'nowrap' }}>{h}</th>)}</tr></thead>
                    <tbody>
                      {fuentes.map((s,idx) => {
                        const estado=getEstado(s), cfg=CFG[estado];
                        const lastFetch=s.last_fetch?new Date(s.last_fetch).toLocaleString('es-PE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
                        const puedeEjecutar=(estado==='error'||estado==='iniciando')&&!esNoticias;
                        return (
                          <tr key={s.id} style={{ borderBottom:'1px solid #1e3a5f22', background:idx%2===0?'#0d1a2e':'#0a1628' }}>
                            <td style={{ padding:'10px 12px', whiteSpace:'nowrap' }}>
                              <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 10px', borderRadius:6, background:cfg.bg, border:`1px solid ${cfg.border}` }}>
                                <span style={{ fontSize:14, display:'inline-block', animation:cfg.anim!=='none'?cfg.anim:undefined }}>{cfg.icono}</span>
                                <span style={{ fontSize:10, fontWeight:700, color:cfg.color }}>{cfg.label}</span>
                                {cfg.pulso && <div style={{ width:6, height:6, borderRadius:'50%', background:'#22c55e', animation:'pulse-dot 1.5s infinite' }}/>}
                              </div>
                            </td>
                            <td style={{ padding:'10px 12px' }}><div style={{ fontSize:13, fontWeight:700, color:'#fbbf24' }}>{s.name}</div><div style={{ fontSize:9, color:'#475569', marginTop:2 }}>{s.id} · {s.alcance||s.country||'—'}</div></td>
                            <td style={{ padding:'10px 12px', fontSize:11, color:'#94a3b8', whiteSpace:'nowrap' }}>{s.country||'—'}</td>
                            <td style={{ padding:'10px 12px', fontSize:11, color:'#cbd5e1', lineHeight:1.5, maxWidth:340 }}>{s.descripcion||<span style={{ color:'#334155', fontStyle:'italic' }}>Sin descripción</span>}</td>
                            <td style={{ padding:'10px 12px', fontSize:10, color:lastFetch==='—'?'#334155':'#64748b', whiteSpace:'nowrap' }}>{lastFetch}</td>
                            <td style={{ padding:'10px 12px', whiteSpace:'nowrap' }}>{puedeEjecutar?<button onClick={ejecutarFetchGeneral} disabled={ejecutandoFetch} style={{ padding:'4px 10px', borderRadius:5, border:`1px solid ${cfg.color}66`, background:`${cfg.color}18`, color:cfg.color, fontSize:10, cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>{ejecutandoFetch?'⏳':'▶ EJECUTAR'}</button>:<span style={{ fontSize:10, color:'#334155' }}>—</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          {data?.news_summary && <VigiaResumenCRT summary={data.news_summary} procesando={ejecutandoNoticias||ejecutandoResumen} />}
        </>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   LOGIN
   ════════════════════════════════════════════ */
function LoginScreen({ onLogin }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleLogin = async e => {
    e.preventDefault(); setLoading(true); setError('');
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) setError(err.message==='Invalid login credentials'?'Credenciales incorrectas':err.message);
    else onLogin();
    setLoading(false);
  };

  return (
    <div style={{ minHeight:'100vh', background:'#050b18', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'JetBrains Mono', monospace" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
      <div style={{ width:420, background:'#0a1628', border:'1px solid #1e3a5f', borderRadius:12, overflow:'hidden', boxShadow:'0 0 60px rgba(59,130,246,0.1)' }}>
        <div style={{ background:'linear-gradient(90deg,#0a1628,#0d2847,#0a1628)', borderBottom:'2px solid #f59e0b', padding:'24px 32px', textAlign:'center' }}>
          <div style={{ width:56, height:56, borderRadius:10, background:'linear-gradient(135deg,#1e40af,#3b82f6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, fontWeight:'bold', color:'#fff', margin:'0 auto 12px', boxShadow:'0 0 20px rgba(59,130,246,0.4)' }}>C</div>
          <div style={{ fontFamily:"'Orbitron', monospace", fontSize:22, fontWeight:700, color:'#f59e0b', letterSpacing:4 }}>CNAT</div>
          <div style={{ fontSize:10, color:'#fbbf24', letterSpacing:2, marginTop:4 }}>CENTRO NACIONAL DE ALERTA DE TSUNAMIS</div>
          <div style={{ fontSize:9, color:'#475569', marginTop:6, letterSpacing:1 }}>DIRECCIÓN DE HIDROGRAFÍA Y NAVEGACIÓN — MGP</div>
        </div>
        <form onSubmit={handleLogin} style={{ padding:32 }}>
          <div style={{ fontSize:11, color:'#fbbf24', letterSpacing:2, fontWeight:700, marginBottom:20, textAlign:'center' }}>ACCESO AUTORIZADO</div>
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:10, color:'#94a3b8', letterSpacing:1, display:'block', marginBottom:6 }}>CORREO INSTITUCIONAL</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoFocus style={{ width:'100%', padding:'12px 14px', background:'#060c1a', border:'1px solid #1e3a5f', borderRadius:6, color:'#e2e8f0', fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} placeholder="usuario@dhn.mil.pe" />
          </div>
          <div style={{ marginBottom:24 }}>
            <label style={{ fontSize:10, color:'#94a3b8', letterSpacing:1, display:'block', marginBottom:6 }}>CONTRASEÑA</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required style={{ width:'100%', padding:'12px 14px', background:'#060c1a', border:'1px solid #1e3a5f', borderRadius:6, color:'#e2e8f0', fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} placeholder="••••••••" />
          </div>
          {error && <div style={{ background:'#7f1d1d', border:'1px solid #ef4444', borderRadius:6, padding:'10px 14px', fontSize:12, color:'#fca5a5', marginBottom:16 }}>⚠ {error}</div>}
          <button type="submit" disabled={loading} style={{ width:'100%', padding:14, background:loading?'#334155':'linear-gradient(90deg,#1e40af,#3b82f6)', border:'none', borderRadius:6, color:'#fff', fontSize:13, fontWeight:700, letterSpacing:2, cursor:loading?'not-allowed':'pointer', fontFamily:'inherit' }}>{loading?'VERIFICANDO...':'INGRESAR AL SISTEMA'}</button>
          <div style={{ marginTop:20, padding:10, background:'#0d1a2e', borderRadius:6, border:'1px solid #1e3a5f33' }}>
            <div style={{ fontSize:9, color:'#475569', textAlign:'center', letterSpacing:1 }}>SISTEMA RESTRINGIDO — SOLO PERSONAL AUTORIZADO</div>
            <div style={{ fontSize:9, color:'#334155', textAlign:'center', marginTop:4 }}>Todo acceso queda registrado</div>
          </div>
        </form>
        <div style={{ borderTop:'1px solid #1e3a5f22', padding:'10px 32px', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:8, color:'#334155' }}>CNAT v3.0</span>
          <span style={{ fontSize:8, color:'#334155' }}>MICROHELP © 2026</span>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   AUTH HOOK
   ════════════════════════════════════════════ */
function useAuth() {
  const [session,     setSession]     = useState(undefined);
  const [userProfile, setUserProfile] = useState(null);

  const fetchProfile = useCallback(async userId => {
    const { data } = await supabase.from('cnat_users').select('*').eq('id', userId).single();
    setUserProfile(data);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => { setSession(s); if (s?.user) fetchProfile(s.user.id); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s); if (s?.user) fetchProfile(s.user.id); else setUserProfile(null);
    });
    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const logout = async () => { await supabase.auth.signOut(); };
  const role   = userProfile?.role || 'readonly';
  return { session, userProfile, role, isAdmin: role==='admin', canEdit: role==='admin'||role==='operador', logout };
}

/* ════════════════════════════════════════════
   USUARIOS TAB
   ════════════════════════════════════════════ */
function UsersTab() {
  const [users,     setUsers]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [editingId, setEditingId] = useState(null);
  const ROLES = ['admin','operador','readonly'];
  const roleColor = r => r==='admin'?'#ef4444':r==='operador'?'#3b82f6':'#64748b';

  useEffect(() => {
    supabase.from('cnat_users').select('*').order('created_at').then(({ data }) => { setUsers(data||[]); setLoading(false); });
  }, []);

  const updateRole   = async (id, role) => { await supabase.from('cnat_users').update({ role }).eq('id', id); setUsers(u=>u.map(x=>x.id===id?{...x,role}:x)); setEditingId(null); };
  const toggleActive = async (id, active) => { await supabase.from('cnat_users').update({ active:!active }).eq('id', id); setUsers(u=>u.map(x=>x.id===id?{...x,active:!active}:x)); };

  if (loading) return <div style={{ color:'#94a3b8', padding:40, textAlign:'center' }}>Cargando usuarios...</div>;
  return (
    <div>
      <h3 style={{ fontSize:14, color:'#fbbf24', letterSpacing:2, marginBottom:16 }}>GESTIÓN DE USUARIOS</h3>
      <div style={{ borderRadius:10, overflow:'hidden', border:'1px solid #1e3a5f' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', background:'#0d1a2e' }}>
          <thead><tr style={{ background:'#0a1628' }}>{['Usuario','Correo','Rol','Último acceso','Estado','Acción'].map(h=><th key={h} style={{ padding:'10px 14px', fontSize:10, fontWeight:700, color:'#fbbf24', textAlign:'left', borderBottom:'1px solid #1e3a5f', letterSpacing:1 }}>{h}</th>)}</tr></thead>
          <tbody>{users.map(u=>(
            <tr key={u.id} style={{ borderBottom:'1px solid #1e3a5f22' }}>
              <td style={{ padding:'10px 14px', fontSize:13, color:'#e2e8f0', fontWeight:600 }}>{u.full_name}</td>
              <td style={{ padding:'10px 14px', fontSize:11, color:'#94a3b8' }}>{u.email}</td>
              <td style={{ padding:'10px 14px' }}>
                {editingId===u.id
                  ? <select defaultValue={u.role} onChange={e=>updateRole(u.id,e.target.value)} style={{ background:'#0a1628', border:'1px solid #1e3a5f', color:'#e2e8f0', padding:'4px 8px', borderRadius:4, fontSize:11, fontFamily:'inherit' }}>{ROLES.map(r=><option key={r} value={r}>{r}</option>)}</select>
                  : <span style={{ padding:'3px 10px', borderRadius:4, background:`${roleColor(u.role)}20`, color:roleColor(u.role), fontSize:11, fontWeight:700 }}>{u.role}</span>}
              </td>
              <td style={{ padding:'10px 14px', fontSize:10, color:'#64748b' }}>{u.last_login?new Date(u.last_login).toLocaleString('es-PE'):'Nunca'}</td>
              <td style={{ padding:'10px 14px' }}><span style={{ color:u.active?'#22c55e':'#ef4444', fontSize:11, fontWeight:700 }}>{u.active?'ACTIVO':'INACTIVO'}</span></td>
              <td style={{ padding:'10px 14px', display:'flex', gap:6 }}>
                <button onClick={()=>setEditingId(editingId===u.id?null:u.id)} style={{ padding:'4px 10px', background:'#1e3a5f', border:'none', borderRadius:4, color:'#fbbf24', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>ROL</button>
                <button onClick={()=>toggleActive(u.id,u.active)} style={{ padding:'4px 10px', background:u.active?'#7f1d1d':'#14532d', border:'none', borderRadius:4, color:u.active?'#fca5a5':'#86efac', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>{u.active?'DESACTIVAR':'ACTIVAR'}</button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div style={{ marginTop:12, fontSize:10, color:'#475569' }}>Para crear nuevos usuarios: Supabase Dashboard → Authentication → Users → Add User</div>
    </div>
  );
}

/* ════════════════════════════════════════════
   MAIN APP
   ════════════════════════════════════════════ */
export default function App() {
  const { session, userProfile, role, isAdmin, logout } = useAuth();
  const [data,       setData]         = useState(null);
  const [loading,    setLoading]      = useState(true);
  const [error,      setError]        = useState(null);
  const [tab,        setTab]          = useState('mapa');
  const [now,        setNow]          = useState(new Date());
  const [focusedEqId,setFocusedEqId]  = useState(null);
  const pingRef    = useRef(null);
  const focusTimer = useRef(null);

  const playAlert5s = useCallback(() => {
    try {
      if (!pingRef.current) pingRef.current = new (window.AudioContext||window.webkitAudioContext)();
      const ctx = pingRef.current;
      const beep = t => {
        const o=ctx.createOscillator(), g=ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type='sine'; o.frequency.setValueAtTime(1400,t); o.frequency.exponentialRampToValueAtTime(900,t+0.2);
        g.gain.setValueAtTime(0.5,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.4);
        o.start(t); o.stop(t+0.4);
      };
      const n = ctx.currentTime;
      [0,0.6,1.2,1.8,2.4,3.0,3.6,4.2,4.8].forEach(dt => beep(n+dt));
    } catch(e) {}
  }, []);

  const focusEq = useCallback(id => {
    setFocusedEqId(id); setTab('mapa'); playAlert5s();
    if (focusTimer.current) clearTimeout(focusTimer.current);
    focusTimer.current = setTimeout(() => setFocusedEqId(null), 5000);
  }, [playAlert5s]);

  const clearFocus = useCallback(() => {
    setFocusedEqId(null);
    if (focusTimer.current) clearTimeout(focusTimer.current);
  }, []);

  const playAlarm = useAlarmSound();
  const prevC     = useRef(0);

  const fetchData = useCallback(async () => {
    try {
      const r = await apiFetch('/dashboard');
      const d = await r.json();
      setData(d); setError(null);
      if (d.kpis?.critical_count > 0 && d.kpis.critical_count > prevC.current) playAlarm();
      prevC.current = d.kpis?.critical_count || 0;
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [playAlarm]);

  useEffect(() => {
    if (session) { fetchData(); const i=setInterval(fetchData,30000); return ()=>clearInterval(i); }
  }, [fetchData, session]);

  useEffect(() => { const i=setInterval(()=>setNow(new Date()),1000); return ()=>clearInterval(i); }, []);

  if (session === undefined) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', gap:20, background:'#050b18' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width:50, height:50, border:'3px solid #1e3a5f', borderTop:'3px solid #f59e0b', borderRadius:'50%', animation:'spin 1s linear infinite' }}/>
      <div style={{ color:'#fbbf24', fontSize:14, letterSpacing:2, fontFamily:"'JetBrains Mono'" }}>VERIFICANDO ACCESO...</div>
    </div>
  );
  if (!session) return <LoginScreen onLogin={()=>{}} />;
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', gap:20, background:'#050b18' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
      <div style={{ width:50, height:50, border:'3px solid #1e3a5f', borderTop:'3px solid #f59e0b', borderRadius:'50%', animation:'spin 1s linear infinite' }}/>
      <div style={{ color:'#fbbf24', fontSize:14, letterSpacing:2, fontFamily:"'JetBrains Mono'" }}>CONECTANDO...</div>
    </div>
  );

  const k  = data?.kpis        || {};
  const eq = data?.earthquakes || [];
  const al = data?.alerts      || [];
  const bu = data?.buoys       || [];
  const sr = data?.sources     || [];
  const th = data?.thresholds  || [];

  const isA       = k.critical_count > 0;
  const rC        = k.risk_level==='ALTO'?'#ef4444':k.risk_level==='MEDIO'?'#f59e0b':'#22c55e';
  const roleColor = role==='admin'?'#ef4444':role==='operador'?'#3b82f6':'#64748b';

  const tabs      = ['mapa','analytics','alertas','tsunami','mareografo','boyas','fuentes','umbrales','aria','vigia',...(isAdmin?['usuarios']:[])];
  const tabColors = { aria:'#8b5cf6', vigia:'#06b6d4', analytics:'#06b6d4', mareografo:'#06b6d4', tsunami:'#00E5FF', usuarios:'#ef4444', fuentes:'#00bfff' };
  const tabLabels = { mapa:'MAPA', analytics:'ANALYTICS', alertas:'ALERTAS', tsunami:'🌊 TSUNAMI', mareografo:'MAREOGRAFO', boyas:'BOYAS', fuentes:'FUENTES', umbrales:'UMBRALES', aria:'ARIA (IA)', vigia:'🔭 VIGIA (IA)', usuarios:'👤 USUARIOS' };
  const fullWidthTabs = new Set(['mareografo','tsunami']);

  return (
    <div style={{ background:'#050b18', color:'#e2e8f0', minHeight:'100vh', fontFamily:"'JetBrains Mono',monospace" }}>
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}@keyframes pulse-border{0%,100%{border-color:#ef4444}50%{border-color:transparent}}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:#0a1628}::-webkit-scrollbar-thumb{background:#1e3a5f;border-radius:4px}`}</style>
      {isA && <div style={{ position:'fixed', inset:0, zIndex:100, pointerEvents:'none', border:'4px solid #ef4444', animation:'pulse-border 0.5s infinite' }}/>}

      {/* ── HEADER ── */}
      <header style={{ background:'linear-gradient(90deg,#0a1628,#0d2847,#0a1628)', borderBottom:'2px solid #f59e0b', padding:'12px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:46, height:46, borderRadius:8, background:'linear-gradient(135deg,#1e40af,#3b82f6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:'bold', color:'#fff', boxShadow:'0 0 20px rgba(59,130,246,0.3)' }}>C</div>
          <div>
            <h1 style={{ fontFamily:"'Orbitron'", fontSize:20, fontWeight:700, letterSpacing:3, color:'#f59e0b', margin:0 }}>CNAT</h1>
            <p style={{ fontSize:10, color:'#fbbf24', letterSpacing:1.5, margin:0 }}>CENTRO NACIONAL DE ALERTA DE TSUNAMIS</p>
          </div>
          <div style={{ padding:'6px 14px', borderRadius:4, background:isA?'#7f1d1d':'#0f2a1a', border:`2px solid ${isA?'#ef4444':'#22c55e'}`, display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:10, height:10, borderRadius:'50%', background:isA?'#ef4444':'#22c55e' }}/>
            <span style={{ fontSize:12, fontWeight:700, color:isA?'#fca5a5':'#86efac' }}>{isA?'ALERTA':'OPERATIVO'}</span>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:20 }}>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:11, color:'#94a3b8' }}>{userProfile?.full_name||session?.user?.email}</div>
            <div style={{ display:'flex', alignItems:'center', gap:6, justifyContent:'flex-end', marginTop:2 }}>
              <span style={{ fontSize:9, padding:'2px 8px', borderRadius:3, background:`${roleColor}22`, color:roleColor, fontWeight:700, letterSpacing:1 }}>{role?.toUpperCase()}</span>
              <button onClick={logout} style={{ fontSize:9, padding:'2px 8px', background:'#1e3a5f', border:'1px solid #334155', borderRadius:3, color:'#94a3b8', cursor:'pointer', fontFamily:'inherit', letterSpacing:1 }}>SALIR</button>
            </div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontFamily:"'Orbitron'", fontSize:22, fontWeight:700, color:'#f59e0b' }}>{now.toLocaleTimeString('es-PE')}</div>
            <div style={{ fontSize:11, color:'#fbbf24' }}>{now.toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
          </div>
        </div>
      </header>

      {/* ── KPIs ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:8, padding:'10px 20px', background:'#070e1f' }}>
        {[
          {l:'SISMOS',  v:k.total_earthquakes||0,                    c:'#3b82f6'},
          {l:'ALERTAS', v:k.active_alerts||0,                        c:k.active_alerts>0?'#ef4444':'#22c55e'},
          {l:'CRITICOS',v:k.critical_count||0,                       c:k.critical_count>0?'#ef4444':'#22c55e'},
          {l:'BOYAS',   v:`${k.alert_buoys||0}/${k.total_buoys||0}`, c:k.alert_buoys>0?'#f59e0b':'#22c55e'},
          {l:'FUENTES', v:`${k.sources_online||0}/${k.total_sources||0}`, c:k.sources_online>=18?'#22c55e':'#f59e0b'},
          {l:'RIESGO',  v:k.risk_level||'BAJO',                      c:rC},
        ].map((x,i) => (
          <div key={i} style={{ background:'#0d1a2e', border:`1px solid ${x.c}44`, borderRadius:8, padding:12, position:'relative' }}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:x.c }}/>
            <div style={{ fontSize:10, color:'#fbbf24', fontWeight:700, marginBottom:4 }}>{x.l}</div>
            <div style={{ fontSize:26, fontWeight:700, color:x.c, fontFamily:"'Orbitron'", lineHeight:1 }}>{x.v}</div>
          </div>
        ))}
      </div>

      {/* ── TABS ── */}
      <div style={{ display:'flex', padding:'0 20px', background:'#070e1f', borderBottom:'2px solid #1e3a5f', overflowX:'auto' }}>
        {tabs.map(t => (
          <button key={t} onClick={()=>setTab(t)} style={{
            padding:'14px 20px', background:tab===t?'#1e3a5f':'transparent',
            border:'none', borderBottom:tab===t?`3px solid ${tabColors[t]||'#f59e0b'}`:'3px solid transparent',
            color:tab===t?(tabColors[t]||'#fbbf24'):'#e2e8f0',
            cursor:'pointer', fontSize:15, fontWeight:700, letterSpacing:2, fontFamily:'inherit', whiteSpace:'nowrap',
          }}>
            {tabLabels[t]||t.toUpperCase()}
            {t==='alertas'&&al.length>0&&<span style={{ background:'#ef4444', color:'#fff', borderRadius:10, padding:'2px 8px', fontSize:11, fontWeight:700, marginLeft:8 }}>{al.length}</span>}
            {t==='tsunami'&&k.critical_count>0&&<span style={{ background:'#F44336', color:'#fff', borderRadius:10, padding:'2px 8px', fontSize:11, fontWeight:700, marginLeft:8 }}>{k.critical_count}</span>}
          </button>
        ))}
      </div>

      {/* ── CONTENIDO ── */}
      <div style={{
        display:'grid',
        gridTemplateColumns: fullWidthTabs.has(tab) ? '1fr' : tab==='mapa' ? '1fr 200px 200px 360px' : '1fr 420px',
        gap:0,
        height:'calc(100vh - 220px)',
      }}>
        {/* Columna principal */}
        <div style={{ padding:fullWidthTabs.has(tab)?0:12, overflow:'auto', height:'100%' }}>

          {tab==='mapa' && (
            <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
              <div style={{ flex:1, overflow:'hidden', minHeight:0 }}>
                <PacificMapLeaflet earthquakes={eq.filter(e => (Date.now() - new Date(e.event_time).getTime()) / 86400000 <= 3)} buoys={bu} focusedEqId={focusedEqId} onClearFocus={clearFocus} />
              </div>
              <MapLegend />
            </div>
          )}

          {tab==='analytics'  && <AnalyticsDashboard earthquakes={eq} buoys={bu} sources={sr} data={data} />}
          {tab==='alertas'    && <ModuloAlertasDHN earthquakes={eq} alerts={al} kpis={k} />}
          {tab==='tsunami'    && <div style={{ padding:16, height:'100%', overflow:'auto' }}><TsunamiTracker backendUrl="https://cnat-backend-1.onrender.com" /></div>}
          {tab==='mareografo' && <TideGaugeMap />}

          {tab==='boyas' && (
            <div>
              <h3 style={{ fontSize:14, color:'#fbbf24', letterSpacing:2, marginBottom:10 }}>ESTACIONES DART</h3>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                {bu.map(b => {
                  const c = b.status==='alert'?'#ef4444':b.status==='warning'?'#f59e0b':'#22c55e';
                  return (
                    <div key={b.id} style={{ background:'#0d1a2e', border:`1px solid ${c}33`, borderRadius:8, padding:14 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                        <span style={{ fontSize:13, fontWeight:600, color:'#fbbf24' }}>{b.name}</span>
                        <div style={{ width:12, height:12, borderRadius:'50%', background:c }}/>
                      </div>
                      <div style={{ fontSize:10, color:'#94a3b8' }}>{b.country} | {b.latitude?.toFixed(2)},{b.longitude?.toFixed(2)}</div>
                      <div style={{ marginTop:6, textAlign:'center', padding:4, borderRadius:4, background:`${c}15` }}>
                        <span style={{ fontSize:11, fontWeight:700, color:c }}>{b.status==='normal'?'NORMAL':'ANOMALIA'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* [FASE 3] FUENTES con ModuloIGP integrado */}
          {tab==='fuentes'   && <FuentesTab sr={sr} data={data} session={session} />}

          {tab==='umbrales' && (
            <div>
              <h3 style={{ fontSize:14, color:'#fbbf24', letterSpacing:2, marginBottom:10 }}>UMBRALES DHN</h3>
              <div style={{ borderRadius:10, overflow:'hidden', border:'2px solid #1e3a5f' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', background:'#0d1a2e' }}>
                  <thead><tr style={{ background:'#0a1628' }}>{['Magnitud','Prof.','Accion','Semaforo','Descripcion'].map(h=><th key={h} style={{ padding:12, fontSize:11, fontWeight:700, color:'#fbbf24', textAlign:'left', borderBottom:'1px solid #1e3a5f' }}>{h}</th>)}</tr></thead>
                  <tbody>{th.map((t,i)=>(
                    <tr key={i}>
                      <td style={{ padding:12, fontSize:16, fontWeight:700, color:thrColor(t.action), fontFamily:"'Orbitron'" }}>M{t.min_magnitude}+</td>
                      <td style={{ padding:12, color:'#e2e8f0' }}>{t.max_depth_km}km</td>
                      <td style={{ padding:12 }}><span style={{ padding:'4px 12px', borderRadius:4, background:`${thrColor(t.action)}20`, color:thrColor(t.action), fontWeight:700 }}>{t.action}</span></td>
                      <td style={{ padding:12 }}><div style={{ width:20, height:20, borderRadius:'50%', background:thrColor(t.action) }}/></td>
                      <td style={{ padding:12, color:'#cbd5e1', fontSize:12 }}>{t.description}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}

          {tab==='aria'     && <ModuloARIA data={data} />}
          {tab==='vigia'    && <ModuloVIGIA data={data} />}
          {tab==='usuarios' && isAdmin && <UsersTab />}
        </div>

        {/* ── SIDEBAR ── */}
        {!fullWidthTabs.has(tab) && tab==='mapa' && (
          <>
            <div style={{ background:'#070e1f', borderLeft:'1px solid #1e3a5f', overflow:'auto', display:'flex', flexDirection:'column' }}>
              <StatsSummary earthquakes={eq} alerts={al} buoys={bu} onFocus={focusEq} />
              <PanelIGP tweets={data?.igp_tweets || []} />
            </div>
            <div style={{ background:'#070e1f', borderLeft:'1px solid #1e3a5f', overflow:'auto', padding:12, display:'flex', flexDirection:'column' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <h3 style={{ fontSize:11, color:'#fbbf24', letterSpacing:2, fontWeight:700 }}>FEED SISMICO</h3>
                <div style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e', animation:'blink 2s infinite' }}/>
              </div>
              {[...eq].sort((a,b)=>b.magnitude-a.magnitude).slice(0,100).map(e => {
                const c=sevColor(e.severity), isFocused=e.id===focusedEqId;
                return (
                  <div key={e.id} onClick={()=>focusEq(e.id)} style={{ padding:'6px 8px', borderRadius:6, marginBottom:4, borderLeft:`3px solid ${c}`, background:isFocused?'#1e3a5f44':'#0d1a2e44', cursor:'pointer', outline:isFocused?`1px solid ${c}`:'none', transition:'background 0.2s' }} title="Ver en mapa">
                    <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ fontSize:13, fontWeight:700, color:c, fontFamily:"'Orbitron'" }}>M{e.magnitude}</span><span style={{ fontSize:8, color:'#94a3b8' }}>{new Date(e.event_time).toLocaleTimeString('es-PE')}</span></div>
                    <div style={{ fontSize:9, color:'#cbd5e1', marginTop:1 }}>{e.place}</div>
                    <div style={{ display:'flex', gap:6, marginTop:1 }}><span style={{ fontSize:8, color:'#94a3b8' }}>Prof:{e.depth_km}km</span><span style={{ fontSize:8, color:'#94a3b8' }}>{e.source_id?.toUpperCase()}</span></div>
                  </div>
                );
              })}
              <div style={{ marginTop:'auto', borderTop:'1px solid #1e3a5f', paddingTop:8, display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontSize:9, color:'#f59e0b', fontWeight:700 }}>MICROHELP v3.0</span>
                <span style={{ fontSize:9, color:'#22c55e', fontWeight:700 }}>DATOS REALES</span>
              </div>
            </div>
            <div style={{ background:'#070e1f', borderLeft:'1px solid #1e3a5f', overflow:'auto', padding:10 }}>
              <AutoReport data={data} />
            </div>
          </>
        )}

        {!fullWidthTabs.has(tab) && tab!=='mapa' && (
          <div style={{ background:'#070e1f', borderLeft:'1px solid #1e3a5f', display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
              <div style={{ flex:1, borderRight:'1px solid #1e3a5f', overflow:'auto' }}>
                <StatsSummary earthquakes={eq} alerts={al} buoys={bu} onFocus={focusEq} />
                <PanelIGP tweets={data?.igp_tweets || []} />
              </div>
              <div style={{ flex:1, overflow:'auto', padding:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <h3 style={{ fontSize:12, color:'#fbbf24', letterSpacing:2, fontWeight:700 }}>FEED SISMICO</h3>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:'#22c55e', animation:'blink 2s infinite' }}/>
                </div>
                {[...eq].sort((a,b)=>b.magnitude-a.magnitude).slice(0,100).map(e => {
                  const c=sevColor(e.severity), isFocused=e.id===focusedEqId;
                  return (
                    <div key={e.id} onClick={()=>focusEq(e.id)} style={{ padding:'7px 10px', borderRadius:6, marginBottom:4, borderLeft:`4px solid ${c}`, background:isFocused?'#1e3a5f44':'#0d1a2e44', cursor:'pointer', outline:isFocused?`1px solid ${c}`:'none', transition:'background 0.2s' }} title="Ver en mapa">
                      <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ fontSize:14, fontWeight:700, color:c, fontFamily:"'Orbitron'" }}>M{e.magnitude}</span><span style={{ fontSize:9, color:'#94a3b8' }}>{new Date(e.event_time).toLocaleTimeString('es-PE')}</span></div>
                      <div style={{ fontSize:10, color:'#cbd5e1', marginTop:2 }}>{e.place}</div>
                      <div style={{ display:'flex', gap:8, marginTop:2 }}><span style={{ fontSize:9, color:'#94a3b8' }}>Prof:{e.depth_km}km</span><span style={{ fontSize:9, color:'#94a3b8' }}>{e.source_id?.toUpperCase()}</span></div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ borderTop:'1px solid #1e3a5f', padding:'8px 12px', display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize:10, color:'#f59e0b', fontWeight:700 }}>MICROHELP v3.0</span>
              <span style={{ fontSize:10, color:'#22c55e', fontWeight:700 }}>DATOS REALES</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
