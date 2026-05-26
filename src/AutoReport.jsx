import React, { useState, useCallback, useEffect, useRef } from 'react';

/**
 * AutoReport.jsx
 * ARIA::INFORME — Panel CRT del sidebar derecho
 * Marina de Guerra del Perú | MICROHELP © 2026
 *
 * v3.0 — Módulo independizado
 * - Prompt con jerarquía de proximidad al Perú
 * - Auto-refresco cada 5 minutos
 * - Botón REFRESH siempre visible
 * - Efecto typewriter CRT
 *
 * USO:
 *   import AutoReport from './AutoReport';
 *   <AutoReport data={data} />
 */

const CLAUDE_KEY = process.env.REACT_APP_CLAUDE_KEY || '';

// ─── Coordenadas centro del Perú ───
const PERU_CENTER = { lat: -9.19, lon: -75.01 };

// ─── Distancia aproximada en km ───
function distanciaKm(lat1, lon1, lat2, lon2) {
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Clasifica proximidad al Perú ───
function clasificarProximidad(lat, lon, mag) {
  const dist  = distanciaKm(lat, lon, PERU_CENTER.lat, PERU_CENTER.lon);
  const enBbox =
    lat >= -18.5 && lat <= -0.03 &&
    lon >= -81.5 && lon <= -68.5;

  if (enBbox || dist <= 300)  return { nivel: 'LOCAL',    distKm: Math.round(dist), urgente: mag >= 5.5 };
  if (dist <= 800)            return { nivel: 'CERCANO',  distKm: Math.round(dist), urgente: mag >= 6.0 };
  if (dist <= 1500)           return { nivel: 'REGIONAL', distKm: Math.round(dist), urgente: mag >= 6.5 };
  return                             { nivel: 'REMOTO',   distKm: Math.round(dist), urgente: false };
}

// ─── Construye el prompt compacto para el micro-informe ───
function buildPrompt(data) {
  const k   = data?.kpis        || {};
  const eqs = data?.earthquakes || [];

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

  const urgentes = enriquecidos.filter(e => e.prox.urgente);
  const locales  = enriquecidos.filter(e => e.prox.nivel === 'LOCAL');
  const cercanos = enriquecidos.filter(e => e.prox.nivel === 'CERCANO');

  // Eventos prioritarios sin duplicados
  const prioritarios = [...urgentes, ...locales, ...cercanos]
    .filter((e, i, arr) => arr.findIndex(x => x.id === e.id) === i)
    .slice(0, 3);

  const resto = enriquecidos
    .filter(e => !prioritarios.find(x => x.id === e.id))
    .slice(0, 3);

  return `Genera un MICRO-REPORTE de exactamente 6 líneas para el operador de guardia del CNAT.

REGLA CRÍTICA DE FORMATO:
- Línea 1: Semáforo (🟢/🟡/🔴) + estado general en UNA frase
- Líneas 2-3: Si hay sismos LOCALES o CERCANOS al Perú → van en PRIMERA PLANA con magnitud, lugar y distancia. Si no hay → resumen compacto de los más fuertes.
- Línea 4: Estado boyas DART y fuentes de datos
- Línea 5: Recomendación operativa concreta al oficial de guardia
- Línea 6: Nivel de alerta DHN actual

Sin markdown. Sin bullets. Sin líneas vacías. Máximo 12 palabras por línea.

DATOS ACTUALES:
Riesgo: ${k.risk_level || 'BAJO'} | Sismos: ${k.total_earthquakes || 0} | Alertas: ${k.active_alerts || 0} | Locales: ${k.local_earthquakes_count || 0}
Boyas: ${k.alert_buoys || 0}/${k.total_buoys || 0} | Fuentes: ${k.sources_online || 0}/${k.total_sources || 0} | DHN Alarmas: ${k.dhn_alarma_count || 0} | DHN Alertas: ${k.dhn_alerta_count || 0}

${prioritarios.length > 0
  ? `⚠️ PRIORITARIOS PARA PERÚ (van en líneas 2-3):\n${prioritarios.map(e =>
      `  M${e.magnitude} — ${e.place} | ~${e.prox.distKm}km de Perú | Prof:${e.depth_km}km | ${e.prox.nivel}`
    ).join('\n')}`
  : '(Sin eventos prioritarios para Perú)'}

${resto.length > 0
  ? `Otros relevantes: ${resto.map(e => `M${e.magnitude} ${e.place}`).join(' | ')}`
  : ''}`;
}

/* ════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ════════════════════════════════════════════ */
export default function AutoReport({ data }) {
  const [report,      setReport]      = useState('');
  const [displayText, setDisplayText] = useState('');
  const [loading,     setLoading]     = useState(false);
  const [lastUpdate,  setLastUpdate]  = useState(null);
  const [typing,      setTyping]      = useState(false);
  const timerRef    = useRef(null);
  const intervalRef = useRef(null);

  // ── Efecto typewriter ──
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
      if (i >= full.length) {
        clearInterval(timerRef.current);
        setTyping(false);
      }
    }, 35);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [report]);

  // ── Genera el micro-reporte ──
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
          max_tokens: 250,
          messages:   [{ role: 'user', content: buildPrompt(data) }],
        }),
      });
      const d = await r.json();
      setReport(
        (d.content?.[0]?.text || 'Error al generar reporte')
          .split('\n')
          .filter(l => l.trim())
          .join('\n')
      );
      setLastUpdate(new Date());
    } catch (e) {
      setReport(`Error conexion IA: ${e.message}`);
    }
    setLoading(false);
  }, [data]);

  // ── Generación inicial ──
  useEffect(() => {
    if (data?.earthquakes?.length && !report && !loading) {
      generateReport();
    }
  }, [data, generateReport, report, loading]);

  // ── Auto-refresco cada 5 minutos ──
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (!loading) generateReport();
    }, 5 * 60 * 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [generateReport, loading]);

  return (
    <div style={{
      background:  '#000000',
      borderRadius: 6,
      border:       '1px solid #00ff0033',
      padding:      12,
      position:     'relative',
      overflow:     'hidden',
      boxShadow:    'inset 0 0 60px rgba(0,255,0,0.03), 0 0 10px rgba(0,255,0,0.1)',
    }}>

      {/* Scanlines CRT */}
      <div style={{
        position:   'absolute', top: 0, left: 0, right: 0, bottom: 0,
        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,0,0.015) 2px, rgba(0,255,0,0.015) 4px)',
        pointerEvents: 'none', zIndex: 1,
      }} />

      <div style={{ position: 'relative', zIndex: 2 }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize:    11,
              color:       '#00ff00',
              letterSpacing: 3,
              fontWeight:  700,
              fontFamily:  "'Courier New', monospace",
              textShadow:  '0 0 8px rgba(0,255,0,0.5)',
            }}>
              {'>'} ARIA::INFORME
            </span>
            <div style={{
              width:      8,
              height:     8,
              borderRadius: '50%',
              background: '#00ff00',
              animation:  'blink 1.5s infinite',
              boxShadow:  '0 0 6px #00ff00',
            }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {(loading || typing) && (
              <span style={{
                color:     '#00ff0088',
                fontSize:  9,
                fontFamily: "'Courier New', monospace",
                animation: 'blink 0.3s infinite',
              }}>
                {loading ? 'PROCESANDO...' : 'TRANSMITIENDO...'}
              </span>
            )}
            <span style={{
              fontSize:  9,
              color:     '#00ff0066',
              fontFamily: "'Courier New', monospace",
            }}>
              {lastUpdate ? `[${lastUpdate.toLocaleTimeString('es-PE')}]` : ''}
            </span>
            {/* Botón REFRESH siempre visible */}
            <button
              onClick={generateReport}
              disabled={loading || typing}
              title="Actualizar informe ARIA"
              style={{
                background: '#00ff0011',
                border:     '1px solid #00ff0033',
                borderRadius: 3,
                color:      '#00ff00',
                fontSize:   9,
                padding:    '2px 8px',
                cursor:     loading || typing ? 'not-allowed' : 'pointer',
                fontFamily: "'Courier New', monospace",
                opacity:    loading || typing ? 0.5 : 1,
              }}
            >
              REFRESH
            </button>
          </div>
        </div>

        {/* ── Contenido CRT ── */}
        <div style={{ borderTop: '1px solid #00ff0022', paddingTop: 5 }}>
          <div style={{
            fontSize:    12,
            color:       '#00ff00',
            lineHeight:  1.4,
            whiteSpace:  'pre-wrap',
            fontFamily:  "'Courier New', monospace",
            textShadow:  '0 0 4px rgba(0,255,0,0.3)',
            letterSpacing: 0.3,
            minHeight:   60,
          }}>
            {loading && !displayText
              ? '> Conectando con ARIA...\n> Analizando datos sismicos...'
              : displayText || '> Iniciando...'}
            {typing && (
              <span style={{
                animation: 'blink 0.4s infinite',
                color:     '#00ff00',
                textShadow: '0 0 8px #00ff00',
              }}>█</span>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{
          borderTop:  '1px solid #00ff0015',
          marginTop:  6,
          paddingTop: 4,
          display:    'flex',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 8, color: '#00ff0044', fontFamily: "'Courier New', monospace" }}>
            CNAT::ARIA::v3.0 | Auto: 5min
          </span>
          <span style={{ fontSize: 8, color: '#00ff0044', fontFamily: "'Courier New', monospace" }}>
            Claude AI
          </span>
        </div>

      </div>
    </div>
  );
}
