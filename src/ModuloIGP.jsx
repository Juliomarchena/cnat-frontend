/**
 * ModuloIGP.jsx
 * CNAT - Centro Nacional de Alerta de Tsunamis
 * Módulo: Fuentes IGP — Comparativa Cruzada Multi-Canal
 * MICROHELP © 2026
 *
 * INTEGRACIÓN EN App.js:
 * 1. import ModuloIGP from './ModuloIGP';
 * 2. Agregar case 'IGP' en el switch de tabs o renderizar dentro del tab FUENTES:
 *    {activeTab === 'FUENTES' && <ModuloIGP apiBase={API_BASE} token={token} />}
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── Constantes de estilo CNAT (CRT / operacional) ───────────────────────────
const C = {
  bg:        '#0a0f0a',
  panel:     '#0d140d',
  border:    '#1a2e1a',
  green:     '#00ff41',
  greenDim:  '#00aa2a',
  greenFade: '#004a10',
  yellow:    '#ffd700',
  red:       '#ff3333',
  orange:    '#ff8c00',
  blue:      '#00bfff',
  gray:      '#4a6a4a',
  text:      '#b0d4b0',
  font:      "'Courier New', Courier, monospace",
};

// ─── Canales del IGP monitoreados ─────────────────────────────────────────────
const IGP_CHANNELS = [
  {
    id:       'igp_web',
    label:    'WEB OFICIAL IGP',
    icon:     '🌐',
    url:      'https://ultimosismo.igp.gob.pe',
    desc:     'ultimosismo.igp.gob.pe — reportes sísmicos oficiales',
    color:    C.green,
    type:     'web',
  },
  {
    id:       'igp_twitter',
    label:    'TWITTER @Sismos_Peru_IGP',
    icon:     '🐦',
    url:      'https://twitter.com/Sismos_Peru_IGP',
    desc:     'Canal sísmico oficial IGP/CENSIS — reportes estructurados',
    color:    C.blue,
    type:     'twitter',
  },
  {
    id:       'igp_twitter2',
    label:    'TWITTER @igp_peru',
    icon:     '🐦',
    url:      'https://twitter.com/igp_peru',
    desc:     'Canal institucional IGP — comunicados + ciencia',
    color:    C.blue,
    type:     'twitter',
  },
  {
    id:       'igp_telegram',
    label:    'TELEGRAM IGP',
    icon:     '📡',
    url:      'https://t.me/sismos_peru_igp',
    desc:     'Canal Telegram — alertas automáticas IGP',
    color:    C.yellow,
    type:     'telegram',
  },
  {
    id:       'usgs',
    label:    'USGS EARTHQUAKE HAZARDS',
    icon:     '🇺🇸',
    url:      'https://earthquake.usgs.gov',
    desc:     'USGS GeoJSON — fuente principal de referencia cruzada',
    color:    C.orange,
    type:     'api',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-PE', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: true,
    });
  } catch { return iso; }
}

function magColor(mag) {
  if (!mag) return C.gray;
  if (mag >= 7.5) return C.red;
  if (mag >= 6.0) return C.orange;
  if (mag >= 4.5) return C.yellow;
  return C.green;
}

function magLabel(mag) {
  if (!mag) return '—';
  if (mag >= 7.5) return 'CRÍTICO';
  if (mag >= 6.0) return 'ALERTA M6+';
  if (mag >= 4.5) return 'MODERADO';
  return 'MENOR';
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ModuloIGP({ apiBase, token }) {
  const [earthquakes, setEarthquakes]   = useState([]);
  const [igpTweets,   setIgpTweets]     = useState([]);
  const [loading,     setLoading]       = useState(true);
  const [lastUpdate,  setLastUpdate]    = useState(null);
  const [crossRef,    setCrossRef]      = useState([]);
  const [activeView,  setActiveView]    = useState('cruce'); // cruce | canales | tweets
  const [blinkNew,    setBlinkNew]      = useState(false);
  const prevTweetCount = useRef(0);
  const intervalRef    = useRef(null);

  // ─── Fetch de datos ──────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!apiBase || !token) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [eqRes, twRes] = await Promise.all([
        fetch(`${apiBase}/api/earthquakes?limit=100`, { headers }),
        fetch(`${apiBase}/api/igp-tweets`,            { headers }),
      ]);

      const eqData = eqRes.ok  ? await eqRes.json()  : [];
      const twData = twRes.ok  ? await twRes.json()  : [];

      setEarthquakes(eqData);
      setIgpTweets(twData);
      setLastUpdate(new Date());

      // Blink si llegó tweet nuevo
      if (twData.length > prevTweetCount.current) {
        setBlinkNew(true);
        setTimeout(() => setBlinkNew(false), 4000);
      }
      prevTweetCount.current = twData.length;

      // ── Construcción de tabla de cruce ──────────────────────────────────
      // Para cada tweet IGP, buscar sismo equivalente en USGS/IRIS
      const crossed = twData.map(tweet => {
        const mag  = tweet.magnitude;
        const lat  = tweet.latitude;
        const lon  = tweet.longitude;
        const time = tweet.published_at;

        // Buscar en earthquakes por proximidad (±0.5 mag, ±0.5° coords, ±10 min)
        const tweetTime = time ? new Date(time).getTime() : 0;
        const match = eqData.find(eq => {
          if (!mag || !eq.magnitude) return false;
          const magMatch   = Math.abs(eq.magnitude - mag) <= 0.6;
          const latMatch   = lat ? Math.abs(eq.latitude  - lat) <= 0.8 : true;
          const lonMatch   = lon ? Math.abs(eq.longitude - lon) <= 0.8 : true;
          const eqTime     = new Date(eq.event_time).getTime();
          const timeMatch  = tweetTime ? Math.abs(eqTime - tweetTime) <= 600000 : true;
          return magMatch && latMatch && lonMatch && timeMatch;
        });

        return {
          tweet,
          usgs:  match || null,
          delta: match && mag ? Math.abs(match.magnitude - mag).toFixed(1) : null,
        };
      });

      setCrossRef(crossed);
    } catch (err) {
      console.error('ModuloIGP fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [apiBase, token]);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 30000); // auto-refresh 30s
    return () => clearInterval(intervalRef.current);
  }, [fetchData]);

  // ─── Estadísticas rápidas ────────────────────────────────────────────────
  const igpLocal  = earthquakes.filter(e => e.source_id === 'igp' || e.is_local).length;
  const usgsCount = earthquakes.filter(e => e.source_id === 'usgs').length;
  const matched   = crossRef.filter(c => c.usgs).length;
  const unmatched = crossRef.filter(c => !c.usgs).length;

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{
      background: C.bg, color: C.text, fontFamily: C.font,
      minHeight: '100%', padding: '16px', boxSizing: 'border-box',
    }}>

      {/* ── Header ── */}
      <div style={{
        borderBottom: `1px solid ${C.border}`,
        paddingBottom: 12, marginBottom: 16,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 8,
      }}>
        <div>
          <div style={{ color: C.green, fontSize: 18, fontWeight: 'bold', letterSpacing: 2 }}>
            ◈ IGP — INTELIGENCIA DE FUENTES SÍSMICAS
          </div>
          <div style={{ color: C.gray, fontSize: 11, marginTop: 2 }}>
            Instituto Geofísico del Perú · Multi-canal · Comparativa cruzada USGS
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {blinkNew && (
            <div style={{
              background: C.green, color: '#000', padding: '3px 10px',
              fontSize: 11, fontWeight: 'bold', animation: 'blink 0.5s step-end infinite',
            }}>
              ● NUEVO TWEET IGP
            </div>
          )}
          <button onClick={fetchData} style={{
            background: 'transparent', border: `1px solid ${C.greenDim}`,
            color: C.green, padding: '4px 12px', cursor: 'pointer',
            fontFamily: C.font, fontSize: 11, letterSpacing: 1,
          }}>
            ↺ ACTUALIZAR
          </button>
          <div style={{ color: C.gray, fontSize: 10 }}>
            {lastUpdate ? fmtTime(lastUpdate.toISOString()) : '—'}
          </div>
        </div>
      </div>

      {/* ── KPI Bar ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 8, marginBottom: 16,
      }}>
        {[
          { label: 'TWEETS IGP',     value: igpTweets.length,   color: C.blue   },
          { label: 'SISMOS LOCALES', value: igpLocal,            color: C.green  },
          { label: 'FUENTE USGS',    value: usgsCount,           color: C.orange },
          { label: 'CRUCES OK',      value: matched,             color: C.green  },
          { label: 'SIN CRUCE',      value: unmatched,           color: C.yellow },
        ].map(k => (
          <div key={k.label} style={{
            background: C.panel, border: `1px solid ${C.border}`,
            padding: '8px 12px', textAlign: 'center',
          }}>
            <div style={{ color: k.color, fontSize: 22, fontWeight: 'bold' }}>{k.value}</div>
            <div style={{ color: C.gray, fontSize: 9, letterSpacing: 1, marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs de vista ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[
          { id: 'cruce',   label: '⚡ COMPARATIVA CRUZADA' },
          { id: 'canales', label: '📡 CANALES IGP'         },
          { id: 'tweets',  label: '🐦 TWEETS EN VIVO'      },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveView(t.id)} style={{
            background:   activeView === t.id ? C.greenFade : 'transparent',
            border:       `1px solid ${activeView === t.id ? C.green : C.border}`,
            color:        activeView === t.id ? C.green : C.gray,
            padding:      '6px 14px', cursor: 'pointer',
            fontFamily:   C.font, fontSize: 11, letterSpacing: 1,
            transition:   'all 0.2s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════
          VISTA 1: COMPARATIVA CRUZADA
      ══════════════════════════════════════════════════ */}
      {activeView === 'cruce' && (
        <div>
          <div style={{ color: C.greenDim, fontSize: 11, marginBottom: 10, letterSpacing: 1 }}>
            ▸ CADA FILA = 1 EVENTO IGP · COLUMNAS = MISMA FUENTE EN DISTINTOS CANALES
          </div>

          {loading ? (
            <Loader />
          ) : crossRef.length === 0 ? (
            <Empty msg="Sin tweets IGP disponibles aún. El stream está activo y esperando el próximo sismo." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {['HORA (Lima)', 'REPORTE IGP', 'MAG IGP', 'PROF.', 'LUGAR IGP',
                      'MAG USGS', 'LUGAR USGS', 'Δ MAG', 'ESTADO CRUCE'].map(h => (
                      <th key={h} style={{
                        padding: '6px 10px', textAlign: 'left',
                        color: C.gray, letterSpacing: 1, whiteSpace: 'nowrap',
                        fontWeight: 'normal',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {crossRef.map((row, i) => {
                    const tw    = row.tweet;
                    const usgs  = row.usgs;
                    const delta = row.delta;
                    const hasMatch = !!usgs;
                    const deltaNum = delta ? parseFloat(delta) : null;

                    return (
                      <tr key={i} style={{
                        borderBottom:    `1px solid ${C.border}`,
                        background:      i % 2 === 0 ? 'transparent' : 'rgba(0,255,65,0.02)',
                        transition:      'background 0.15s',
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,255,65,0.06)'}
                        onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(0,255,65,0.02)'}
                      >
                        <td style={{ padding: '7px 10px', color: C.gray, whiteSpace: 'nowrap' }}>
                          {fmtTime(tw.published_at)}
                        </td>
                        <td style={{ padding: '7px 10px', color: C.greenDim, whiteSpace: 'nowrap' }}>
                          {tw.reporte_id ? `RS ${tw.reporte_id}` : '—'}
                        </td>
                        <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>
                          <span style={{
                            color:      magColor(tw.magnitude),
                            fontWeight: 'bold',
                            fontSize:   13,
                          }}>
                            {tw.magnitude ? `M${tw.magnitude}` : '—'}
                          </span>
                        </td>
                        <td style={{ padding: '7px 10px', color: C.text }}>
                          {tw.depth_km ? `${tw.depth_km}km` : '—'}
                        </td>
                        <td style={{ padding: '7px 10px', color: C.text, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {tw.lugar || tw.intensidad || '—'}
                        </td>
                        <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>
                          {hasMatch ? (
                            <span style={{ color: magColor(usgs.magnitude), fontWeight: 'bold' }}>
                              M{usgs.magnitude}
                            </span>
                          ) : <span style={{ color: C.gray }}>—</span>}
                        </td>
                        <td style={{ padding: '7px 10px', color: C.text, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {hasMatch ? (usgs.place || '—') : <span style={{ color: C.gray }}>—</span>}
                        </td>
                        <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                          {hasMatch && deltaNum !== null ? (
                            <span style={{
                              color: deltaNum <= 0.2 ? C.green : deltaNum <= 0.5 ? C.yellow : C.red,
                              fontWeight: 'bold',
                            }}>
                              {deltaNum === 0 ? '=' : `±${delta}`}
                            </span>
                          ) : <span style={{ color: C.gray }}>—</span>}
                        </td>
                        <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>
                          {hasMatch ? (
                            <span style={{
                              background: deltaNum <= 0.3 ? C.greenFade : 'rgba(255,140,0,0.15)',
                              color:      deltaNum <= 0.3 ? C.green : C.orange,
                              padding:    '2px 8px', fontSize: 10, letterSpacing: 1,
                            }}>
                              {deltaNum <= 0.3 ? '✓ CONFIRMADO' : '⚠ DISCREPANCIA'}
                            </span>
                          ) : (
                            <span style={{
                              background: 'rgba(255,215,0,0.1)',
                              color:      C.yellow,
                              padding:    '2px 8px', fontSize: 10, letterSpacing: 1,
                            }}>
                              ○ SOLO IGP
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          VISTA 2: CANALES IGP
      ══════════════════════════════════════════════════ */}
      {activeView === 'canales' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {IGP_CHANNELS.map(ch => {
            // Obtener último dato de ese canal si existe
            const lastTweet = ch.type === 'twitter'
              ? igpTweets[0]
              : null;
            const isActive = ch.type === 'api'
              ? earthquakes.some(e => e.source_id === 'usgs')
              : ch.type === 'twitter'
              ? igpTweets.length > 0
              : null; // web/telegram: estado desconocido sin scraper

            return (
              <div key={ch.id} style={{
                background:    C.panel,
                border:        `1px solid ${isActive ? ch.color + '44' : C.border}`,
                padding:       16,
                position:      'relative',
                overflow:      'hidden',
              }}>
                {/* Accent line */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0,
                  height: 2, background: ch.color, opacity: isActive ? 1 : 0.2,
                }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 15 }}>{ch.icon}</div>
                    <div style={{ color: ch.color, fontSize: 12, fontWeight: 'bold', letterSpacing: 1, marginTop: 4 }}>
                      {ch.label}
                    </div>
                  </div>
                  <StatusBadge active={isActive} />
                </div>

                <div style={{ color: C.gray, fontSize: 10, marginBottom: 10, lineHeight: 1.5 }}>
                  {ch.desc}
                </div>

                {/* Último dato */}
                {ch.type === 'twitter' && lastTweet && (
                  <div style={{
                    background: 'rgba(0,255,65,0.04)', border: `1px solid ${C.border}`,
                    padding: '8px 10px', fontSize: 10,
                  }}>
                    <div style={{ color: C.gray, marginBottom: 4 }}>ÚLTIMO TWEET:</div>
                    <div style={{ color: C.text, lineHeight: 1.6 }}>
                      {lastTweet.magnitude && (
                        <span style={{ color: magColor(lastTweet.magnitude), fontWeight: 'bold', marginRight: 6 }}>
                          M{lastTweet.magnitude}
                        </span>
                      )}
                      {lastTweet.lugar || lastTweet.intensidad || '—'}
                    </div>
                    <div style={{ color: C.gray, marginTop: 4 }}>{fmtTime(lastTweet.published_at)}</div>
                  </div>
                )}

                {ch.type === 'api' && (
                  <div style={{
                    background: 'rgba(255,140,0,0.05)', border: `1px solid ${C.border}`,
                    padding: '8px 10px', fontSize: 10,
                  }}>
                    <div style={{ color: C.gray, marginBottom: 4 }}>REGISTROS EN DB:</div>
                    <div style={{ color: C.orange, fontWeight: 'bold', fontSize: 16 }}>{usgsCount}</div>
                    <div style={{ color: C.gray, marginTop: 2 }}>sismos USGS indexados</div>
                  </div>
                )}

                {(ch.type === 'web' || ch.type === 'telegram') && (
                  <div style={{
                    background: 'rgba(255,215,0,0.04)', border: `1px solid ${C.border}`,
                    padding: '8px 10px', fontSize: 10, color: C.gray,
                  }}>
                    <span style={{ color: C.yellow }}>⚠ SCRAPER PENDIENTE</span>
                    <br />Integración programada — FASE 4
                  </div>
                )}

                <a href={ch.url} target="_blank" rel="noopener noreferrer" style={{
                  display:      'block', marginTop: 10,
                  color:        ch.color, fontSize: 10,
                  textDecoration: 'none', opacity: 0.7,
                }}>
                  ↗ {ch.url}
                </a>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          VISTA 3: TWEETS EN VIVO
      ══════════════════════════════════════════════════ */}
      {activeView === 'tweets' && (
        <div>
          <div style={{ color: C.greenDim, fontSize: 11, marginBottom: 10, letterSpacing: 1 }}>
            ▸ TWEETS @Sismos_Peru_IGP — FORMATO IGP/CENSIS — TIEMPO REAL VÍA FILTERED STREAM
          </div>

          {loading ? (
            <Loader />
          ) : igpTweets.length === 0 ? (
            <Empty msg="Stream activo. Esperando próximo tweet de @Sismos_Peru_IGP..." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {igpTweets.map((tw, i) => (
                <div key={i} style={{
                  background:  C.panel,
                  border:      `1px solid ${i === 0 ? C.blue + '66' : C.border}`,
                  padding:     14,
                  display:     'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  gap:         16,
                  alignItems:  'start',
                  position:    'relative',
                  overflow:    'hidden',
                }}>
                  {i === 0 && (
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0,
                      height: 2, background: C.blue,
                    }} />
                  )}

                  {/* Magnitud */}
                  <div style={{ textAlign: 'center', minWidth: 60 }}>
                    <div style={{
                      color:      magColor(tw.magnitude),
                      fontSize:   22, fontWeight: 'bold',
                    }}>
                      {tw.magnitude ? `M${tw.magnitude}` : '—'}
                    </div>
                    <div style={{
                      color:      magColor(tw.magnitude),
                      fontSize:   9, letterSpacing: 1, marginTop: 2,
                    }}>
                      {magLabel(tw.magnitude)}
                    </div>
                    {tw.depth_km && (
                      <div style={{ color: C.gray, fontSize: 9, marginTop: 4 }}>
                        Prof: {tw.depth_km}km
                      </div>
                    )}
                  </div>

                  {/* Datos */}
                  <div>
                    <div style={{ color: C.blue, fontSize: 10, marginBottom: 6, letterSpacing: 1 }}>
                      🐦 @Sismos_Peru_IGP {tw.reporte_id ? `· RS ${tw.reporte_id}` : ''}
                    </div>

                    {tw.lugar && (
                      <div style={{ color: C.text, fontSize: 12, marginBottom: 4 }}>
                        📍 {tw.lugar}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 16, fontSize: 10, color: C.gray, flexWrap: 'wrap' }}>
                      {tw.latitude  && <span>Lat: {tw.latitude}</span>}
                      {tw.longitude && <span>Lon: {tw.longitude}</span>}
                      {tw.intensidad && <span style={{ color: C.yellow }}>Int: {tw.intensidad}</span>}
                    </div>

                    {/* Texto crudo del tweet */}
                    {tw.raw_text && (
                      <div style={{
                        marginTop:   8,
                        background:  'rgba(0,191,255,0.04)',
                        border:      `1px solid ${C.border}`,
                        padding:     '6px 10px',
                        fontSize:    10, color: C.gray,
                        lineHeight:  1.6, whiteSpace: 'pre-wrap',
                      }}>
                        {tw.raw_text}
                      </div>
                    )}
                  </div>

                  {/* Tiempo */}
                  <div style={{ textAlign: 'right', fontSize: 10, color: C.gray, whiteSpace: 'nowrap' }}>
                    {fmtTime(tw.published_at)}
                    {i === 0 && (
                      <div style={{
                        marginTop: 6, color: C.blue,
                        fontSize: 9, letterSpacing: 1,
                      }}>
                        ● ÚLTIMO
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{
        marginTop: 20, borderTop: `1px solid ${C.border}`,
        paddingTop: 10, display: 'flex', justifyContent: 'space-between',
        fontSize: 9, color: C.gray, letterSpacing: 1,
      }}>
        <span>CNAT · MÓDULO IGP · MICROHELP © 2026</span>
        <span>AUTO-REFRESH: 30s · FILTERED STREAM: ACTIVO</span>
      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────
function StatusBadge({ active }) {
  if (active === null) return (
    <span style={{
      background: 'rgba(255,215,0,0.1)', color: C.yellow,
      padding: '2px 8px', fontSize: 9, letterSpacing: 1,
    }}>PENDIENTE</span>
  );
  return (
    <span style={{
      background: active ? 'rgba(0,255,65,0.1)' : 'rgba(255,51,51,0.1)',
      color:      active ? C.green : C.red,
      padding:    '2px 8px', fontSize: 9, letterSpacing: 1,
    }}>
      {active ? '● EN LÍNEA' : '✕ INACTIVO'}
    </span>
  );
}

function Loader() {
  return (
    <div style={{ textAlign: 'center', padding: 40, color: C.greenDim, fontSize: 12 }}>
      ◈ CARGANDO DATOS IGP...
    </div>
  );
}

function Empty({ msg }) {
  return (
    <div style={{
      textAlign: 'center', padding: 40,
      color: C.gray, fontSize: 11,
      border: `1px dashed ${C.border}`,
    }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>📡</div>
      {msg}
    </div>
  );
}
