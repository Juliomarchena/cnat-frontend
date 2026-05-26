import React, { useState, useEffect, useRef } from 'react';

/**
 * PanelIGP.jsx
 * Panel de tweets sísmicos del IGP/CENSIS
 * Marina de Guerra del Perú | MICROHELP © 2026
 *
 * - Muestra últimos tweets del IGP con efecto blink
 * - Ventana emergente (popup) cuando llega tweet nuevo
 * - Se cierra solo después de 10 segundos
 * - Estilo CRT coherente con el resto del sistema
 *
 * USO en App.js:
 *   import PanelIGP from './PanelIGP';
 *   <PanelIGP tweets={data?.igp_tweets || []} />
 */

export default function PanelIGP({ tweets = [] }) {
  const [popup,       setPopup]       = useState(null);
  const [popupVisible,setPopupVisible]= useState(false);
  const prevCountRef  = useRef(0);
  const popupTimer    = useRef(null);

  // ── Detecta tweet nuevo y dispara popup ──
  useEffect(() => {
    if (!tweets.length) return;
    if (tweets.length > prevCountRef.current) {
      const newest = tweets[0];
      setPopup(newest);
      setPopupVisible(true);
      if (popupTimer.current) clearTimeout(popupTimer.current);
      popupTimer.current = setTimeout(() => setPopupVisible(false), 10000);
    }
    prevCountRef.current = tweets.length;
    return () => { if (popupTimer.current) clearTimeout(popupTimer.current); };
  }, [tweets]);

  // ── Color según magnitud ──
  const magColor = mag => {
    if (!mag) return '#64748b';
    if (mag >= 7.0) return '#ef4444';
    if (mag >= 6.0) return '#f59e0b';
    if (mag >= 5.0) return '#fb923c';
    return '#22c55e';
  };

  // ── Formatea hora del tweet ──
  const fmtHora = iso => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  if (!tweets.length) return null;

  return (
    <>
      <style>{`
        @keyframes blink    { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes igp-slide { from{transform:translateY(-20px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes igp-pulse { 0%,100%{box-shadow:0 0 0 0 #ef444488} 50%{box-shadow:0 0 0 8px #ef444400} }
      `}</style>

      {/* ── Panel principal ── */}
      <div style={{
        margin:       '8px 0 0 0',
        background:   '#0a0a0a',
        border:       '1px solid #ef444433',
        borderRadius: 6,
        overflow:     'hidden',
      }}>
        {/* Header */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '6px 10px',
          background:     '#0d0d0d',
          borderBottom:   '1px solid #ef444422',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:10, color:'#ef4444', fontWeight:700, letterSpacing:2, fontFamily:"'Courier New'" }}>
              🐦 IGP::CENSIS
            </span>
            <div style={{
              width:6, height:6, borderRadius:'50%',
              background:'#ef4444',
              animation:'blink 1.5s infinite',
              boxShadow:'0 0 4px #ef4444',
            }}/>
          </div>
          <span style={{ fontSize:8, color:'#ef444466', fontFamily:"'Courier New'" }}>
            @Sismos_Peru_IGP
          </span>
        </div>

        {/* Lista de tweets */}
        <div style={{ maxHeight: 180, overflowY: 'auto' }}>
          {tweets.slice(0, 5).map((t, i) => (
            <div key={t.id || i} style={{
              padding:      '7px 10px',
              borderBottom: '1px solid #1e1e1e',
              background:   i === 0 ? '#1a0505' : 'transparent',
              animation:    i === 0 ? 'igp-slide 0.4s ease' : 'none',
            }}>
              {/* Fila magnitud + hora */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  {t.magnitude && (
                    <span style={{
                      fontSize:     13,
                      fontWeight:   700,
                      color:        magColor(t.magnitude),
                      fontFamily:   "'Orbitron'",
                      animation:    i === 0 ? 'blink 0.8s 3' : 'none',
                    }}>
                      M{t.magnitude}
                    </span>
                  )}
                  {t.depth_km && (
                    <span style={{ fontSize:9, color:'#8b5cf6' }}>
                      {t.depth_km}km prof.
                    </span>
                  )}
                </div>
                <span style={{ fontSize:8, color:'#475569', fontFamily:"'Courier New'" }}>
                  {fmtHora(t.published_at)}
                </span>
              </div>

              {/* Lugar */}
              {t.lugar && (
                <div style={{ fontSize:9, color:'#cbd5e1', marginBottom:2, lineHeight:1.4 }}>
                  📍 {t.lugar}
                </div>
              )}

              {/* Intensidad */}
              {t.intensidad && (
                <div style={{ fontSize:9, color:'#fbbf24' }}>
                  Int: {t.intensidad}
                </div>
              )}

              {/* Reporte ID */}
              {t.reporte_id && (
                <div style={{ fontSize:8, color:'#334155', marginTop:2, fontFamily:"'Courier New'" }}>
                  RS {t.reporte_id}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding:      '4px 10px',
          background:   '#0d0d0d',
          borderTop:    '1px solid #1e1e1e',
          fontSize:     8,
          color:        '#ef444444',
          fontFamily:   "'Courier New'",
          textAlign:    'center',
        }}>
          FILTERED STREAM · TIEMPO REAL · ~$1.50/MES
        </div>
      </div>

      {/* ── Popup emergente ── */}
      {popupVisible && popup && (
        <div style={{
          position:     'fixed',
          top:          80,
          right:        20,
          zIndex:       9999,
          width:        320,
          background:   '#0a0000',
          border:       `2px solid ${magColor(popup.magnitude)}`,
          borderRadius: 10,
          padding:      16,
          boxShadow:    `0 0 30px ${magColor(popup.magnitude)}66`,
          animation:    'igp-slide 0.4s ease, igp-pulse 1s 3',
        }}>
          {/* Header popup */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{
                width:10, height:10, borderRadius:'50%',
                background: magColor(popup.magnitude),
                animation: 'blink 0.5s infinite',
                boxShadow: `0 0 8px ${magColor(popup.magnitude)}`,
              }}/>
              <span style={{
                fontSize:    12,
                fontWeight:  700,
                color:       '#ef4444',
                letterSpacing: 2,
                fontFamily:  "'Courier New'",
              }}>
                🚨 IGP — SISMO DETECTADO
              </span>
            </div>
            <button
              onClick={() => setPopupVisible(false)}
              style={{
                background: 'transparent',
                border:     'none',
                color:      '#64748b',
                fontSize:   16,
                cursor:     'pointer',
                lineHeight: 1,
              }}
            >✕</button>
          </div>

          {/* Magnitud grande */}
          {popup.magnitude && (
            <div style={{
              fontSize:   32,
              fontWeight: 700,
              color:      magColor(popup.magnitude),
              fontFamily: "'Orbitron'",
              textAlign:  'center',
              marginBottom: 8,
              textShadow: `0 0 20px ${magColor(popup.magnitude)}`,
              animation:  'blink 0.6s 4',
            }}>
              M{popup.magnitude}
            </div>
          )}

          {/* Datos */}
          <div style={{ fontSize:12, color:'#e2e8f0', lineHeight:1.8 }}>
            {popup.lugar && <div>📍 {popup.lugar}</div>}
            {popup.depth_km && <div style={{ color:'#8b5cf6' }}>⬇ Profundidad: {popup.depth_km} km</div>}
            {popup.intensidad && <div style={{ color:'#fbbf24' }}>📊 Intensidad: {popup.intensidad}</div>}
            {popup.reporte_id && (
              <div style={{ fontSize:9, color:'#475569', fontFamily:"'Courier New'", marginTop:4 }}>
                IGP/CENSIS/RS {popup.reporte_id}
              </div>
            )}
          </div>

          {/* Hora */}
          <div style={{
            marginTop:  10,
            paddingTop: 8,
            borderTop:  '1px solid #1e1e1e',
            fontSize:   9,
            color:      '#475569',
            fontFamily: "'Courier New'",
            display:    'flex',
            justifyContent: 'space-between',
          }}>
            <span>@Sismos_Peru_IGP</span>
            <span>{fmtHora(popup.published_at)}</span>
          </div>

          {/* Barra de cierre automático */}
          <div style={{
            marginTop:    8,
            height:       2,
            background:   '#1e1e1e',
            borderRadius: 2,
            overflow:     'hidden',
          }}>
            <div style={{
              height:     '100%',
              background: magColor(popup.magnitude),
              animation:  'igp-close 10s linear forwards',
              width:      '100%',
            }}/>
          </div>
          <style>{`
            @keyframes igp-close {
              from { width: 100%; }
              to   { width: 0%; }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
