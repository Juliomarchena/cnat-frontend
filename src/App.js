import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ZAxis, LineChart, Line, ReferenceLine } from 'recharts';

const API = 'https://cnat-backend-1.onrender.com/api';
const CLAUDE_KEY = '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';
const sevColor = s => s==='critical'?'#ef4444':s==='warning'?'#f59e0b':s==='moderate'?'#fb923c':'#64748b';
const thrColor = a => a==='ALARMA'?'#ef4444':a==='ALERTA'?'#f59e0b':a==='INFORMACION'?'#3b82f6':'#22c55e';
const COLORS = ['#3b82f6','#ef4444','#f59e0b','#22c55e','#8b5cf6','#ec4899','#06b6d4','#84cc16'];
function useAlarmSound(){const c=useRef(null);return useCallback(()=>{try{if(!c.current)c.current=new(window.AudioContext||window.webkitAudioContext)();const o=c.current.createOscillator(),g=c.current.createGain();o.connect(g);g.connect(c.current.destination);o.frequency.setValueAtTime(800,c.current.currentTime);o.frequency.setValueAtTime(600,c.current.currentTime+0.15);g.gain.setValueAtTime(0.3,c.current.currentTime);g.gain.exponentialRampToValueAtTime(0.01,c.current.currentTime+0.5);o.start();o.stop(c.current.currentTime+0.5);}catch(e){}},[]);}
const CTooltip = ({active,payload,label}) => {if(!active||!payload?.length)return null;return<div style={{background:'#0d1a2e',border:'1px solid #1e3a5f',borderRadius:6,padding:'8px 12px',fontSize:11,color:'#e2e8f0'}}><p style={{color:'#fbbf24',fontWeight:700,marginBottom:4}}>{label}</p>{payload.map((p,i)=><p key={i} style={{color:p.color}}>{p.name}: {typeof p.value==='number'?p.value.toFixed(1):p.value}</p>)}</div>;};

/* ═══ AUTO REPORT ═══ */
function AutoReport({ data }) {
  const [report, setReport] = useState('');
  const [displayText, setDisplayText] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [typing, setTyping] = useState(false);
  const timerRef = useRef(null);
  useEffect(() => {
    if (!report) return;
    const full = `> ${report.split('\n').filter(l=>l.trim()).join('\n> ')}`;
    setDisplayText(''); setTyping(true);
    let i = 0;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => { i++; setDisplayText(full.substring(0, i)); if (i >= full.length) { clearInterval(timerRef.current); setTyping(false); } }, 40);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [report]);
  const generateReport = useCallback(async () => {
    if (!data?.earthquakes?.length) return;
    setLoading(true); setDisplayText(''); setReport('');
    const k = data.kpis || {};
    const sig = (data.earthquakes || []).filter(e => e.magnitude >= 4.5).slice(0, 5);
    const prompt = `Genera un MICRO-REPORTE compacto de 5 lineas para el operador de guardia del CNAT. Usa semaforo VERDE/AMARILLO/ROJO al inicio. Incluye: estado, sismos relevantes con magnitud y lugar, boyas, recomendacion. Sin lineas vacias, sin markdown, compacto.
Datos: ${k.total_earthquakes||0} sismos, ${k.critical_count||0} criticos, ${k.warning_count||0} advertencia, ${k.alert_buoys||0}/${k.total_buoys||0} boyas, ${k.sources_online||0}/${k.total_sources||0} fuentes, riesgo ${k.risk_level||'BAJO'}.
Sismos M4.5+: ${sig.map(e=>`M${e.magnitude} ${e.place} (${e.depth_km}km)`).join(', ')||'Ninguno'}
Alertas: ${(data.alerts||[]).length > 0 ? data.alerts[0].title : 'Sin alertas'}`;
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': CLAUDE_KEY, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 200, messages: [{ role: 'user', content: prompt }] }) });
      const d = await r.json();
      setReport((d.content?.[0]?.text || 'Error').split('\n').filter(l=>l.trim()).join('\n'));
      setLastUpdate(new Date());
    } catch (e) { setReport('Error conexion IA'); }
    setLoading(false);
  }, [data]);
  useEffect(() => { if (data?.earthquakes?.length && !report && !loading) generateReport(); const i = setInterval(generateReport, 5*60*1000); return () => clearInterval(i); }, [data, generateReport, report, loading]);
  return (
    <div style={{ background: '#000000', borderRadius: 6, border: '1px solid #00ff0033', padding: 12, position: 'relative', overflow: 'hidden', boxShadow: 'inset 0 0 60px rgba(0,255,0,0.03), 0 0 10px rgba(0,255,0,0.1)' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,0,0.015) 2px, rgba(0,255,0,0.015) 4px)', pointerEvents: 'none', zIndex: 1 }} />
      <div style={{ position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#00ff00', letterSpacing: 3, fontWeight: 700, fontFamily: "'Courier New', monospace", textShadow: '0 0 8px rgba(0,255,0,0.5)' }}>{'>'}  ARIA::INFORME</span>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00ff00', animation: 'blink 1.5s infinite', boxShadow: '0 0 6px #00ff00' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {(loading||typing) && <span style={{ color: '#00ff0088', fontSize: 9, fontFamily: "'Courier New', monospace", animation: 'blink 0.3s infinite' }}>{loading?'PROCESANDO...':'TRANSMITIENDO...'}</span>}
            <span style={{ fontSize: 9, color: '#00ff0066', fontFamily: "'Courier New', monospace" }}>{lastUpdate ? `[${lastUpdate.toLocaleTimeString('es-PE')}]` : ''}</span>
            <button onClick={generateReport} disabled={loading||typing} style={{ background: '#00ff0011', border: '1px solid #00ff0033', borderRadius: 3, color: '#00ff00', fontSize: 9, padding: '2px 8px', cursor: loading?'not-allowed':'pointer', fontFamily: "'Courier New', monospace" }}>REFRESH</button>
          </div>
        </div>
        <div style={{ borderTop: '1px solid #00ff0022', paddingTop: 5 }}>
          <div style={{ fontSize: 12, color: '#00ff00', lineHeight: 1.4, whiteSpace: 'pre-wrap', fontFamily: "'Courier New', monospace", textShadow: '0 0 4px rgba(0,255,0,0.3)', letterSpacing: 0.3 }}>
            {loading && !displayText ? '> Conectando con ARIA...\n> Analizando datos sismicos...' : displayText || '> Iniciando...'}{typing && <span style={{ animation: 'blink 0.4s infinite', color: '#00ff00', textShadow: '0 0 8px #00ff00' }}>█</span>}
          </div>
        </div>
        <div style={{ borderTop: '1px solid #00ff0015', marginTop: 6, paddingTop: 4, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 8, color: '#00ff0044', fontFamily: "'Courier New', monospace" }}>CNAT::ARIA::v1.0 | Refresh: 5min</span>
          <span style={{ fontSize: 8, color: '#00ff0044', fontFamily: "'Courier New', monospace" }}>Claude AI</span>
        </div>
      </div>
    </div>
  );
}

/* ═══ STATS PANEL ═══ */
function StatsSummary({ earthquakes=[], alerts=[], buoys=[] }) {
  const mags=earthquakes.map(e=>e.magnitude).filter(Boolean); const depths=earthquakes.map(e=>e.depth_km).filter(Boolean);
  const magMax=mags.length?Math.max(...mags):0, magAvg=mags.length?(mags.reduce((a,b)=>a+b,0)/mags.length):0;
  const depthAvg=depths.length?(depths.reduce((a,b)=>a+b,0)/depths.length):0, depthMax=depths.length?Math.max(...depths):0;
  const critical=earthquakes.filter(e=>e.severity==='critical').length, warning=earthquakes.filter(e=>e.severity==='warning').length;
  const moderate=earthquakes.filter(e=>e.severity==='moderate').length, normal=earthquakes.filter(e=>e.severity==='normal').length;
  const lastSig=earthquakes.filter(e=>e.magnitude>=4.5)[0];
  const timeSince=d=>{if(!d)return'N/A';const m=Math.floor((Date.now()-new Date(d).getTime())/60000);return m<60?`${m}min`:m<1440?`${Math.floor(m/60)}h${m%60}m`:`${Math.floor(m/1440)}d`;};
  return (
    <div style={{ padding: 12, borderBottom: '1px solid #1e3a5f' }}>
      <div style={{ fontSize: 11, color: '#fbbf24', letterSpacing: 2, fontWeight: 700, marginBottom: 8 }}>RESUMEN NUMERICO</div>
      {lastSig && <div style={{ background: '#0d1a2e', borderRadius: 8, padding: 10, marginBottom: 8, borderLeft: `4px solid ${sevColor(lastSig.severity)}` }}>
        <div style={{ fontSize: 9, color: '#fbbf24', fontWeight: 700, marginBottom: 3 }}>ULTIMO SIGNIFICATIVO</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}><span style={{ fontSize: 18, fontWeight: 700, color: sevColor(lastSig.severity), fontFamily: "'Orbitron'" }}>M{lastSig.magnitude}</span><span style={{ fontSize: 10, color: '#94a3b8' }}>hace {timeSince(lastSig.event_time)}</span></div>
        <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 2 }}>{lastSig.place}</div>
      </div>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {[['Mag. maxima', magMax.toFixed(1), magMax >= 6 ? '#ef4444' : '#f59e0b'], ['Mag. promedio', magAvg.toFixed(1), '#06b6d4'], ['Prof. promedio', `${depthAvg.toFixed(0)}km`, '#8b5cf6'], ['Prof. maxima', `${depthMax.toFixed(0)}km`, '#8b5cf6'],
            [null], ['Criticos M7.5+', critical, critical > 0 ? '#ef4444' : '#22c55e'], ['Alerta M6.0+', warning, warning > 0 ? '#f59e0b' : '#22c55e'], ['Moderados M4.5+', moderate, '#fb923c'], ['Menores', normal, '#64748b'],
            [null], ['Boyas anomalia', `${buoys.filter(b => b.status !== 'normal').length}/${buoys.length}`, buoys.some(b => b.status !== 'normal') ? '#ef4444' : '#22c55e'], ['Alertas tsunami', alerts.length, alerts.length > 0 ? '#ef4444' : '#22c55e']
          ].map((r, i) => r[0] === null ? <tr key={i}><td colSpan={2} style={{ height: 4 }}></td></tr> : <tr key={i}><td style={{ padding: '3px 0', fontSize: 10, color: '#94a3b8' }}>{r[0]}</td><td style={{ padding: '3px 0', fontSize: 12, color: r[2], fontWeight: 700, textAlign: 'right', fontFamily: "'Orbitron'" }}>{r[1]}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

/* ═══ ANALYTICS ═══ */
function AnalyticsDashboard({ earthquakes = [], buoys = [], sources = [], data = null }) {
  const tl = (() => { const h = {}; earthquakes.forEach(eq => { const hr = new Date(eq.event_time).getHours(), k = `${hr}:00`; if (!h[k]) h[k] = { hora: k, cantidad: 0, magMax: 0 }; h[k].cantidad++; h[k].magMax = Math.max(h[k].magMax, eq.magnitude); }); return Object.values(h).sort((a, b) => parseInt(a.hora) - parseInt(b.hora)); })();
  const md = (() => { const r = { 'M2-3': 0, 'M3-4': 0, 'M4-5': 0, 'M5-6': 0, 'M6+': 0 }; earthquakes.forEach(eq => { const m = eq.magnitude; if (m >= 6) r['M6+']++; else if (m >= 5) r['M5-6']++; else if (m >= 4) r['M4-5']++; else if (m >= 3) r['M3-4']++; else r['M2-3']++; }); return Object.entries(r).map(([n, v]) => ({ name: n, value: v })); })();
  const sv = (() => { const c = { Normal: 0, Moderado: 0, Alerta: 0, Critico: 0 }; earthquakes.forEach(eq => { if (eq.severity === 'critical') c.Critico++; else if (eq.severity === 'warning') c.Alerta++; else if (eq.severity === 'moderate') c.Moderado++; else c.Normal++; }); return Object.entries(c).filter(([, v]) => v > 0).map(([n, v]) => ({ name: n, value: v })); })();
  const sc = { Normal: '#64748b', Moderado: '#fb923c', Alerta: '#f59e0b', Critico: '#ef4444' };
  const rg = (() => { const r = {}; earthquakes.forEach(eq => { let g = 'Otro'; const p = (eq.place || '').toLowerCase(); if (p.includes('peru')) g = 'Peru'; else if (p.includes('chile')) g = 'Chile'; else if (p.includes('alaska')) g = 'Alaska'; else if (p.includes('japan')) g = 'Japon'; else if (p.includes('indonesia') || p.includes('ternate')) g = 'Indonesia'; else if (p.includes('mexico') || p.includes('oaxaca')) g = 'Mexico'; else if (p.includes('kermadec') || p.includes('fiji')) g = 'Pacifico S'; else if (p.includes('argentina')) g = 'Argentina'; else if (p.includes('california') || p.includes('nevada') || p.includes('new mexico')) g = 'EEUU'; r[g] = (r[g] || 0) + 1; }); return Object.entries(r).map(([n, v]) => ({ name: n, value: v })).sort((a, b) => b.value - a.value).slice(0, 8); })();
  const scat = earthquakes.slice(0, 50).map(eq => ({ x: eq.magnitude, y: eq.depth_km, z: eq.magnitude * 10 }));
  const bs = (() => { const s = {}; earthquakes.forEach(eq => { const src = (eq.source_id || '?').toUpperCase(); s[src] = (s[src] || 0) + 1; }); return Object.entries(s).map(([n, c]) => ({ name: n, cantidad: c })).sort((a, b) => b.cantidad - a.cantidad); })();
  const cd = { background: '#0d1a2e', borderRadius: 10, border: '1px solid #1e3a5f44', padding: 14 };
  const tt = { fontSize: 11, color: '#fbbf24', letterSpacing: 2, fontWeight: 700, marginBottom: 10 };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, overflow: 'auto', padding: 4 }}>
      <div style={{ ...cd, gridColumn: 'span 2' }}><div style={tt}>ACTIVIDAD SISMICA POR HORA</div><ResponsiveContainer width="100%" height={180}><AreaChart data={tl}><CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f33" /><XAxis dataKey="hora" tick={{ fill: '#94a3b8', fontSize: 9 }} /><YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} /><Tooltip content={<CTooltip />} /><Area type="monotone" dataKey="cantidad" stroke="#3b82f6" fill="#3b82f620" strokeWidth={2} name="Eventos" /><Area type="monotone" dataKey="magMax" stroke="#f59e0b" fill="#f59e0b10" strokeWidth={2} name="Mag.Max" /></AreaChart></ResponsiveContainer></div>
      <div style={cd}><div style={tt}>SEVERIDAD</div><ResponsiveContainer width="100%" height={180}><PieChart><Pie data={sv} cx="50%" cy="50%" innerRadius={30} outerRadius={60} dataKey="value" label={({ name, value, percent }) => `${name} ${value} (${(percent * 100).toFixed(0)}%)`} labelLine={true}>{sv.map((e, i) => <Cell key={i} fill={sc[e.name] || COLORS[i]} />)}</Pie><Tooltip content={<CTooltip />} /></PieChart></ResponsiveContainer></div>
      <div style={{ gridColumn: 'span 3' }}><AutoReport data={data} /></div>
      <div style={cd}><div style={tt}>POR MAGNITUD</div><ResponsiveContainer width="100%" height={180}><BarChart data={md}><CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f33" /><XAxis dataKey="name" tick={{ fill: '#fbbf24', fontSize: 10, fontWeight: 700 }} /><YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} /><Tooltip content={<CTooltip />} /><Bar dataKey="value" name="Cantidad" radius={[4, 4, 0, 0]}>{md.map((e, i) => <Cell key={i} fill={i >= 3 ? '#ef4444' : i >= 2 ? '#f59e0b' : i >= 1 ? '#fb923c' : '#3b82f6'} />)}</Bar></BarChart></ResponsiveContainer></div>
      <div style={cd}><div style={tt}>POR REGION</div><ResponsiveContainer width="100%" height={180}><BarChart data={rg} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f33" /><XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 9 }} /><YAxis type="category" dataKey="name" tick={{ fill: '#fbbf24', fontSize: 10, fontWeight: 600 }} width={75} /><Tooltip content={<CTooltip />} /><Bar dataKey="value" name="Eventos" radius={[0, 4, 4, 0]}>{rg.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer></div>
      <div style={cd}><div style={tt}>POR FUENTE</div><ResponsiveContainer width="100%" height={180}><PieChart><Pie data={bs} cx="50%" cy="50%" outerRadius={60} dataKey="cantidad" label={({ name, cantidad }) => `${name}:${cantidad}`} labelLine={false}>{bs.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip content={<CTooltip />} /></PieChart></ResponsiveContainer></div>
      <div style={{ ...cd, gridColumn: 'span 3' }}><div style={tt}>PROFUNDIDAD vs MAGNITUD</div><ResponsiveContainer width="100%" height={180}><ScatterChart><CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f33" /><XAxis type="number" dataKey="x" name="Magnitud" tick={{ fill: '#94a3b8', fontSize: 9 }} /><YAxis type="number" dataKey="y" name="Prof.(km)" tick={{ fill: '#94a3b8', fontSize: 9 }} /><ZAxis type="number" dataKey="z" range={[20, 200]} /><Tooltip content={<CTooltip />} /><Scatter data={scat} fill="#3b82f6" fillOpacity={0.6} stroke="#60a5fa" /></ScatterChart></ResponsiveContainer></div>
    </div>
  );
}

/* ═══ PACIFIC MAP ═══ */
function PacificMap({ earthquakes = [], buoys = [] }) {
  const views = [{ name: 'GLOBAL', vb: '0 0 900 500' }, { name: 'PERU', vb: '180 180 200 200' }, { name: 'PACIFICO SUR', vb: '150 250 400 250' }, { name: 'ASIA-PACIFICO', vb: '550 100 350 300' }];
  const [viewIdx, setViewIdx] = useState(0);
  const toX = lng => ((lng + 180) / 360) * 900, toY = lat => ((90 - lat) / 180) * 500;
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, display: 'flex', gap: 4 }}>
        {views.map((v, i) => <button key={i} onClick={() => setViewIdx(i)} style={{ padding: '5px 10px', borderRadius: 4, border: viewIdx === i ? '2px solid #f59e0b' : '1px solid #1e3a5f', background: viewIdx === i ? '#f59e0b22' : '#050b18cc', color: viewIdx === i ? '#fbbf24' : '#64748b', fontSize: 9, fontWeight: 700, cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1 }}>{v.name}</button>)}
      </div>
      <svg viewBox={views[viewIdx].vb} style={{ width: '100%', height: '100%', background: 'linear-gradient(180deg,#0a1628,#0d1f3c,#0a1628)', transition: 'all 0.5s ease' }}>
        <defs><radialGradient id="gr" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" /><stop offset="100%" stopColor="#ef4444" stopOpacity="0" /></radialGradient><radialGradient id="gy" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#f59e0b" stopOpacity="0.6" /><stop offset="100%" stopColor="#f59e0b" stopOpacity="0" /></radialGradient></defs>
        {[-60, -30, 0, 30, 60].map(l => <line key={l} x1={0} y1={toY(l)} x2={900} y2={toY(l)} stroke="#1e3a5f" strokeWidth="0.5" strokeDasharray="4,4" />)}
        {[-150, -120, -90, -60, 90, 120, 150, 180].map(l => <line key={`lo${l}`} x1={toX(l)} y1={0} x2={toX(l)} y2={500} stroke="#1e3a5f" strokeWidth="0.5" strokeDasharray="4,4" />)}
        <path d="M 255,195 L 250,210 248,230 245,250 242,270 240,290 238,310 236,330 234,340 236,350 240,360 245,370" stroke="#f59e0b" strokeWidth="2.5" fill="none" opacity="0.5" />
        <text x={238} y={238} fill="#f59e0b" fontSize="10" fontWeight="bold" opacity="0.8">PERU</text>
        {buoys.map(b => { const bx = toX(b.longitude), by = toY(b.latitude), c = b.status === 'alert' ? '#ef4444' : b.status === 'warning' ? '#f59e0b' : '#22c55e'; return <g key={b.id}>{b.status !== 'normal' && <circle cx={bx} cy={by} r={16} fill={b.status === 'alert' ? "url(#gr)" : "url(#gy)"}><animate attributeName="r" values="12;20;12" dur="1.5s" repeatCount="indefinite" /></circle>}<circle cx={bx} cy={by} r={5} fill={c} stroke="#fff" strokeWidth="1.5" /><text x={bx + 8} y={by + 4} fill="#fbbf24" fontSize="7" fontFamily="monospace" fontWeight="bold">{b.name?.replace('DART ', '').substring(0, 12)}</text></g>; })}
        {earthquakes.slice(0, 30).map((eq, i) => { const ex = toX(eq.longitude), ey = toY(eq.latitude), r = Math.max(3, (eq.magnitude || 0) * 2), c = sevColor(eq.severity), d = eq.severity === 'critical' || eq.severity === 'warning'; return <g key={eq.id} opacity={1 - i * 0.02}>{eq.severity === 'critical' && <circle cx={ex} cy={ey} r={r * 4} fill="url(#gr)"><animate attributeName="r" values={`${r * 3};${r * 6};${r * 3}`} dur="1s" repeatCount="indefinite" /><animate attributeName="opacity" values="0.8;0.2;0.8" dur="1s" repeatCount="indefinite" /></circle>}{eq.severity === 'warning' && <circle cx={ex} cy={ey} r={r * 3} fill="url(#gy)"><animate attributeName="r" values={`${r * 2};${r * 4};${r * 2}`} dur="1.5s" repeatCount="indefinite" /></circle>}<circle cx={ex} cy={ey} r={r} fill={c} opacity="0.8">{d && <animate attributeName="opacity" values="1;0.3;1" dur="0.8s" repeatCount="indefinite" />}</circle>{eq.magnitude >= 4.5 && <text x={ex + r + 3} y={ey + 3} fill={c} fontSize="8" fontWeight="bold" fontFamily="monospace">M{eq.magnitude}</text>}</g>; })}
        {viewIdx === 0 && <text x={450} y={22} fill="#fbbf24" fontSize="12" fontWeight="bold" textAnchor="middle" fontFamily="monospace">MONITOREO SISMICO - DATOS EN VIVO</text>}
      </svg>
    </div>
  );
}

/* ═══ MAP LEGEND ═══ */
function MapLegend() {
  return (
    <div style={{ display: 'flex', gap: 20, padding: '8px 16px', background: '#070e1f', borderTop: '1px solid #1e3a5f33', flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={{ fontSize: 10, color: '#fbbf24', fontWeight: 700, letterSpacing: 2 }}>LEYENDA:</span>
      {[['#ef4444','Critico M7.5+'],['#f59e0b','Alerta M6.0+'],['#fb923c','Moderado M4.5+'],['#64748b','Menor']].map(([c,l])=><div key={l} style={{display:'flex',alignItems:'center',gap:5}}><div style={{width:9,height:9,borderRadius:'50%',background:c}}/><span style={{fontSize:10,color:c}}>{l}</span></div>)}
      <span style={{ color: '#1e3a5f', fontSize: 10 }}>|</span>
      {[['#22c55e','Boya OK'],['#f59e0b','Boya Anomalia'],['#ef4444','Boya Alerta']].map(([c,l])=><div key={l} style={{display:'flex',alignItems:'center',gap:5}}><div style={{width:9,height:9,borderRadius:'50%',background:c,border:'1.5px solid #fff'}}/><span style={{fontSize:10,color:c}}>{l}</span></div>)}
      <span style={{ fontSize: 9, color: '#475569' }}>• Halo parpadeante = mayor peligro</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAPA MAREOGRAFICO DEL PACIFICO - LEAFLET PROFESIONAL
   Estaciones IOC con mapa real + curva sinusoidal al clic
   *** CORREGIDO: mapeo robusto de campos IOC v1/v2 ***
   ═══════════════════════════════════════════════════════════ */
function TideGaugeMap() {
  const [stations, setStations] = useState([]);
  const [selectedStation, setSelectedStation] = useState(null);
  const [tideData, setTideData] = useState([]);
  const [loadingStations, setLoadingStations] = useState(true);
  const [loadingTide, setLoadingTide] = useState(false);
  const [stats, setStats] = useState(null);
  const [hours, setHours] = useState(24);
  const [filter, setFilter] = useState('all');
  const [debugInfo, setDebugInfo] = useState('');
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  // Filtro Pacifico
  const isInPacific = (lat, lon) => {
    return ((lon >= -180 && lon <= -70) || (lon >= 100 && lon <= 180)) && lat >= -60 && lat <= 65;
  };

  // ══════════════════════════════════════════════════════
  // FIX #1: Mapeo robusto de campos
  // IOC v1 usa minusculas: code, location, country, lat, lon
  // IOC v2 usa PascalCase: Code, Location, Country, Lat, Lon
  // Backend/Supabase usa: code, name, country, lat, lon
  // Esta funcion acepta CUALQUIER variante
  // ══════════════════════════════════════════════════════
  const mapStationFields = (s) => {
    const code = s.code || s.Code || s.ID || s.id || '';
    const name = s.name || s.location || s.Location || s.Name || 'Unknown';
    const country = s.country || s.Country || s.countryname || '';
    const lat = parseFloat(s.lat || s.Lat || s.latitude || 0);
    const lon = parseFloat(s.lon || s.Lon || s.longitude || 0);

    // Determinar status: si api_status es "Operational" -> online
    // Si tiene last_value reciente -> online
    // Por defecto -> online (la mayoria de estaciones IOC estan activas)
    const apiStatus = s.api_status || s.status || '';
    let status = 'online';
    if (apiStatus === 'offline' || apiStatus === 'Closed') {
      status = 'offline';
    }

    return {
      code: String(code).trim(),
      name: String(name).trim(),
      country: String(country).trim(),
      lat,
      lon,
      status,
      sensor_type: s.sensor_type || s.sensor || '',
      performance: s.performance || '',
      operator: s.operator || s.localoperator || '',
      last_value: s.last_value || s.lastvalue || null,
      last_time: s.last_time || s.lasttime || '',
    };
  };

  // Estaciones peruanas prioritarias con codigos IOC verificados
  const PERU_STATIONS = [
    { code: 'call2', name: 'Callao', country: 'PER', lat: -12.07, lon: -77.17, status: 'online', sensor_type: 'prs', operator: 'DHN Peru' },
    { code: 'IsHor', name: 'Isla Hormiga, Lima', country: 'PER', lat: -11.98, lon: -77.73, status: 'online', sensor_type: 'prs', operator: 'DHN Peru' },
    { code: 'chim1', name: 'Chimbote', country: 'PER', lat: -9.08, lon: -78.61, status: 'online', sensor_type: 'prs', operator: 'DHN Peru' },
    { code: 'pait', name: 'Paita', country: 'PER', lat: -5.08, lon: -81.11, status: 'online', sensor_type: 'prs', operator: 'DHN Peru' },
    { code: 'talr', name: 'Talara', country: 'PER', lat: -4.58, lon: -81.28, status: 'online', sensor_type: 'prs', operator: 'DHN Peru' },
    { code: 'mata', name: 'Matarani', country: 'PER', lat: -17.00, lon: -72.11, status: 'online', sensor_type: 'prs', operator: 'DHN Peru' },
    { code: 'sanjn', name: 'San Juan', country: 'PER', lat: -15.36, lon: -75.16, status: 'online', sensor_type: 'prs', operator: 'DHN Peru' },
    { code: 'pdas', name: 'Pisco / San Andres', country: 'PER', lat: -13.72, lon: -76.22, status: 'online', sensor_type: 'prs', operator: 'DHN Peru' },
    { code: 'ilo1', name: 'Ilo', country: 'PER', lat: -17.64, lon: -71.34, status: 'online', sensor_type: 'prs', operator: 'DHN Peru' },
  ];

  // Mezclar estaciones: priorizar Peru (con nombres correctos), luego el resto
  const mergeWithPeru = (stations) => {
    const peruCodesLower = new Set(PERU_STATIONS.map(s => s.code.toLowerCase()));

    // Para cada estacion del backend, verificar si es una estacion peruana
    // por codigo (case-insensitive) O por proximidad de coordenadas
    const isPeruStation = (s) => {
      if (peruCodesLower.has((s.code || '').toLowerCase())) return true;
      // Tambien verificar por coordenadas cercanas (dentro de 0.15 grados)
      if (s.country === 'PER' || s.country === 'Peru') {
        return PERU_STATIONS.some(p =>
          Math.abs(p.lat - s.lat) < 0.15 && Math.abs(p.lon - s.lon) < 0.15
        );
      }
      return false;
    };

    const filtered = stations.filter(s => !isPeruStation(s));
    // Peru primero (con nombres garantizados), luego el resto
    return [...PERU_STATIONS, ...filtered];
  };

  // Cargar estaciones
  useEffect(() => {
    const load = async () => {
      try {
        // Paso 1: Backend (Supabase sea_level_stations via IOC v2)
        console.log('[CNAT] Cargando estaciones desde backend...');
        const r = await fetch(`${API}/sealevel/stations`);
        const d = await r.json();

        if (d.stations && d.stations.length > 0) {
          const mapped = d.stations
            .map(mapStationFields)
            .filter(s => s.code && s.lat && s.lon);

          const final = mergeWithPeru(mapped);
          console.log(`[CNAT] Backend: ${d.stations.length} raw -> ${mapped.length} validas + ${PERU_STATIONS.length} Peru = ${final.length}`);
          setStations(final);
          setDebugInfo(`${final.length} estaciones (${PERU_STATIONS.length} Peru prioritarias)`);
          setLoadingStations(false);
          return;
        }

        console.log('[CNAT] Backend vacio, intentando IOC v1 directo...');

        // Paso 2: Fallback IOC API v1 directo
        const r2 = await fetch('https://www.ioc-sealevelmonitoring.org/service.php?query=stationlist&showall=all&output=json');
        const allStations = await r2.json();

        console.log(`[CNAT] IOC v1: ${allStations.length} estaciones totales`);
        if (allStations.length > 0) {
          console.log('[CNAT] Campos IOC v1:', Object.keys(allStations[0]));
        }

        const pacific = allStations
          .map(mapStationFields)
          .filter(s => {
            if (!s.code) return false;
            if (!s.lat || !s.lon) return false;
            return isInPacific(s.lat, s.lon);
          });

        const final = mergeWithPeru(pacific);
        console.log(`[CNAT] IOC v1: ${pacific.length} Pacifico + ${PERU_STATIONS.length} Peru = ${final.length}`);

        setStations(final);
        setDebugInfo(`${final.length} estaciones (${PERU_STATIONS.length} Peru prioritarias)`);
      } catch (e) {
        console.error('[CNAT] Error cargando estaciones:', e);
        setDebugInfo(`Error: ${e.message}`);
      }
      setLoadingStations(false);
    };
    load();
  }, []);

  // Inicializar Leaflet
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current || loadingStations) return;

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const L = require('leaflet');

    const map = L.map(mapRef.current, {
      center: [0, -150],
      zoom: 3,
      minZoom: 2,
      maxZoom: 12,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    L.control.attribution({ position: 'bottomright', prefix: false })
      .addAttribution('CNAT - MICROHELP | UNESCO/IOC SLSMF')
      .addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [loadingStations]);

  // Actualizar marcadores
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const L = require('leaflet');
    const map = mapInstanceRef.current;

    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];

    const filtered = stations.filter(s => filter === 'all' || s.status === filter);

    filtered.forEach(s => {
      const isOnline = s.status === 'online';
      const color = isOnline ? '#22c55e' : '#ef4444';
      const isSel = selectedStation?.code === s.code;

      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:${isSel ? 16 : 10}px;
          height:${isSel ? 16 : 10}px;
          background:${color};
          border:2px solid ${isSel ? '#fbbf24' : '#fff'};
          border-radius:${isOnline ? '50%' : '2px'};
          box-shadow:0 0 ${isSel ? '12' : '6'}px ${color};
          transition: all 0.3s;
        "></div>`,
        iconSize: [isSel ? 16 : 10, isSel ? 16 : 10],
        iconAnchor: [isSel ? 8 : 5, isSel ? 8 : 5],
      });

      const marker = L.marker([s.lat, s.lon], { icon }).addTo(map);

      marker.bindTooltip(
        `<div style="font-family:monospace;font-size:11px;line-height:1.4">
          <b style="color:#fbbf24">${s.name}</b><br/>
          <span style="color:#94a3b8">${s.country} | <b>${s.code}</b></span><br/>
          <span style="color:${color}">${isOnline ? '● ONLINE' : '■ OFFLINE'}</span>
          <span style="color:#64748b"> | ${s.lat?.toFixed(2)}, ${s.lon?.toFixed(2)}</span>
        </div>`,
        { className: 'cnat-tooltip', direction: 'top', offset: [0, -8] }
      );

      marker.on('click', () => handleStationClick(s));
      markersRef.current.push(marker);
    });
  }, [stations, filter, selectedStation]);

  // ══════════════════════════════════════════════════════
  // FIX #2: Clic en estacion - validar codigo antes de fetch
  // y usar backend como fuente principal (sin problemas CORS)
  // ══════════════════════════════════════════════════════
  const handleStationClick = useCallback(async (station) => {
    console.log('[CNAT] Click en estacion:', station.name, '| Codigo:', station.code);

    setSelectedStation(station);
    setLoadingTide(true);
    setTideData([]);
    setStats(null);

    // Centrar mapa
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([station.lat, station.lon], 6, { duration: 1.5 });
    }

    // FIX: Validar que tenemos un codigo
    if (!station.code) {
      console.error('[CNAT] Estacion sin codigo - no se puede consultar datos');
      setLoadingTide(false);
      return;
    }

    try {
      // Paso 1: Backend (usa IOC v1 internamente, sin problemas CORS)
      console.log(`[CNAT] Consultando backend: ${API}/sealevel/station/${station.code}?hours=${hours}`);
      const r = await fetch(`${API}/sealevel/station/${station.code}?hours=${hours}`);
      const d = await r.json();

      console.log(`[CNAT] Backend respondio: code=${d.code} | ${d.data?.length || 0} puntos`);

      if (d.data && d.data.length > 0) {
        // Calcular mediana para centrar la curva (como UNESCO: signal - median)
        const rawValues = d.data.map(p => p.value).filter(v => v != null);
        const sorted = [...rawValues].sort((a, b) => a - b);
        const median = sorted.length % 2 === 0
          ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
          : sorted[Math.floor(sorted.length / 2)];

        const processed = d.data.map(p => ({
          ...p,
          value: parseFloat((p.value - median).toFixed(4)),
          time: new Date(p.timestamp).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
        }));
        setTideData(processed);
        // Stats sobre datos relativos
        const relValues = processed.map(p => p.value);
        setStats({
          min: Math.min(...relValues).toFixed(3),
          max: Math.max(...relValues).toFixed(3),
          mean: (relValues.reduce((a, b) => a + b, 0) / relValues.length).toFixed(3),
          range: (Math.max(...relValues) - Math.min(...relValues)).toFixed(3),
          points: relValues.length,
          median_abs: median.toFixed(3),
        });
        console.log(`[CNAT] OK ${processed.length} puntos cargados (mediana=${median.toFixed(3)})`);
      } else {
        // Paso 2: Si backend vacio, intentar IOC v1 directo (puede fallar por CORS)
        console.log('[CNAT] Backend sin datos, intentando IOC v1 directo...');
        try {
          const now = new Date();
          const start = new Date(now.getTime() - hours * 3600000);
          const iocUrl = `https://www.ioc-sealevelmonitoring.org/service.php?query=data&code=${station.code}&timestart=${start.toISOString().slice(0,16)}&timeend=${now.toISOString().slice(0,16)}&format=json`;
          console.log('[CNAT] IOC v1 URL:', iocUrl);

          const r2 = await fetch(iocUrl);
          const rawData = await r2.json();

          console.log(`[CNAT] IOC v1 directo: ${Array.isArray(rawData) ? rawData.length : 'no es array'} registros`);

          if (Array.isArray(rawData) && rawData.length > 0) {
            const processed = rawData
              .filter(p => p.slevel != null && p.slevel !== '')
              .map(p => ({
                timestamp: p.stime || '',
                value: parseFloat(p.slevel),
                time: new Date(p.stime).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
              }));

            setTideData(processed);
            if (processed.length > 0) {
              const values = processed.map(p => p.value);
              setStats({
                min: Math.min(...values).toFixed(3),
                max: Math.max(...values).toFixed(3),
                mean: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(3),
                range: (Math.max(...values) - Math.min(...values)).toFixed(3),
                points: values.length,
              });
            }
            console.log(`[CNAT] OK ${processed.length} puntos desde IOC v1 directo`);
          } else {
            console.log('[CNAT] IOC v1 directo tambien sin datos');
          }
        } catch (corsErr) {
          console.warn('[CNAT] IOC v1 directo fallo (probablemente CORS):', corsErr.message);
        }
      }
    } catch (e) {
      console.error('[CNAT] Error cargando datos de marea:', e);
    }
    setLoadingTide(false);
  }, [hours]);

  const onlineCount = stations.filter(s => s.status === 'online').length;
  const offlineCount = stations.length - onlineCount;

  return (
    <div style={{ display: 'flex', height: '100%', gap: 0 }}>
      <style>{`
        .cnat-tooltip { background: #0d1a2e !important; border: 1px solid #1e3a5f !important; border-radius: 6px !important; color: #e2e8f0 !important; padding: 8px 12px !important; box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important; }
        .cnat-tooltip::before { border-top-color: #1e3a5f !important; }
        .leaflet-control-zoom a { background: #0d1a2e !important; color: #fbbf24 !important; border-color: #1e3a5f !important; }
        .leaflet-control-zoom a:hover { background: #1e3a5f !important; }
      `}</style>

      {/* PANEL IZQUIERDO: MAPA LEAFLET */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #1e3a5f', background: '#0d1a2e' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', letterSpacing: 1 }}>MAPA MAREOGRAFICO DEL PACIFICO</div>
            <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>Fuente: UNESCO/IOC Sea Level Station Monitoring Facility | Mapa: CartoDB Dark</div>
          </div>
          <div style={{ display: 'flex', gap: 14, fontSize: 11 }}>
            <span style={{ color: '#22c55e' }}>● ONLINE: <b>{onlineCount}</b></span>
            <span style={{ color: '#ef4444' }}>■ OFFLINE: <b>{offlineCount}</b></span>
            <span style={{ color: '#94a3b8' }}>TOTAL: <b>{stations.length}</b></span>
            {debugInfo && <span style={{ color: '#8b5cf6', fontSize: 9 }}>({debugInfo})</span>}
          </div>
        </div>

        {/* Filtros + vistas rapidas */}
        <div style={{ display: 'flex', gap: 6, padding: '6px 16px', borderBottom: '1px solid #1e3a5f22', background: '#070e1f', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {['all', 'online', 'offline'].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                background: filter === f ? '#3b82f622' : 'transparent',
                border: `1px solid ${filter === f ? '#3b82f6' : '#1e3a5f'}`,
                color: filter === f ? '#3b82f6' : '#64748b',
                padding: '3px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit', letterSpacing: 1
              }}>
                {f === 'all' ? `TODAS (${stations.length})` : f === 'online' ? `ONLINE (${onlineCount})` : `OFFLINE (${offlineCount})`}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { name: 'PACIFICO', lat: 0, lon: -150, zoom: 3 },
              { name: 'PERU', lat: -10, lon: -77, zoom: 6 },
              { name: 'CHILE', lat: -33, lon: -72, zoom: 5 },
              { name: 'JAPON', lat: 36, lon: 140, zoom: 5 },
            ].map(v => (
              <button key={v.name} onClick={() => mapInstanceRef.current?.flyTo([v.lat, v.lon], v.zoom, { duration: 1.5 })} style={{
                background: 'transparent', border: '1px solid #1e3a5f', color: '#fbbf24',
                padding: '3px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 9, fontFamily: 'inherit', letterSpacing: 1, fontWeight: 700
              }}>{v.name}</button>
            ))}
          </div>
        </div>

        {/* Mapa Leaflet */}
        <div style={{ flex: 1, minHeight: 400, position: 'relative' }}>
          {loadingStations && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#060B18', zIndex: 1000, color: '#fbbf24', fontSize: 14, letterSpacing: 2 }}>
              CARGANDO ESTACIONES DEL PACIFICO...
            </div>
          )}
          <div ref={mapRef} style={{ width: '100%', height: '100%', background: '#060B18' }} />
        </div>

        {/* Tabla de estaciones */}
        <div style={{ maxHeight: 140, overflow: 'auto', borderTop: '1px solid #1e3a5f', background: '#0d1a2e' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ color: '#64748b', textAlign: 'left', position: 'sticky', top: 0, background: '#0d1a2e' }}>
                <th style={{ padding: '5px 10px' }}>STATUS</th>
                <th style={{ padding: '5px 8px' }}>CODIGO</th>
                <th style={{ padding: '5px 8px' }}>ESTACION</th>
                <th style={{ padding: '5px 8px' }}>PAIS</th>
                <th style={{ padding: '5px 8px' }}>LAT</th>
                <th style={{ padding: '5px 8px' }}>LON</th>
              </tr>
            </thead>
            <tbody>
              {stations.filter(s => filter === 'all' || s.status === filter).slice(0, 50).map((s, idx) => (
                <tr key={`${s.code}-${idx}`} onClick={() => handleStationClick(s)} style={{
                  cursor: 'pointer', background: selectedStation?.code === s.code ? '#3b82f622' : 'transparent',
                  borderBottom: '1px solid #1e3a5f22'
                }}>
                  <td style={{ padding: '4px 10px' }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: s.status === 'online' ? '50%' : 2, background: s.status === 'online' ? '#22c55e' : '#ef4444' }} />
                  </td>
                  <td style={{ padding: '4px 8px', color: '#3b82f6', fontWeight: 700 }}>{s.code}</td>
                  <td style={{ padding: '4px 8px', color: '#e2e8f0' }}>{s.name}</td>
                  <td style={{ padding: '4px 8px', color: '#64748b' }}>{s.country}</td>
                  <td style={{ padding: '4px 8px', color: '#64748b' }}>{s.lat?.toFixed(2)}</td>
                  <td style={{ padding: '4px 8px', color: '#64748b' }}>{s.lon?.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PANEL DERECHO: CURVA SINUSOIDAL */}
      {selectedStation && (
        <div style={{ width: 380, borderLeft: '1px solid #1e3a5f', background: '#0d1a2e', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #1e3a5f', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 9, color: '#64748b', letterSpacing: 1 }}>ESTACION SELECCIONADA</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fbbf24', marginTop: 4 }}>{selectedStation.name}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{selectedStation.country} • Codigo: <span style={{ color: '#3b82f6' }}>{selectedStation.code || '⚠ SIN CODIGO'}</span></div>
            </div>
            <button onClick={() => { setSelectedStation(null); setTideData([]); setStats(null); }} style={{ background: 'transparent', border: '1px solid #1e3a5f', color: '#64748b', padding: '3px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>✕</button>
          </div>

          <div style={{ padding: '8px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 4, background: selectedStation.status === 'online' ? '#22c55e22' : '#ef444422', border: `1px solid ${selectedStation.status === 'online' ? '#22c55e44' : '#ef444444'}`, fontSize: 11 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: selectedStation.status === 'online' ? '#22c55e' : '#ef4444' }} />
              {selectedStation.status === 'online' ? 'OPERATIVA' : 'SIN DATOS'}
            </span>
            <span style={{ fontSize: 10, color: '#64748b' }}>{selectedStation.lat?.toFixed(4)}, {selectedStation.lon?.toFixed(4)}</span>
          </div>

          <div style={{ display: 'flex', gap: 5, padding: '6px 14px', borderBottom: '1px solid #1e3a5f' }}>
            <span style={{ fontSize: 9, color: '#64748b', alignSelf: 'center', marginRight: 8 }}>PERIODO:</span>
            {[6, 12, 24, 48].map(h => (
              <button key={h} onClick={() => { setHours(h); handleStationClick(selectedStation); }} style={{
                background: hours === h ? '#06b6d422' : 'transparent',
                border: `1px solid ${hours === h ? '#06b6d4' : '#1e3a5f'}`,
                color: hours === h ? '#06b6d4' : '#64748b',
                padding: '2px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit'
              }}>{h}h</button>
            ))}
          </div>

          <div style={{ padding: '12px 8px 8px 0', height: 260 }}>
            <div style={{ fontSize: 9, color: '#64748b', letterSpacing: 1, paddingLeft: 14, marginBottom: 6 }}>NIVEL DEL MAR RELATIVO (metros)</div>
            {loadingTide ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#64748b' }}>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: 24, marginBottom: 8 }}>~</div>Cargando datos de la estacion...</div>
              </div>
            ) : tideData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={tideData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f33" vertical={false} />
                  <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={{ stroke: '#1e3a5f' }} tickLine={false} interval={Math.floor(tideData.length / 8)} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={{ stroke: '#1e3a5f' }} tickLine={false} domain={['auto', 'auto']} tickFormatter={v => `${v}m`} />
                  <Tooltip contentStyle={{ background: '#0d1a2e', border: '1px solid #1e3a5f', borderRadius: 6, fontSize: 11, color: '#e2e8f0' }} formatter={(value) => [`${value} m`, 'Nivel del mar']} labelFormatter={(label) => `Hora: ${label}`} />
                  <ReferenceLine y={0} stroke="#64748b" strokeDasharray="5 5" />
                  <Line type="monotone" dataKey="value" stroke="#06b6d4" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#06b6d4', stroke: '#060B18', strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#64748b', fontSize: 12, flexDirection: 'column', gap: 8 }}>
                {!selectedStation.code
                  ? <><span style={{ color: '#ef4444', fontSize: 14 }}>⚠</span><span>Estacion sin codigo IOC</span></>
                  : <><span>No hay datos disponibles para esta estacion</span><span style={{ fontSize: 10, color: '#475569' }}>Codigo: {selectedStation.code} | Periodo: {hours}h</span></>
                }
              </div>
            )}
          </div>

          {stats && stats.points > 0 && (
            <div style={{ padding: '10px 14px', borderTop: '1px solid #1e3a5f' }}>
              <div style={{ fontSize: 9, color: '#64748b', letterSpacing: 1, marginBottom: 8 }}>RESUMEN ESTADISTICO</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {[{ l: 'Maximo', v: `${stats.max} m`, c: '#ef4444' }, { l: 'Minimo', v: `${stats.min} m`, c: '#3b82f6' }, { l: 'Promedio', v: `${stats.mean} m`, c: '#06b6d4' }, { l: 'Rango', v: `${stats.range} m`, c: '#f59e0b' }].map(item => (
                  <div key={item.l} style={{ background: '#070e1f', border: '1px solid #1e3a5f44', borderRadius: 6, padding: '6px 10px' }}>
                    <div style={{ fontSize: 9, color: '#64748b' }}>{item.l}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: item.c, marginTop: 1, fontFamily: "'Orbitron'" }}>{item.v}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 9, color: '#475569', marginTop: 6, textAlign: 'center' }}>{stats.points} puntos • Ultimas {hours} horas</div>
            </div>
          )}

          <div style={{ padding: '10px 14px', borderTop: '1px solid #1e3a5f', fontSize: 11 }}>
            <div style={{ fontSize: 9, color: '#64748b', letterSpacing: 1, marginBottom: 6 }}>METADATA</div>
            {[['Fuente', 'IOC/SLSMF (UNESCO)'], ['Sensor', selectedStation.sensor_type || 'prs'], ['Performance', selectedStation.performance || 'N/A'], ['Operador', selectedStation.operator || 'N/A']].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                <span style={{ color: '#64748b' }}>{k}</span>
                <span style={{ color: '#e2e8f0', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ ARIA ═══ */
function AriaAssistant({data}){const[messages,setMessages]=useState([]);const[input,setInput]=useState('');const[loading,setLoading]=useState(false);const prompts=["Genera un reporte ejecutivo de la situacion sismica actual","Hay riesgo de tsunami para Peru?","Analiza los sismos significativos de las ultimas 24h","Estado de las boyas DART cercanas a Peru","Genera un boletin para el operador de guardia"];const buildCtx=()=>{const k=data?.kpis||{},e=(data?.earthquakes||[]).slice(0,20),a=data?.alerts||[],b=data?.buoys||[];return`Eres ARIA, asistente IA del CNAT de la Marina de Guerra del Peru. Responde en espanol profesional.\nDATOS (${new Date().toLocaleString('es-PE')}): Sismos:${k.total_earthquakes||0} Alertas:${k.active_alerts||0} Criticos:${k.critical_count||0} Boyas:${k.alert_buoys||0}/${k.total_buoys||0} Fuentes:${k.sources_online||0}/${k.total_sources||0} Riesgo:${k.risk_level||'BAJO'}\nM>=4.5:\n${e.filter(x=>x.magnitude>=4.5).map(x=>`M${x.magnitude}|${x.depth_km}km|${x.place}`).join('\n')||'Ninguno'}\nAlertas:\n${a.length>0?a.map(x=>x.title).join('\n'):'Sin alertas'}\nBoyas:\n${b.map(x=>`${x.name}:${x.status}`).join('\n')}\nUmbrales: M7.5+60km=ALARMA M7.0+100km=ALERTA M6.5+70km=ALERTA M6.0+100km=INFO`;};const send=async t=>{if(!t.trim())return;const um={role:'user',content:t},nm=[...messages,um];setMessages(nm);setInput('');setLoading(true);try{const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':CLAUDE_KEY,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:2000,system:buildCtx(),messages:nm.map(m=>({role:m.role,content:m.content}))})});const d=await r.json();setMessages(p=>[...p,{role:'assistant',content:d.content?.[0]?.text||JSON.stringify(d)}]);}catch(e){setMessages(p=>[...p,{role:'assistant',content:'Error: '+e.message}]);}setLoading(false);};
  return<div style={{display:'flex',flexDirection:'column',height:'100%'}}><div style={{padding:16,borderBottom:'2px solid #8b5cf6',background:'#0a1628'}}><div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:40,height:40,borderRadius:'50%',background:'linear-gradient(135deg,#8b5cf6,#6366f1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,color:'#fff',fontWeight:700}}>A</div><div><div style={{fontSize:18,fontWeight:700,color:'#fbbf24',fontFamily:"'Orbitron'"}}>ARIA</div><div style={{fontSize:11,color:'#a78bfa'}}>Asistente IA - CNAT</div></div></div></div>{messages.length===0&&<div style={{padding:14}}><div style={{fontSize:11,color:'#fbbf24',letterSpacing:1.5,marginBottom:10,fontWeight:700}}>CONSULTAS RAPIDAS</div>{prompts.map((p,i)=><button key={i} onClick={()=>send(p)} style={{display:'block',width:'100%',textAlign:'left',padding:'10px 14px',marginBottom:6,background:'#0d1a2e',border:'1px solid #1e3a5f66',borderRadius:8,color:'#cbd5e1',fontSize:12,cursor:'pointer',fontFamily:'inherit'}} onMouseOver={e=>{e.target.style.background='#1e3a5f44';e.target.style.color='#fbbf24'}} onMouseOut={e=>{e.target.style.background='#0d1a2e';e.target.style.color='#cbd5e1'}}>▸ {p}</button>)}</div>}<div style={{flex:1,overflow:'auto',padding:14}}>{messages.map((m,i)=><div key={i} style={{marginBottom:14,padding:14,borderRadius:8,background:m.role==='user'?'#1e3a5f22':'#0d1a2e',borderLeft:m.role==='user'?'4px solid #f59e0b':'4px solid #8b5cf6'}}><div style={{fontSize:11,color:m.role==='user'?'#fbbf24':'#a78bfa',fontWeight:700,marginBottom:8}}>{m.role==='user'?'OPERADOR':'ARIA'}</div><div style={{fontSize:13,color:'#e2e8f0',lineHeight:1.8,whiteSpace:'pre-wrap'}}>{m.content}</div></div>)}{loading&&<div style={{padding:14,borderRadius:8,background:'#0d1a2e',borderLeft:'4px solid #8b5cf6'}}><div style={{fontSize:13,color:'#a78bfa'}}>Analizando...</div></div>}</div><div style={{padding:14,borderTop:'2px solid #1e3a5f',display:'flex',gap:8}}><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!loading&&send(input)} placeholder="Consulta a ARIA..." disabled={loading} style={{flex:1,padding:'12px 16px',borderRadius:8,border:'2px solid #1e3a5f',background:'#0a1628',color:'#fbbf24',fontSize:13,fontFamily:'inherit',outline:'none'}}/><button onClick={()=>send(input)} disabled={loading||!input.trim()} style={{padding:'12px 24px',borderRadius:8,border:'none',background:loading?'#334155':'#6366f1',color:'#fff',fontSize:13,fontWeight:700,cursor:loading?'not-allowed':'pointer',fontFamily:'inherit'}}>{loading?'...':'ENVIAR'}</button></div></div>;
}

/* ═══ MAIN APP ═══ */
export default function App() {
  const [data, setData] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(null);
  const [tab, setTab] = useState('mapa'); const [now, setNow] = useState(new Date());
  const playAlarm = useAlarmSound(); const prevC = useRef(0);
  const fetchData = useCallback(async () => { try { const r = await fetch(`${API}/dashboard`); const d = await r.json(); setData(d); setError(null); if (d.kpis?.critical_count > 0 && d.kpis.critical_count > prevC.current) playAlarm(); prevC.current = d.kpis?.critical_count || 0; } catch (e) { setError(e.message); } finally { setLoading(false); } }, [playAlarm]);
  useEffect(() => { fetchData(); const i = setInterval(fetchData, 30000); return () => clearInterval(i); }, [fetchData]);
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(i); }, []);
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 20, background: '#050b18' }}><style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}`}</style><div style={{ width: 50, height: 50, border: '3px solid #1e3a5f', borderTop: '3px solid #f59e0b', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /><div style={{ color: '#fbbf24', fontSize: 14, letterSpacing: 2, fontFamily: "'JetBrains Mono'" }}>CONECTANDO...</div></div>;

  const k = data?.kpis || {}, eq = data?.earthquakes || [], al = data?.alerts || [], bu = data?.buoys || [], sr = data?.sources || [], th = data?.thresholds || [];
  const isA = k.critical_count > 0, rC = k.risk_level === 'ALTO' ? '#ef4444' : k.risk_level === 'MEDIO' ? '#f59e0b' : '#22c55e';

  const tabs = ['mapa', 'analytics', 'alertas', 'mareografo', 'boyas', 'fuentes', 'umbrales', 'aria'];
  const tabColors = { aria: '#8b5cf6', analytics: '#06b6d4', mareografo: '#06b6d4' };

  return (
    <div style={{ background: '#050b18', color: '#e2e8f0', minHeight: '100vh', fontFamily: "'JetBrains Mono',monospace" }}>
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}@keyframes pulse-border{0%,100%{border-color:#ef4444}50%{border-color:transparent}}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:#0a1628}::-webkit-scrollbar-thumb{background:#1e3a5f;border-radius:4px}`}</style>
      {isA && <div style={{ position: 'fixed', inset: 0, zIndex: 100, pointerEvents: 'none', border: '4px solid #ef4444', animation: 'pulse-border 0.5s infinite' }} />}

      <header style={{ background: 'linear-gradient(90deg,#0a1628,#0d2847,#0a1628)', borderBottom: '2px solid #f59e0b', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}><div style={{ width: 46, height: 46, borderRadius: 8, background: 'linear-gradient(135deg,#1e40af,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 'bold', color: '#fff', boxShadow: '0 0 20px rgba(59,130,246,0.3)' }}>C</div><div><h1 style={{ fontFamily: "'Orbitron'", fontSize: 20, fontWeight: 700, letterSpacing: 3, color: '#f59e0b', margin: 0 }}>CNAT</h1><p style={{ fontSize: 10, color: '#fbbf24', letterSpacing: 1.5, margin: 0 }}>CENTRO NACIONAL DE ALERTA DE TSUNAMIS</p></div><div style={{ padding: '6px 14px', borderRadius: 4, background: isA ? '#7f1d1d' : '#0f2a1a', border: `2px solid ${isA ? '#ef4444' : '#22c55e'}`, display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: isA ? '#ef4444' : '#22c55e' }} /><span style={{ fontSize: 12, fontWeight: 700, color: isA ? '#fca5a5' : '#86efac' }}>{isA ? 'ALERTA' : 'OPERATIVO'}</span></div></div>
        <div style={{ textAlign: 'right' }}><div style={{ fontFamily: "'Orbitron'", fontSize: 22, fontWeight: 700, color: '#f59e0b' }}>{now.toLocaleTimeString('es-PE')}</div><div style={{ fontSize: 11, color: '#fbbf24' }}>{now.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div></div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8, padding: '10px 20px', background: '#070e1f' }}>
        {[{ l: 'SISMOS', v: k.total_earthquakes || 0, c: '#3b82f6' }, { l: 'ALERTAS', v: k.active_alerts || 0, c: k.active_alerts > 0 ? '#ef4444' : '#22c55e' }, { l: 'CRITICOS', v: k.critical_count || 0, c: k.critical_count > 0 ? '#ef4444' : '#22c55e' }, { l: 'BOYAS', v: `${k.alert_buoys || 0}/${k.total_buoys || 0}`, c: k.alert_buoys > 0 ? '#f59e0b' : '#22c55e' }, { l: 'FUENTES', v: `${k.sources_online || 0}/${k.total_sources || 0}`, c: k.sources_online >= 18 ? '#22c55e' : '#f59e0b' }, { l: 'RIESGO', v: k.risk_level || 'BAJO', c: rC }].map((x, i) => <div key={i} style={{ background: '#0d1a2e', border: `1px solid ${x.c}44`, borderRadius: 8, padding: 12, position: 'relative' }}><div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: x.c }} /><div style={{ fontSize: 10, color: '#fbbf24', fontWeight: 700, marginBottom: 4 }}>{x.l}</div><div style={{ fontSize: 26, fontWeight: 700, color: x.c, fontFamily: "'Orbitron'", lineHeight: 1 }}>{x.v}</div></div>)}
      </div>

      <div style={{ display: 'flex', padding: '0 20px', background: '#070e1f', borderBottom: '2px solid #1e3a5f', overflowX: 'auto' }}>
        {tabs.map(t => <button key={t} onClick={() => setTab(t)} style={{ padding: '12px 18px', background: tab === t ? '#1e3a5f' : 'transparent', border: 'none', borderBottom: tab === t ? `3px solid ${tabColors[t] || '#f59e0b'}` : '3px solid transparent', color: tab === t ? (tabColors[t] || '#fbbf24') : '#f59e0b77', cursor: 'pointer', fontSize: 12, fontWeight: 700, letterSpacing: 2, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
          {t === 'aria' ? 'ARIA (IA)' : t === 'analytics' ? 'ANALYTICS' : t === 'mareografo' ? 'MAREOGRAFO' : t.toUpperCase()}
          {t === 'alertas' && al.length > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 700, marginLeft: 8 }}>{al.length}</span>}
        </button>)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: tab === 'mareografo' ? '1fr' : '1fr 380px', gap: 0, height: 'calc(100vh - 220px)' }}>
        <div style={{ padding: tab === 'mareografo' ? 0 : 12, overflow: 'auto', height: '100%' }}>
          {tab === 'mapa' && <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}><div style={{ flex: 1, borderRadius: 10, overflow: 'hidden', border: '2px solid #1e3a5f', minHeight: 280 }}><PacificMap earthquakes={eq} buoys={bu} /></div><MapLegend /><div style={{ height: 220 }}><AnalyticsDashboard earthquakes={eq} buoys={bu} sources={sr} data={data} /></div></div>}
          {tab === 'analytics' && <AnalyticsDashboard earthquakes={eq} buoys={bu} sources={sr} data={data} />}
          {tab === 'alertas' && <div><h3 style={{ fontSize: 14, color: '#fbbf24', letterSpacing: 2, marginBottom: 10 }}>ALERTAS TSUNAMI</h3>{al.length === 0 ? <p style={{ color: '#94a3b8', padding: 40, textAlign: 'center' }}>Sin alertas</p> : al.map(a => <div key={a.id} style={{ borderLeft: `4px solid ${a.severity === 'critical' ? '#ef4444' : '#f59e0b'}`, borderRadius: 8, padding: 14, marginBottom: 8, background: '#0d1a2e' }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 13, fontWeight: 700, color: a.severity === 'critical' ? '#ef4444' : '#f59e0b' }}>{a.alert_type}</span><span style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(a.issued_at).toLocaleString('es-PE')}</span></div><p style={{ fontSize: 13, color: '#e2e8f0' }}>{a.title}</p></div>)}</div>}
          {tab === 'mareografo' && <TideGaugeMap />}
          {tab === 'boyas' && <div><h3 style={{ fontSize: 14, color: '#fbbf24', letterSpacing: 2, marginBottom: 10 }}>ESTACIONES DART</h3><div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>{bu.map(b => { const c = b.status === 'alert' ? '#ef4444' : b.status === 'warning' ? '#f59e0b' : '#22c55e'; return <div key={b.id} style={{ background: '#0d1a2e', border: `1px solid ${c}33`, borderRadius: 8, padding: 14 }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 13, fontWeight: 600, color: '#fbbf24' }}>{b.name}</span><div style={{ width: 12, height: 12, borderRadius: '50%', background: c }} /></div><div style={{ fontSize: 10, color: '#94a3b8' }}>{b.country} | {b.latitude?.toFixed(2)},{b.longitude?.toFixed(2)}</div><div style={{ marginTop: 6, textAlign: 'center', padding: 4, borderRadius: 4, background: `${c}15` }}><span style={{ fontSize: 11, fontWeight: 700, color: c }}>{b.status === 'normal' ? 'NORMAL' : 'ANOMALIA'}</span></div></div> })}</div></div>}
          {tab === 'fuentes' && <div><h3 style={{ fontSize: 14, color: '#fbbf24', letterSpacing: 2, marginBottom: 10 }}>20 FUENTES OFICIALES</h3>{['sismo', 'alerta', 'boya', 'noticias'].map(t => <div key={t} style={{ marginBottom: 14 }}><div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', letterSpacing: 2, marginBottom: 6 }}>{t === 'sismo' ? 'SISMOLOGICAS' : t === 'alerta' ? 'CENTROS ALERTA' : t === 'boya' ? 'BOYAS' : 'NOTICIAS'}</div>{sr.filter(s => s.source_type === t).map(s => <div key={s.id} style={{ background: '#0d1a2e', borderRadius: 6, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: s.status === 'active' ? '#22c55e' : '#ef4444' }} /><span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{s.name}</span><span style={{ fontSize: 11, color: '#94a3b8' }}>{s.country}</span></div><span style={{ fontSize: 11, fontWeight: 600, color: s.status === 'active' ? '#22c55e' : '#ef4444' }}>{s.status === 'active' ? 'ONLINE' : 'ERROR'}</span></div>)}</div>)}</div>}
          {tab === 'umbrales' && <div><h3 style={{ fontSize: 14, color: '#fbbf24', letterSpacing: 2, marginBottom: 10 }}>UMBRALES DHN</h3><div style={{ borderRadius: 10, overflow: 'hidden', border: '2px solid #1e3a5f' }}><table style={{ width: '100%', borderCollapse: 'collapse', background: '#0d1a2e' }}><thead><tr style={{ background: '#0a1628' }}>{['Magnitud', 'Prof.', 'Accion', 'Semaforo', 'Descripcion'].map(h => <th key={h} style={{ padding: 12, fontSize: 11, fontWeight: 700, color: '#fbbf24', textAlign: 'left', borderBottom: '1px solid #1e3a5f' }}>{h}</th>)}</tr></thead><tbody>{th.map((t, i) => <tr key={i}><td style={{ padding: 12, fontSize: 16, fontWeight: 700, color: thrColor(t.action), fontFamily: "'Orbitron'" }}>M{t.min_magnitude}+</td><td style={{ padding: 12, color: '#e2e8f0' }}>{t.max_depth_km}km</td><td style={{ padding: 12 }}><span style={{ padding: '4px 12px', borderRadius: 4, background: `${thrColor(t.action)}20`, color: thrColor(t.action), fontWeight: 700 }}>{t.action}</span></td><td style={{ padding: 12 }}><div style={{ width: 20, height: 20, borderRadius: '50%', background: thrColor(t.action) }} /></td><td style={{ padding: 12, color: '#cbd5e1', fontSize: 12 }}>{t.description}</td></tr>)}</tbody></table></div></div>}
          {tab === 'aria' && <AriaAssistant data={data} />}
        </div>

        {/* RIGHT SIDEBAR - only show when not in mareografo tab */}
        {tab !== 'mareografo' && (
          <div style={{ background: '#070e1f', borderLeft: '1px solid #1e3a5f', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <StatsSummary earthquakes={eq} alerts={al} buoys={bu} />
            <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}><h3 style={{ fontSize: 12, color: '#fbbf24', letterSpacing: 2, fontWeight: 700 }}>FEED SISMICO</h3><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', animation: 'blink 2s infinite' }} /></div>
              {eq.slice(0, 15).map(e => { const c = sevColor(e.severity); return <div key={e.id} style={{ padding: '7px 10px', borderRadius: 6, marginBottom: 4, borderLeft: `4px solid ${c}`, background: '#0d1a2e44' }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 14, fontWeight: 700, color: c, fontFamily: "'Orbitron'" }}>M{e.magnitude}</span><span style={{ fontSize: 9, color: '#94a3b8' }}>{new Date(e.event_time).toLocaleTimeString('es-PE')}</span></div><div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 2 }}>{e.place}</div><div style={{ display: 'flex', gap: 8, marginTop: 2 }}><span style={{ fontSize: 9, color: '#94a3b8' }}>Prof:{e.depth_km}km</span><span style={{ fontSize: 9, color: '#94a3b8' }}>{e.source_id?.toUpperCase()}</span></div></div> })}
            </div>
            <div style={{ borderTop: '1px solid #1e3a5f', padding: '8px 12px', display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700 }}>MICROHELP v2.0</span><span style={{ fontSize: 10, color: '#22c55e', fontWeight: 700 }}>DATOS REALES</span></div>
          </div>
        )}
      </div>
    </div>
  );
}
