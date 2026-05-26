import React, { useState, useCallback, useEffect, useRef } from 'react';

/**
 * AutoReport.jsx
 * ARIA::INFORME — Panel CRT del sidebar derecho
 * Marina de Guerra del Perú | MICROHELP © 2026
 *
 * v3.1 — Prompt mejorado:
 * - Fecha y hora de cada sismo
 * - Todas las fuentes con sus magnitudes (USGS / IRIS / IGP)
 * - Jerarquía primera plana para Perú
 * - Botón REFRESH siempre visible
 * - Auto-refresco cada 5 minutos
 */

const CLAUDE_KEY = process.env.REACT_APP_CLAUDE_KEY || '';

const PERU_CENTER = { lat: -9.19, lon: -75.01 };

function distanciaKm(lat1, lon1, lat2, lon2) {
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function clasificarProximidad(lat, lon, mag) {
  const dist   = distanciaKm(lat, lon, PERU_CENTER.lat, PERU_CENTER.lon);
  const enBbox = lat >= -18.5 && lat <= -0.03 && lon >= -81.5 && lon <= -68.5;
  if (enBbox || dist <= 300)  return { nivel: 'LOCAL',    distKm: Math.round(dist), urgente: mag >= 5.5 };
  if (dist <= 800)            return { nivel: 'CERCANO',  distKm: Math.round(dist), urgente: mag >= 6.0 };
  if (dist <= 1500)           return { nivel: 'REGIONAL', distKm: Math.round(dist), urgente: mag >= 6.5 };
  return                             { nivel: 'REMOTO',   distKm: Math.round(dist), urgente: false };
}

// ─── Agrupa sismos del mismo evento por lugar/hora para mostrar todas las fuentes ───
function agruparPorEvento(eqs) {
  const grupos = {};
  eqs.forEach(e => {
    // Clave: lugar + ventana de 10 minutos + magnitud similar
    const tiempo  = Math.floor(new Date(e.event_time).getTime() / (10 * 60 * 1000));
    const magBase = Math.round(e.magnitude * 2) / 2; // redondea a 0.5
    const clave   = `${tiempo}_${magBase}_${(e.place || '').substring(0, 20)}`;
    if (!grupos[clave]) grupos[clave] = [];
    grupos[clave].push(e);
  });
  return Object.values(grupos);
}

function buildPrompt(data) {
  const k   = data?.kpis        || {};
  const eqs = data?.earthquakes || [];
  const now = new Date().toLocaleString('es-PE', {
    day:'2-digit', month:'2-digit', year:'numeric',
    hour:'2-digit', minute:'2-digit'
  });

  // Enriquecer con proximidad
  const enriquecidos = eqs
    .filter(e => e.latitude && e.longitude && e.magnitude >= 4.5)
    .map(e => ({
      ...e,
      prox: clasificarProximidad(
        parseFloat(e.latitude),
        parseFloat(e.longitude),
        e.magnitude
      ),
    }));

  const urgentes   = enriquecidos.filter(e => e.prox.urgente);
  const locales    = enriquecidos.filter(e => e.prox.nivel === 'LOCAL');
  const cercanos   = enriquecidos.filter(e => e.prox.nivel === 'CERCANO');

  const prioritarios = [...urgentes, ...locales, ...cercanos]
    .filter((e, i, arr) => arr.findIndex(x => x.id === e.id) === i)
    .slice(0, 4);

  const resto = enriquecidos
    .filter(e => !prioritarios.find(x => x.id === e.id))
    .slice(0, 3);

  // Agrupar eventos prioritarios por lugar para mostrar todas las fuentes
  const grupos = agruparPorEvento(prioritarios);
  const eventosConFuentes = grupos.map(grupo => {
    const rep    = grupo[0];
    const fuentes = grupo.map(e => `${(e.source_id || '?').toUpperCase()}:M${e.magnitude}`).join(' | ');
    const fecha  = new Date(rep.event_time).toLocaleString('es-PE', {
      day:'2-digit', month:'2-digit',
      hour:'2-digit', minute:'2-digit'
    });
    return `  ${rep.place} | ${fuentes} | Prof:${rep.depth_km}km | ~${rep.prox.distKm}km de Perú | ${fecha} | ${rep.prox.nivel}`;
  });

  // También agrupar todos los sismos para mostrar fuentes múltiples
  const todosGrupos = agruparPorEvento(enriquecidos.slice(0, 20));
  const eventosConFuentesCompleto = todosGrupos.slice(0, 8).map(grupo => {
    const rep    = grupo[0];
    const fuentes = grupo.map(e => `${(e.source_id || '?').toUpperCase()}:M${e.magnitude}`).join(' | ');
    const fecha  = new Date(rep.event_time).toLocaleString('es-PE', {
      day:'2-digit', month:'2-digit',
      hour:'2-digit', minute:'2-digit'
    });
    return `  ${rep.place} | ${fuentes} | Prof:${rep.depth_km}km | ${fecha}`;
  });

  return `Eres ARIA, asistente del CNAT. Genera un MICRO-REPORTE de exactamente 6 líneas para el operador de guardia.
Fecha/hora actual: ${now}

REGLA CRÍTICA DE FORMATO:
- Línea 1: Semáforo (🟢/🟡/🔴) + estado + fecha/hora actual
- Líneas 2-3: PRIMERA PLANA — sismos LOCALES o CERCANOS al Perú con magnitud, lugar, fecha/hora y TODAS las fuentes que lo reportan. Si no hay → resumen compacto.
- Línea 4: Estado boyas DART y fuentes activas
- Línea 5: Recomendación operativa concreta
- Línea 6: Nivel de alerta DHN

IMPORTANTE: Cuando un sismo aparece en múltiples fuentes (USGS, IRIS, IGP), menciona TODAS con sus magnitudes así: "USGS:M6.9 | IRIS:M6.8". Esto es crítico para el operador.
Sin markdown. Sin bullets. Sin líneas vacías. Máximo 14 palabras por línea.

ESTADO ACTUAL:
Riesgo: ${k.risk_level || 'BAJO'} | Sismos: ${k.total_earthquakes || 0} | Alertas: ${k.active_alerts || 0} | Locales: ${k.local_earthquakes_count || 0}
Boyas: ${k.alert_buoys || 0}/${k.total_buoys || 0} | Fuentes: ${k.sources_online || 0}/${k.total_sources || 0} | DHN Alarmas: ${k.dhn_alarma_count || 0}

${prioritarios.length > 0
  ? `⚠️ EVENTOS PRIORITARIOS PARA PERÚ (PRIMERA PLANA — incluye TODAS las fuentes y magnitudes):\n${eventosConFuentes.join('\n')}`
  : '(Sin eventos prioritarios para Perú en este momento)'}

${resto.length > 0
  ? `Otros eventos (resumen):\n${eventosConFuentesCompleto.join('\n')}`
  : ''}`;
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
    const full = `> ${report.split('\n').filter(l => l.trim()).join('\n> ')}`;
    setDisplayText('');
    setTyping(true);
    let i = 0;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      i++;
      setDisplayText(full.substring(0, i));
      if (i >= full.length) { clearInterval(timerRef.current); setTyping(false); }
    }, 35);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [report]);

  const generateReport = useCallback(async () => {
    if (!data?.earthquakes?.length) return;
    setLoading(true);
    setDisplayText('');
    setReport('');
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'x-api-key':     CLAUDE_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model:      'claude-sonnet-4-20250514',
          max_tokens: 300,
          messages:   [{ role: 'user', content: buildPrompt(data) }],
        }),
      });
      const d = await r.json();
      setReport(
        (d.content?.[0]?.text || 'Error al generar reporte')
          .split('\n').filter(l => l.trim()).join('\n')
      );
      setLastUpdate(new Date());
    } catch (e) {
      setReport(`Error conexion IA: ${e.message}`);
    }
    setLoading(false);
  }, [data]);

  useEffect(() => {
    if (data?.earthquakes?.length && !report && !loading) generateReport();
  }, [data, generateReport, report, loading]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => { if (!loading) generateReport(); }, 5 * 60 * 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [generateReport, loading]);

  return (
    <div style={{
      background: '#000000', borderRadius: 6,
      border: '1px solid #00ff0033', padding: 12,
      position: 'relative', overflow: 'hidden',
      boxShadow: 'inset 0 0 60px rgba(0,255,0,0.03), 0 0 10px rgba(0,255,0,0.1)',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,0,0.015) 2px, rgba(0,255,0,0.015) 4px)',
        pointerEvents: 'none', zIndex: 1,
      }} />
      <div style={{ position: 'relative', zIndex: 2 }}>

        {/* ── Header con REFRESH siempre visible ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 11, color: '#00ff00', letterSpacing: 3, fontWeight: 700,
              fontFamily: "'Courier New', monospace", textShadow: '0 0 8px rgba(0,255,0,0.5)',
            }}>{'>'} ARIA::INFORME</span>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', background: '#00ff00',
              animation: 'blink 1.5s infinite', boxShadow: '0 0 6px #00ff00',
            }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Botón REFRESH — siempre visible, siempre arriba */}
            <button
              onClick={generateReport}
              disabled={loading || typing}
              title="Actualizar informe ARIA"
              style={{
                background: '#00ff0022', border: '1px solid #00ff0055',
                borderRadius: 3, color: '#00ff00', fontSize: 9,
                padding: '3px 10px', cursor: loading || typing ? 'not-allowed' : 'pointer',
                fontFamily: "'Courier New', monospace", fontWeight: 700,
                opacity: loading || typing ? 0.5 : 1,
              }}
            >⟳ REFRESH</button>
            {(loading || typing) && (
              <span style={{ color: '#00ff0088', fontSize: 9, fontFamily: "'Courier New', monospace", animation: 'blink 0.3s infinite' }}>
                {loading ? 'PROCESANDO...' : 'TX...'}
              </span>
            )}
            <span style={{ fontSize: 9, color: '#00ff0066', fontFamily: "'Courier New', monospace" }}>
              {lastUpdate ? `[${lastUpdate.toLocaleTimeString('es-PE')}]` : ''}
            </span>
          </div>
        </div>

        {/* ── Contenido CRT ── */}
        <div style={{ borderTop: '1px solid #00ff0022', paddingTop: 5 }}>
          <div style={{
            fontSize: 12, color: '#00ff00', lineHeight: 1.4,
            whiteSpace: 'pre-wrap', fontFamily: "'Courier New', monospace",
            textShadow: '0 0 4px rgba(0,255,0,0.3)', letterSpacing: 0.3, minHeight: 60,
          }}>
            {loading && !displayText
              ? '> Conectando con ARIA...\n> Analizando datos sismicos...'
              : displayText || '> Iniciando...'}
            {typing && <span style={{ animation: 'blink 0.4s infinite', color: '#00ff00', textShadow: '0 0 8px #00ff00' }}>█</span>}
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{
          borderTop: '1px solid #00ff0015', marginTop: 6, paddingTop: 4,
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 8, color: '#00ff0044', fontFamily: "'Courier New', monospace" }}>CNAT::ARIA::v3.1 | Auto: 5min</span>
          <span style={{ fontSize: 8, color: '#00ff0044', fontFamily: "'Courier New', monospace" }}>Claude AI</span>
        </div>
      </div>
    </div>
  );
}
