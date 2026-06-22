import React, { useState, useCallback, useEffect, useRef } from 'react';

/**
 * AutoReport.jsx — VIGÍA::ANÁLISIS  (el "piloto" del CNAT)
 * Marina de Guerra del Perú | MICROHELP © 2026
 * v3.5 — Seguridad: la llamada a Claude pasa por la Edge Function "aria"
 *        (la API key ya NO vive en el navegador; eliminado REACT_APP_CLAUDE_KEY).
 *        Rol interpretativo: NO relista sismos (de eso se encarga el FEED).
 *        Interpreta la situación, evalúa riesgo de tsunami para la costa
 *        peruana y entrega viñetas claras + conclusión operativa.
 */

// ─── Endpoint seguro: Edge Function "aria" (proxy del lado servidor) ───
const ARIA_ENDPOINT =
  'https://zgcjggfbdpfbmivwqjvt.supabase.co/functions/v1/aria';

function buildPrompt(data) {
  const k   = data?.kpis        || {};
  const eqs = data?.earthquakes || [];
  const now = new Date().toLocaleString('es-PE', {
    day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'
  });

  // ── Agrupar sismos del mismo evento (±10min) para considerar todas las fuentes ──
  const grupos = {};
  eqs.filter(e => e.latitude && e.longitude && e.magnitude >= 4.0).forEach(e => {
    const t     = Math.floor(new Date(e.event_time).getTime() / (10*60*1000));
    const mag   = Math.round(e.magnitude * 2) / 2;
    const lugar = (e.place||'').substring(0,20).toLowerCase().replace(/\s+/g,'_');
    const key   = `${t}_${mag}_${lugar}`;
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(e);
  });

  // ── Calcular distancia a Lima y clasificar nivel ──
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

  // ── Insumos (reciente→antiguo). NO son para copiar: son para interpretar ──
  const cercanos = eventos
    .filter(e => e.nivel !== 'REMOTO')
    .sort((a,b) => b.ts - a.ts)
    .slice(0, 8);

  const remotos = eventos
    .filter(e => e.nivel === 'REMOTO' && e.rep.magnitude >= 5.5)
    .sort((a,b) => b.ts - a.ts)
    .slice(0, 5);

  // ── Posibles generadores de tsunami: magnitud alta + someros (≤70km) ──
  const tsunamiSospechosos = eventos
    .filter(e => e.rep.magnitude >= 6.5 && (!e.rep.depth_km || e.rep.depth_km <= 70))
    .sort((a,b) => b.rep.magnitude - a.rep.magnitude)
    .slice(0, 5);

  const fmtLinea = e => `${e.fecha} | ${e.rep.place||'?'} | M${e.rep.magnitude} | P:${e.rep.depth_km}km | ~${e.dist}km de Lima | ${e.nivel}`;

  const insumoCercanos = cercanos.length > 0
    ? cercanos.map(fmtLinea).join('\n')
    : 'Sin eventos cercanos al Perú en el periodo.';

  const insumoRemotos = remotos.length > 0
    ? remotos.map(fmtLinea).join('\n')
    : 'Sin eventos lejanos M5.5+ relevantes.';

  const insumoTsunami = tsunamiSospechosos.length > 0
    ? tsunamiSospechosos.map(fmtLinea).join('\n')
    : 'Ninguno: no hay sismos M6.5+ someros en el periodo.';

  return `Eres VIGÍA, el analista de guardia del CNAT (Marina de Guerra del Perú).

TU ROL: NO listar sismos —de eso se encarga el panel FEED SÍSMICO—. Tu trabajo es
INTERPRETAR la situación a nivel nacional y decidir si algún sismo (cercano o lejano)
representa RIESGO DE TSUNAMI para la costa peruana, y recomendar una acción.

Responde EXACTAMENTE en este formato, en español, sin markdown, sin asteriscos y SIN el símbolo ">":

🟢 ESTADO: [una frase con la situación general] — ${now}
• [Interpretación general de la actividad sísmica relevante para el Perú en los últimos 7 días]
• [Riesgo de tsunami: ¿algún sismo M6.5+ somero —cercano o lejano— puede generar olas hacia la costa peruana? Di cuál y por qué SÍ o por qué NO]
• [Instrumentación: qué dicen las boyas DART y las fuentes activas para la toma de decisión]
CONCLUSIÓN: [recomendación operativa en una sola línea]

SEMÁFORO DEL ESTADO:
- 🟢 si no hay amenaza de tsunami para el Perú
- 🟡 si hay un evento que amerita vigilancia
- 🔴 si hay amenaza de tsunami para la costa peruana

REGLAS:
1. Cada viñeta empieza con "• " y es UNA sola frase clara.
2. NO reproduzcas la lista de sismos: interprétala.
3. No uses el símbolo ">" en ninguna línea.
4. Máximo 3 viñetas + la línea CONCLUSIÓN.

INSUMOS PARA TU ANÁLISIS (interprétalos, no los copies):

Sismos cercanos al Perú (reciente→antiguo):
${insumoCercanos}

Sismos lejanos M5.5+ (reciente→antiguo):
${insumoRemotos}

Posibles generadores de tsunami (M6.5+ y ≤70km de profundidad):
${insumoTsunami}

Instrumentación: Boyas en anomalía ${k.alert_buoys||0}/${k.total_buoys||0} | Fuentes activas ${k.sources_online||0}/${k.total_sources||0} | Nivel DHN ${k.risk_level||'BAJO'}`;
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
      // ── Llamada SEGURA: pasa por la Edge Function "aria" (no expone la llave) ──
      const r = await fetch(ARIA_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages:   [{ role: 'user', content: buildPrompt(data) }],
          max_tokens: 500,
        }),
      });
      const d = await r.json();
      const texto = d.response || d.error || 'Error';
      setReport(texto.split('\n').filter(l=>l.trim()).join('\n'));
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

        {/* Header con REFRESH siempre visible */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:11, color:'#00ff00', letterSpacing:3, fontWeight:700, fontFamily:"'Courier New',monospace", textShadow:'0 0 8px rgba(0,255,0,0.5)' }}>
              VIGÍA::ANÁLISIS
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

        {/* Subtítulo de rol */}
        <div style={{ fontSize:8, color:'#00ff0055', fontFamily:"'Courier New',monospace", letterSpacing:1, marginBottom:5 }}>
          EL PILOTO · INTERPRETA · NO RELISTA · RIESGO DE TSUNAMI PARA PERÚ
        </div>

        {/* Contenido CRT */}
        <div style={{ borderTop:'1px solid #00ff0022', paddingTop:5 }}>
          <div style={{
            fontSize:11, color:'#00ff00', lineHeight:1.5, whiteSpace:'pre-wrap',
            fontFamily:"'Courier New',monospace", textShadow:'0 0 4px rgba(0,255,0,0.3)',
            letterSpacing:0.3, minHeight:60,
          }}>
            {loading&&!displayText
              ? 'Conectando con VIGÍA...\nAnalizando situación sísmica del Perú...'
              : displayText||'Iniciando análisis...'}
            {typing&&<span style={{ animation:'blink 0.4s infinite', color:'#00ff00', textShadow:'0 0 8px #00ff00' }}>█</span>}
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop:'1px solid #00ff0015', marginTop:6, paddingTop:4, display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:8, color:'#00ff0044', fontFamily:"'Courier New',monospace" }}>CNAT::VIGÍA::v3.5 | Auto:5min</span>
          <span style={{ fontSize:8, color:'#00ff0044', fontFamily:"'Courier New',monospace" }}>Claude AI</span>
        </div>
      </div>
    </div>
  );
}
