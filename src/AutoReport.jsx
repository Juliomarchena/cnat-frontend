import React, { useState, useCallback, useEffect, useRef } from 'react';

/**
 * AutoReport.jsx — ARIA::INFORME
 * Marina de Guerra del Perú | MICROHELP © 2026
 * v3.3 — Orden cronológico, cercanos primero, fuentes múltiples
 */

const CLAUDE_KEY = process.env.REACT_APP_CLAUDE_KEY || '';

function buildPrompt(data) {
  const k   = data?.kpis        || {};
  const eqs = data?.earthquakes || [];
  const now = new Date().toLocaleString('es-PE', {
    day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'
  });

  // ── Agrupar sismos del mismo evento (±10min) para mostrar TODAS las fuentes ──
  const grupos = {};
  eqs.filter(e => e.latitude && e.longitude && e.magnitude >= 4.0).forEach(e => {
    const t     = Math.floor(new Date(e.event_time).getTime() / (10*60*1000));
    const mag   = Math.round(e.magnitude * 2) / 2;
    const lugar = (e.place||'').substring(0,20).toLowerCase().replace(/\s+/g,'_');
    const key   = `${t}_${mag}_${lugar}`;
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(e);
  });

  // ── Calcular distancia a Lima y clasificar ──
  const eventos = Object.values(grupos).map(grupo => {
    const rep  = grupo.reduce((a,b) => b.magnitude > a.magnitude ? b : a);
    const lat  = parseFloat(rep.latitude), lon = parseFloat(rep.longitude);
    const R    = 6371;
    const dLat = ((lat-(-12.05))*Math.PI)/180;
    const dLon = ((lon-(-77.03))*Math.PI)/180;
    const a    = Math.sin(dLat/2)**2 + Math.cos((lat*Math.PI)/180)*Math.cos((-12.05*Math.PI)/180)*Math.sin(dLon/2)**2;
    const dist = Math.round(R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)));
    const enBbox = lat>=-18.5&&lat<=-0.03&&lon>=-81.5&&lon<=-68.5;
    const nivel  = (enBbox||dist<=300)?'LOCAL':dist<=800?'CERCANO':dist<=1500?'REGIONAL':'REMOTO';
    const ts     = new Date(rep.event_time).getTime();
    const fecha  = new Date(rep.event_time).toLocaleString('es-PE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    const fuentes = grupo.sort((a,b)=>b.magnitude-a.magnitude)
      .map(e=>`${(e.source_id||'?').toUpperCase()}:M${e.magnitude}`).join(' | ');
    return { rep, dist, nivel, fecha, fuentes, ts };
  });

  // ── Separar y ordenar: cercanos cronológico desc, luego remotos cronológico desc ──
  const cercanos = eventos
    .filter(e => e.nivel !== 'REMOTO')
    .sort((a,b) => b.ts - a.ts)  // más reciente primero
    .slice(0, 8);

  const remotos = eventos
    .filter(e => e.nivel === 'REMOTO' && e.rep.magnitude >= 5.5)
    .sort((a,b) => b.ts - a.ts)  // más reciente primero
    .slice(0, 4);

  const listaCercanos = cercanos.length > 0
    ? cercanos.map(e =>
        `${e.fecha} | ${e.rep.place||'?'} | ~${e.dist}km Lima | P:${e.rep.depth_km}km | ${e.nivel}\n   ${e.fuentes}`
      ).join('\n')
    : 'Sin eventos cercanos al Perú';

  const listaRemotos = remotos.length > 0
    ? remotos.map(e =>
        `${e.fecha} | ${e.rep.place||'?'} | ~${e.dist}km Lima\n   ${e.fuentes}`
      ).join('\n')
    : '';

  return `Eres ARIA del CNAT. Genera el reporte EXACTAMENTE en este formato:

🟢/🟡/🔴 ESTADO: [una frase] — ${now}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SISMOS CERCANOS AL PERÚ (reciente→antiguo):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[2 líneas por sismo:]
DD/MM HH:MM | LUGAR | ~XXXkm Lima | P:XXkm | NIVEL
   FUENTE1:MX.X | FUENTE2:MX.X | FUENTE3:MX.X
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESTO DEL MUNDO M5.5+ (reciente→antiguo):
DD/MM HH:MM | LUGAR | ~XXXkm Lima
   FUENTE1:MX.X | FUENTE2:MX.X
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BOYAS:${k.alert_buoys||0}/${k.total_buoys||0} | FUENTES:${k.sources_online||0}/${k.total_sources||0} | DHN:${k.risk_level||'BAJO'}
RECOMENDACIÓN: [una línea]

DATOS CERCANOS AL PERÚ (ya en orden reciente→antiguo):
${listaCercanos}

${listaRemotos ? `DATOS REMOTOS M5.5+ (ya en orden reciente→antiguo):\n${listaRemotos}` : ''}

REGLAS CRÍTICAS:
1. Usa el formato de 2 líneas por sismo EXACTAMENTE como se muestra
2. Pon TODAS las fuentes con sus magnitudes en la línea 2
3. Primero van los CERCANOS AL PERÚ, luego RESTO DEL MUNDO
4. Dentro de cada grupo: del más reciente al más antiguo
5. Sin markdown, sin asteriscos, sin texto adicional`;
}

export default function AutoReport({ data }) {
  const [report,      setReport]      = useState('');
  const [displayText, setDisplayText] = useState('');
  const [loading,     setLoading]     = useState(false);
  const [lastUpdate,  setLastUpdate]  = useState(null);
  const [typing,      setTyping]      = useState(false);
  const timerRef    = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!report) return;
   const full = report;
    setDisplayText(''); setTyping(true);
    let i = 0;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      i++; setDisplayText(full.substring(0,i));
      if (i>=full.length) { clearInterval(timerRef.current); setTyping(false); }
    }, 25);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [report]);

  const generateReport = useCallback(async () => {
    if (!data?.earthquakes?.length) return;
    setLoading(true); setDisplayText(''); setReport('');
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', 'x-api-key': CLAUDE_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 500,
          messages: [{ role: 'user', content: buildPrompt(data) }],
        }),
      });
      const d = await r.json();
      setReport((d.content?.[0]?.text||'Error').split('\n').filter(l=>l.trim()).join('\n'));
      setLastUpdate(new Date());
    } catch(e) { setReport(`Error: ${e.message}`); }
    setLoading(false);
  }, [data]);

  useEffect(() => {
    if (data?.earthquakes?.length && !report && !loading) generateReport();
  }, [data, generateReport, report, loading]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => { if (!loading) generateReport(); }, 5*60*1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [generateReport, loading]);

  return (
    <div style={{
      background:'#000000', borderRadius:6, border:'1px solid #00ff0033', padding:12,
      position:'relative', overflow:'hidden',
      boxShadow:'inset 0 0 60px rgba(0,255,0,0.03), 0 0 10px rgba(0,255,0,0.1)',
    }}>
      <div style={{
        position:'absolute', top:0, left:0, right:0, bottom:0,
        background:'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,255,0,0.015) 2px,rgba(0,255,0,0.015) 4px)',
        pointerEvents:'none', zIndex:1,
      }}/>
      <div style={{ position:'relative', zIndex:2 }}>

        {/* Header con REFRESH arriba siempre visible */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:11, color:'#00ff00', letterSpacing:3, fontWeight:700, fontFamily:"'Courier New',monospace", textShadow:'0 0 8px rgba(0,255,0,0.5)' }}>
              {'>'} ARIA::INFORME
            </span>
            <div style={{ width:8, height:8, borderRadius:'50%', background:'#00ff00', animation:'blink 1.5s infinite', boxShadow:'0 0 6px #00ff00' }}/>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <button onClick={generateReport} disabled={loading||typing} title="Actualizar"
              style={{
                background:'#00ff0022', border:'1px solid #00ff0055', borderRadius:3,
                color:'#00ff00', fontSize:9, padding:'3px 10px',
                cursor:loading||typing?'not-allowed':'pointer',
                fontFamily:"'Courier New',monospace", fontWeight:700,
                opacity:loading||typing?0.5:1,
              }}>⟳ REFRESH</button>
            {(loading||typing) && (
              <span style={{ color:'#00ff0088', fontSize:9, fontFamily:"'Courier New',monospace", animation:'blink 0.3s infinite' }}>
                {loading?'GENERANDO...':'TX...'}
              </span>
            )}
            <span style={{ fontSize:9, color:'#00ff0066', fontFamily:"'Courier New',monospace" }}>
              {lastUpdate?`[${lastUpdate.toLocaleTimeString('es-PE')}]`:''}
            </span>
          </div>
        </div>

        {/* Contenido CRT */}
        <div style={{ borderTop:'1px solid #00ff0022', paddingTop:5 }}>
          <div style={{
            fontSize:11, color:'#00ff00', lineHeight:1.5, whiteSpace:'pre-wrap',
            fontFamily:"'Courier New',monospace", textShadow:'0 0 4px rgba(0,255,0,0.3)',
            letterSpacing:0.3, minHeight:60,
          }}>
            {loading&&!displayText
              ? '> Conectando con ARIA...\n> Analizando sismos cercanos al Perú...'
              : displayText||'> Iniciando...'}
            {typing&&<span style={{ animation:'blink 0.4s infinite', color:'#00ff00', textShadow:'0 0 8px #00ff00' }}>█</span>}
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop:'1px solid #00ff0015', marginTop:6, paddingTop:4, display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:8, color:'#00ff0044', fontFamily:"'Courier New',monospace" }}>CNAT::ARIA::v3.3 | Auto:5min</span>
          <span style={{ fontSize:8, color:'#00ff0044', fontFamily:"'Courier New',monospace" }}>Claude AI</span>
        </div>
      </div>
    </div>
  );
}
