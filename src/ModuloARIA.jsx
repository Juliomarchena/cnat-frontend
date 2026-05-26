import React, { useState, useCallback, useEffect, useRef } from 'react';
import AutoReport from './AutoReport';

/**
 * ModuloARIA.jsx
 * ARIA — Asistente IA del CNAT
 * Marina de Guerra del Perú | MICROHELP © 2026
 *
 * v3.0 — Módulo independizado desde App.js
 * - Prompt con jerarquía de PRIMERA PLANA para sismos cercanos al Perú
 * - AutoReport integrado con polling automático cada 5 minutos
 * - Lógica de proximidad geográfica al Perú
 * - Distinción clara: evento LOCAL vs evento REMOTO
 */

const CLAUDE_KEY = process.env.REACT_APP_CLAUDE_KEY || '';

// ─── Coordenadas de referencia del Perú ───
const PERU_CENTER = { lat: -9.19, lon: -75.01 };
const PERU_BBOX   = { latMin: -18.5, latMax: -0.03, lonMin: -81.5, lonMax: -68.5 };

// ─── Distancia aproximada en km entre dos puntos ───
function distanciaKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
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
  const dist = distanciaKm(lat, lon, PERU_CENTER.lat, PERU_CENTER.lon);
  const enBbox =
    lat >= PERU_BBOX.latMin &&
    lat <= PERU_BBOX.latMax &&
    lon >= PERU_BBOX.lonMin &&
    lon <= PERU_BBOX.lonMax;

  if (enBbox || dist <= 300)  return { nivel: 'LOCAL',    distKm: Math.round(dist), urgente: mag >= 5.5 };
  if (dist <= 800)            return { nivel: 'CERCANO',  distKm: Math.round(dist), urgente: mag >= 6.0 };
  if (dist <= 1500)           return { nivel: 'REGIONAL', distKm: Math.round(dist), urgente: mag >= 6.5 };
  return                             { nivel: 'REMOTO',   distKm: Math.round(dist), urgente: false };
}

// ─── Construye el system prompt con jerarquía ───
function buildSystemPrompt(data) {
  const k   = data?.kpis        || {};
  const eqs = data?.earthquakes || [];
  const al  = data?.alerts      || [];
  const bu  = data?.buoys       || [];
  const ns  = data?.news_summary;
  const now = new Date().toLocaleString('es-PE');

  // ── Clasificar sismos por proximidad al Perú ──
  const enriquecidos = eqs
    .filter(e => e.latitude && e.longitude && e.magnitude >= 4.0)
    .map(e => ({
      ...e,
      prox: clasificarProximidad(
        parseFloat(e.latitude),
        parseFloat(e.longitude),
        e.magnitude
      ),
    }));

  const locales   = enriquecidos.filter(e => e.prox.nivel === 'LOCAL');
  const cercanos  = enriquecidos.filter(e => e.prox.nivel === 'CERCANO');
  const regionales= enriquecidos.filter(e => e.prox.nivel === 'REGIONAL');
  const remotos   = enriquecidos.filter(e => e.prox.nivel === 'REMOTO').slice(0, 8);

  const fmt = e =>
    `  • M${e.magnitude} | ${e.place} | Prof:${e.depth_km}km | ${e.prox.nivel} (~${e.prox.distKm}km de Perú) | DHN:${e.dhn_level || 'N/A'} | isLocal:${e.is_local}`;

  // ── Sección de ALERTA MÁXIMA si hay eventos urgentes ──
  const urgentes = enriquecidos.filter(e => e.prox.urgente);
  const seccionUrgente = urgentes.length > 0
    ? `
⚠️⚠️⚠️ EVENTOS DE ALTA PRIORIDAD PARA PERÚ ⚠️⚠️⚠️
${urgentes.map(e =>
  `🔴 M${e.magnitude} — ${e.place}
   Distancia a Perú: ~${e.prox.distKm} km | Profundidad: ${e.depth_km} km
   Nivel DHN: ${e.dhn_level || 'N/A'} | is_local: ${e.is_local}
   → ESTE EVENTO DEBE ENCABEZAR CUALQUIER BOLETÍN`
).join('\n')}
⚠️⚠️⚠️ FIN EVENTOS PRIORITARIOS ⚠️⚠️⚠️
`
    : '(Sin eventos de alta prioridad para Perú en este momento)';

  return `Eres ARIA, asistente IA del CNAT (Centro Nacional de Alerta de Tsunamis) de la Marina de Guerra del Perú.
Responde siempre en español profesional. Fecha y hora actual: ${now}.

════════════════════════════════════════════
REGLA FUNDAMENTAL DE JERARQUÍA — LEE ESTO PRIMERO
════════════════════════════════════════════
Cuando generes cualquier boletín o reporte, SIEMPRE sigue este orden:

1. 🔴 PRIMERO: Sismos LOCALES o CERCANOS al Perú (< 800 km) con M≥5.5
   → Estos van en PRIMERA PLANA con todos los detalles
   → Incluye: magnitud, lugar exacto, profundidad, distancia a costa peruana,
     tiempo de arribo estimado si aplica, estado de boyas DART más cercanas,
     nivel de alerta DHN, recomendaciones inmediatas al operador

2. 🟡 SEGUNDO: Sismos REGIONALES (800–1500 km) con M≥6.0
   → Párrafo propio con análisis de riesgo para Perú

3. ⚪ TERCERO: Resto del mundo
   → Solo resumen compacto, una línea por evento

4. 📊 CUARTO: Estado operacional general (boyas, fuentes, estadísticas)

5. 📰 QUINTO: Resumen de noticias VIGÍA si está disponible

NUNCA mezcles un M6.9 en Chile con un M4.5 en Hawaii en la misma lista plana.
Un sismo local M5.5 es MÁS URGENTE para el operador peruano que un M7.0 en Japón.
════════════════════════════════════════════

KPIs OPERACIONALES:
  Sismos totales : ${k.total_earthquakes  || 0}
  Alertas activas: ${k.active_alerts      || 0}
  Eventos críticos: ${k.critical_count   || 0}
  Boyas DART     : ${k.alert_buoys || 0}/${k.total_buoys || 0} operativas
  Fuentes datos  : ${k.sources_online || 0}/${k.total_sources || 0} activas
  Nivel de riesgo: ${k.risk_level || 'BAJO'}
  DHN Alarmas    : ${k.dhn_alarma_count   || 0}
  DHN Alertas    : ${k.dhn_alerta_count   || 0}
  Sismos locales : ${k.local_earthquakes_count || 0}

${seccionUrgente}

SISMOS LOCALES (dentro del Perú o <300km):
${locales.length > 0 ? locales.map(fmt).join('\n') : '  Ninguno'}

SISMOS CERCANOS (300–800km de Perú):
${cercanos.length > 0 ? cercanos.slice(0,8).map(fmt).join('\n') : '  Ninguno'}

SISMOS REGIONALES (800–1500km de Perú):
${regionales.length > 0 ? regionales.slice(0,6).map(fmt).join('\n') : '  Ninguno'}

OTROS EVENTOS RELEVANTES (>1500km — resumen):
${remotos.length > 0 ? remotos.map(e => `  • M${e.magnitude} ${e.place} (${e.depth_km}km)`).join('\n') : '  Ninguno'}

ALERTAS TSUNAMI ACTIVAS (${al.length}):
${al.length > 0 ? al.slice(0,5).map(a => `  • ${a.title}`).join('\n') : '  Sin alertas activas'}

BOYAS DART:
${bu.map(b => `  • ${b.name}: ${b.status?.toUpperCase()}`).join('\n') || '  Sin datos'}

UMBRALES DHN VIGENTES:
  ALARMA    : M7.5+ a ≤60km de costa
  ALERTA    : M7.0+ a ≤100km | M6.5+ a ≤70km
  INFORMACIÓN: M6.0+ a ≤100km

${ns ? `ÚLTIMO RESUMEN VIGÍA — ESCUCHA SOCIAL (${new Date(ns.generated_at).toLocaleString('es-PE')}):
  Score: ${ns.relevance_score}/10 | Artículos: ${ns.articles_count}
  ${ns.summary_text?.substring(0, 500)}` : 'VIGÍA: Sin resumen disponible aún.'}`;
}

// ─── Prompt compacto para AutoReport (panel derecho) ───
function buildAutoReportPrompt(data) {
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

  const urgentes  = enriquecidos.filter(e => e.prox.urgente);
  const locales   = enriquecidos.filter(e => e.prox.nivel === 'LOCAL');
  const cercanos  = enriquecidos.filter(e => e.prox.nivel === 'CERCANO');

  const eventosPrioritarios = [...urgentes, ...locales, ...cercanos]
    .filter((e, i, arr) => arr.findIndex(x => x.id === e.id) === i)
    .slice(0, 3);

  const restoEventos = enriquecidos
    .filter(e => !eventosPrioritarios.find(x => x.id === e.id))
    .slice(0, 3);

  return `Genera un MICRO-REPORTE de exactamente 6 líneas para el operador de guardia del CNAT.

REGLA CRÍTICA DE FORMATO:
- Línea 1: Semáforo (🟢/🟡/🔴) + estado general en UNA frase
- Líneas 2-3: Si hay sismos LOCALES o CERCANOS al Perú → PRIMERA PLANA con magnitud, lugar y distancia al Perú. Si no hay → resumen compacto de los más fuertes.
- Línea 4: Estado boyas DART y fuentes
- Línea 5: Recomendación operativa concreta
- Línea 6: Nivel de alerta DHN actual

Sin markdown, sin bullets, sin líneas vacías. Máximo 12 palabras por línea.

DATOS ACTUALES:
Riesgo: ${k.risk_level || 'BAJO'} | Sismos: ${k.total_earthquakes || 0} | Alertas: ${k.active_alerts || 0} | Locales: ${k.local_earthquakes_count || 0}
Boyas: ${k.alert_buoys || 0}/${k.total_buoys || 0} | Fuentes: ${k.sources_online || 0}/${k.total_sources || 0} | DHN Alarmas: ${k.dhn_alarma_count || 0}

${eventosPrioritarios.length > 0
  ? `⚠️ PRIORITARIOS PARA PERÚ:\n${eventosPrioritarios.map(e => `M${e.magnitude} ${e.place} ~${e.prox.distKm}km prof:${e.depth_km}km`).join('\n')}`
  : ''}
${restoEventos.length > 0
  ? `Otros: ${restoEventos.map(e => `M${e.magnitude} ${e.place}`).join(' | ')}`
  : ''}`;
}


/* ════════════════════════════════════════════
   ARIA ASSISTANT — Módulo principal
   ════════════════════════════════════════════ */
export default function ModuloARIA({ data }) {
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const messagesEndRef = useRef(null);

  const prompts = [
    'Genera un boletin para el operador de guardia',
    'Hay riesgo de tsunami para Peru ahora mismo?',
    'Analiza los sismos significativos de las ultimas 24h',
    'Genera un reporte ejecutivo de la situacion sismica actual',
    'Estado de las boyas DART cercanas a Peru',
  ];

  // Auto-scroll al último mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = useCallback(async (text) => {
    if (!text.trim()) return;
    const userMsg  = { role: 'user', content: text };
    const newMsgs  = [...messages, userMsg];
    setMessages(newMsgs);
    setInput('');
    setLoading(true);

    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'x-api-key':     CLAUDE_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model:      'claude-sonnet-4-20250514',
          max_tokens: 2000,
          system:     buildSystemPrompt(data),
          messages:   newMsgs.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const d = await r.json();
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: d.content?.[0]?.text || JSON.stringify(d) },
      ]);
    } catch (e) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `⚠ Error de conexión: ${e.message}` },
      ]);
    }
    setLoading(false);
  }, [messages, data]);

  const exportPDF = () => {
    const k   = data?.kpis || {};
    const now = new Date().toLocaleString('es-PE');
    const content = messages.map(m => `
      <div style="margin-bottom:20px;padding:14px;border-left:4px solid ${m.role === 'user' ? '#f59e0b' : '#8b5cf6'};background:${m.role === 'user' ? '#fff8e7' : '#f8f6ff'}">
        <div style="font-size:11px;font-weight:700;color:${m.role === 'user' ? '#92400e' : '#6d28d9'};margin-bottom:8px;letter-spacing:1px">
          ${m.role === 'user' ? 'OPERADOR' : 'ARIA — Asistente IA CNAT'}
        </div>
        <div style="font-size:13px;color:#1e293b;line-height:1.8;white-space:pre-wrap">${m.content}</div>
      </div>`).join('');

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>Reporte ARIA - CNAT ${now}</title>
<style>body{font-family:'Courier New',monospace;margin:0;padding:0;color:#1e293b}@media print{.no-print{display:none}}</style>
</head><body>
<div style="background:#0a1628;padding:24px 32px;color:#fff">
  <div style="display:flex;align-items:center;gap:16px">
    <div style="font-size:28px;font-weight:900;color:#f59e0b;letter-spacing:4px">CNAT</div>
    <div>
      <div style="font-size:11px;color:#94a3b8;letter-spacing:2px">CENTRO NACIONAL DE ALERTA DE TSUNAMIS</div>
      <div style="font-size:9px;color:#475569;margin-top:2px">DIRECCIÓN DE HIDROGRAFÍA Y NAVEGACIÓN — MGP</div>
    </div>
    <div style="margin-left:auto;text-align:right">
      <div style="font-size:10px;color:#fbbf24">REPORTE ARIA — IA</div>
      <div style="font-size:9px;color:#64748b">${now}</div>
    </div>
  </div>
</div>
<div style="background:#f1f5f9;padding:16px 32px;border-bottom:2px solid #e2e8f0;display:flex;gap:32px">
  <div style="font-size:11px"><span style="color:#64748b">SISMOS:</span> <b>${k.total_earthquakes || 0}</b></div>
  <div style="font-size:11px"><span style="color:#64748b">ALERTAS:</span> <b>${k.active_alerts || 0}</b></div>
  <div style="font-size:11px"><span style="color:#64748b">NIVEL DE RIESGO:</span> <b style="color:${k.risk_level === 'ALTO' ? '#dc2626' : k.risk_level === 'MEDIO' ? '#d97706' : '#16a34a'}">${k.risk_level || 'BAJO'}</b></div>
  <div style="font-size:11px"><span style="color:#64748b">BOYAS ACTIVAS:</span> <b>${k.alert_buoys || 0}/${k.total_buoys || 0}</b></div>
</div>
<div style="padding:24px 32px">${content || '<p style="color:#94a3b8;font-style:italic">Sin consultas registradas.</p>'}</div>
<div style="border-top:1px solid #e2e8f0;padding:12px 32px;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8">
  <span>CNAT v3.0 — MICROHELP © 2026</span>
  <span>Documento generado automáticamente por ARIA</span>
  <span>CONFIDENCIAL — USO INTERNO</span>
</div>
</body></html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Header ── */}
      <div style={{ padding: 16, borderBottom: '2px solid #8b5cf6', background: '#0a1628' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'linear-gradient(135deg,#8b5cf6,#6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, color: '#fff', fontWeight: 700,
          }}>A</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fbbf24', fontFamily: "'Orbitron'" }}>ARIA</div>
            <div style={{ fontSize: 11, color: '#a78bfa' }}>Asistente IA — CNAT v3.0</div>
          </div>
          {messages.length > 0 && (
            <>
              <button onClick={exportPDF} style={{
                padding: '6px 14px', borderRadius: 6, border: '1px solid #6366f1',
                background: '#1e1b4b', color: '#a5b4fc', fontSize: 11,
                cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, marginRight: 8,
              }}>⬇ PDF</button>
              <button onClick={() => setMessages([])} style={{
                padding: '6px 14px', borderRadius: 6, border: '1px solid #334155',
                background: '#0d1a2e', color: '#94a3b8', fontSize: 11,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>↩ Nueva consulta</button>
            </>
          )}
        </div>
      </div>

      {/* ── Pantalla inicial ── */}
      {messages.length === 0 && (
        <div style={{ padding: 16 }}>
          <div style={{
            background: '#000000', border: '2px solid #8b5cf6', borderRadius: 10,
            padding: '16px 18px', marginBottom: 18,
            boxShadow: '0 0 18px rgba(139,92,246,0.4), inset 0 0 30px rgba(139,92,246,0.05)',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 2, background: 'linear-gradient(90deg,#8b5cf6,#6366f1,#8b5cf6)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <span style={{ fontSize: 11, color: '#c4b5fd', fontWeight: 700, letterSpacing: 2.5 }}>GUÍA DE USO — ARIA</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>📡</span>
                <div style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.7, fontStyle: 'italic' }}>
                  <span style={{ color: '#fbbf24', fontWeight: 700, fontStyle: 'normal' }}>Mira ARIA</span> para saber{' '}
                  <span style={{ color: '#c4b5fd', fontWeight: 700, fontStyle: 'normal' }}>qué está pasando ahora</span>{' '}
                  — genera boletines con jerarquía: primero lo que afecta al Perú.
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>🔭</span>
                <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7, fontStyle: 'italic' }}>
                  Para buscar sismos pasados por región, fecha o magnitud, usa{' '}
                  <span style={{ color: '#06b6d4', fontWeight: 700, fontStyle: 'normal' }}>VIGÍA (IA)</span>.
                </div>
              </div>
            </div>
          </div>

          <div style={{ fontSize: 11, color: '#fbbf24', letterSpacing: 1.5, marginBottom: 10, fontWeight: 700 }}>
            CONSULTAS RÁPIDAS
          </div>
          {prompts.map((p, i) => (
            <button key={i} onClick={() => send(p)} style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '10px 14px', marginBottom: 6,
              background: '#0d1a2e', border: '1px solid #1e3a5f66',
              borderRadius: 8, color: '#cbd5e1', fontSize: 12,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
              onMouseOver={e => { e.target.style.background = '#1e3a5f44'; e.target.style.color = '#fbbf24'; }}
              onMouseOut={e  => { e.target.style.background = '#0d1a2e';   e.target.style.color = '#cbd5e1'; }}>
              ▸ {p}
            </button>
          ))}
        </div>
      )}

      {/* ── Mensajes ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: 14 }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            marginBottom: 14, padding: 14, borderRadius: 8,
            background:  m.role === 'user' ? '#1e3a5f22' : '#0d1a2e',
            borderLeft:  m.role === 'user' ? '4px solid #f59e0b' : '4px solid #8b5cf6',
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, marginBottom: 8,
              color: m.role === 'user' ? '#fbbf24' : '#a78bfa',
            }}>
              {m.role === 'user' ? 'OPERADOR' : 'ARIA'}
            </div>
            <div style={{
              fontSize: 13, color: '#e2e8f0',
              lineHeight: 1.8, whiteSpace: 'pre-wrap',
            }}>
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{
            padding: 14, borderRadius: 8,
            background: '#0d1a2e', borderLeft: '4px solid #8b5cf6',
          }}>
            <div style={{ fontSize: 13, color: '#a78bfa' }}>Analizando...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input ── */}
      <div style={{ padding: 14, borderTop: '2px solid #1e3a5f', display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && send(input)}
          placeholder="Consulta a ARIA..."
          disabled={loading}
          style={{
            flex: 1, padding: '12px 16px', borderRadius: 8,
            border: '2px solid #1e3a5f', background: '#0a1628',
            color: '#fbbf24', fontSize: 13,
            fontFamily: 'inherit', outline: 'none',
          }}
        />
        <button
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          style={{
            padding: '12px 24px', borderRadius: 8, border: 'none',
            background: loading ? '#334155' : '#6366f1',
            color: '#fff', fontSize: 13, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {loading ? '...' : 'ENVIAR'}
        </button>
      </div>
    </div>
  );
}
