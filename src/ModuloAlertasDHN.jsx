import React, { useState, useMemo } from 'react';

/* ════════════════════════════════════════════════════════════
   ModuloAlertasDHN.jsx
   Centro de comando de alertas según matriz oficial DHN.
   Recibe del padre (App.js): earthquakes, alerts, kpis
   
   FASE 3.2 - 20/05/2026
   MICROHELP para DHN - Marina de Guerra del Perú
   ════════════════════════════════════════════════════════════ */

const DHN_COLORS = {
  ALARMA:      '#ef4444',
  ALERTA:      '#f59e0b',
  INFORMACION: '#3b82f6',
  NO_APLICA:   '#64748b',
};

const DHN_LABELS = {
  ALARMA:      'ALARMA',
  ALERTA:      'ALERTA',
  INFORMACION: 'INFORMACIÓN',
  NO_APLICA:   'SIN CLASIFICAR',
};

const DHN_DESCRIPTIONS = {
  ALARMA:      'Generación de tsunami confirmada — activar evacuación inmediata',
  ALERTA:      'Probabilidad de generación de tsunami — preparar protocolos de evacuación',
  INFORMACION: 'Evento registrado — sin potencial tsunamigénico',
  NO_APLICA:   'Sin clasificación DHN asignada',
};

const dhnColor = (level) => DHN_COLORS[level] || DHN_COLORS.NO_APLICA;

const timeSince = (date) => {
  if (!date) return 'N/A';
  const minutes = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (minutes < 1) return 'hace unos segundos';
  if (minutes < 60) return `hace ${minutes} min`;
  if (minutes < 1440) return `hace ${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `hace ${Math.floor(minutes / 1440)} días`;
};

/* ─────────────────────────────────────────────────────────────
   MODAL DE DETALLE DE SISMO
   ───────────────────────────────────────────────────────────── */
function EarthquakeModal({ eq, onClose }) {
  if (!eq) return null;
  const level = eq.dhn_level || 'NO_APLICA';
  const color = dhnColor(level);
  const isLocal = eq.is_local === true;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.8)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#0a1628',
          border: `2px solid ${color}66`,
          borderRadius: 12,
          padding: 24,
          maxWidth: 560,
          width: '100%',
          boxShadow: `0 0 40px ${color}33`,
          position: 'relative',
        }}
      >
        {/* Barra superior de color */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: 4, background: color, borderRadius: '12px 12px 0 0',
        }} />

        {/* Botón cerrar */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 12, right: 12,
            background: 'transparent',
            border: '1px solid #1e3a5f',
            color: '#94a3b8',
            borderRadius: 6,
            padding: '4px 10px',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          ✕ CERRAR
        </button>

        {/* Título */}
        <div style={{ marginBottom: 16, paddingTop: 8 }}>
          <div style={{ fontSize: 11, color: '#64748b', letterSpacing: 2, marginBottom: 4 }}>
            REPORTE OFICIAL DHN
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              fontSize: 36, fontWeight: 700, color,
              fontFamily: "'Orbitron', monospace",
            }}>
              M{eq.magnitude?.toFixed(1) || '?'}
            </div>
            <div>
              <div style={{
                padding: '4px 12px',
                background: `${color}22`,
                border: `1px solid ${color}66`,
                borderRadius: 4,
                fontSize: 12, fontWeight: 700, color, letterSpacing: 1,
              }}>
                {DHN_LABELS[level]}
              </div>
              {isLocal && (
                <div style={{
                  marginTop: 4,
                  padding: '2px 8px',
                  background: '#fbbf2422',
                  border: '1px solid #fbbf2466',
                  borderRadius: 4,
                  fontSize: 10, fontWeight: 700, color: '#fbbf24',
                }}>
                  🇵🇪 EVENTO LOCAL — TERRITORIO PERUANO
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Ubicación */}
        <div style={{
          padding: '10px 14px',
          background: '#070e1f',
          borderRadius: 6,
          marginBottom: 12,
          fontSize: 13, color: '#e2e8f0',
        }}>
          📍 {eq.place || 'Ubicación no disponible'}
        </div>

        {/* Grid de datos técnicos */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          marginBottom: 12,
        }}>
          {[
            { label: 'MAGNITUD',     value: `M${eq.magnitude?.toFixed(1) || '?'}` },
            { label: 'PROFUNDIDAD',  value: `${eq.depth_km?.toFixed(1) || '?'} km` },
            { label: 'LATITUD',      value: eq.latitude?.toFixed(4) || 'N/A' },
            { label: 'LONGITUD',     value: eq.longitude?.toFixed(4) || 'N/A' },
            { label: 'FUENTE',       value: (eq.source_id || 'N/A').toUpperCase() },
            { label: 'TERRITORIO',   value: isLocal ? '🇵🇪 Perú' : 'Internacional' },
          ].map((item) => (
            <div key={item.label} style={{
              padding: '8px 12px',
              background: '#070e1f',
              border: '1px solid #1e3a5f',
              borderRadius: 6,
            }}>
              <div style={{ fontSize: 9, color: '#64748b', letterSpacing: 1, marginBottom: 2 }}>
                {item.label}
              </div>
              <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        {/* Fecha y hora */}
        <div style={{
          padding: '8px 14px',
          background: '#070e1f',
          borderRadius: 6,
          marginBottom: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 9, color: '#64748b', letterSpacing: 1 }}>FECHA Y HORA (UTC)</div>
            <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>
              {new Date(eq.event_time).toLocaleString('es-PE', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
              })}
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>
            {timeSince(eq.event_time)}
          </div>
        </div>

        {/* Análisis DHN */}
        {eq.dhn_reason && (
          <div style={{
            padding: '12px 14px',
            background: `${color}11`,
            border: `1px solid ${color}44`,
            borderLeft: `4px solid ${color}`,
            borderRadius: 6,
            marginBottom: 12,
          }}>
            <div style={{ fontSize: 10, color, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
              ⚡ ANÁLISIS MATRIZ OFICIAL DHN
            </div>
            <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.6 }}>
              {eq.dhn_reason}
            </div>
          </div>
        )}

        {/* Descripción del nivel */}
        <div style={{
          padding: '8px 14px',
          background: '#070e1f',
          border: '1px solid #1e3a5f33',
          borderRadius: 6,
          fontSize: 11, color: '#64748b', textAlign: 'center',
          fontStyle: 'italic',
        }}>
          {DHN_DESCRIPTIONS[level]}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   TARJETA INDIVIDUAL DE SISMO
   ───────────────────────────────────────────────────────────── */
function EarthquakeCard({ eq, highlighted = false, onClick }) {
  const level = eq.dhn_level || 'NO_APLICA';
  const color = dhnColor(level);
  const isLocal = eq.is_local === true;

  return (
    <div
      onClick={() => onClick(eq)}
      style={{
        background: highlighted ? `${color}11` : '#0d1a2e',
        border: `1px solid ${color}33`,
        borderLeft: `4px solid ${color}`,
        borderRadius: 8,
        padding: 14,
        marginBottom: 8,
        transition: 'all 0.2s',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `${color}18`;
        e.currentTarget.style.borderColor = `${color}66`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = highlighted ? `${color}11` : '#0d1a2e';
        e.currentTarget.style.borderColor = `${color}33`;
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            fontSize: 24, fontWeight: 700, color,
            fontFamily: "'Orbitron', monospace", lineHeight: 1,
          }}>
            M{eq.magnitude?.toFixed(1) || '?'}
          </div>
          <div style={{
            padding: '4px 10px',
            background: `${color}22`,
            border: `1px solid ${color}66`,
            borderRadius: 4,
            fontSize: 11, fontWeight: 700, color, letterSpacing: 1,
          }}>
            {DHN_LABELS[level]}
          </div>
          {isLocal && (
            <div style={{
              padding: '4px 8px',
              background: '#fbbf2422',
              border: '1px solid #fbbf2466',
              borderRadius: 4,
              fontSize: 10, fontWeight: 700, color: '#fbbf24', letterSpacing: 1,
            }}>
              🇵🇪 PERÚ
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 10, color: '#94a3b8', textAlign: 'right' }}>
            <div>{timeSince(eq.event_time)}</div>
            <div style={{ marginTop: 2, color: '#64748b' }}>
              {new Date(eq.event_time).toLocaleString('es-PE', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
              })}
            </div>
          </div>
          <div style={{ fontSize: 10, color: color, opacity: 0.7 }}>▶</div>
        </div>
      </div>

      <div style={{ fontSize: 13, color: '#e2e8f0', marginBottom: 6 }}>
        📍 {eq.place || 'Ubicación no disponible'}
      </div>

      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>
        <span>Prof: <b style={{ color: '#e2e8f0' }}>{eq.depth_km?.toFixed(1) || '?'} km</b></span>
        <span>Coords: <b style={{ color: '#e2e8f0' }}>{eq.latitude?.toFixed(2)}, {eq.longitude?.toFixed(2)}</b></span>
        <span>Fuente: <b style={{ color: '#e2e8f0' }}>{(eq.source_id || 'N/A').toUpperCase()}</b></span>
      </div>

      {eq.dhn_reason && (
        <div style={{
          padding: '8px 12px',
          background: '#070e1f',
          borderRadius: 4,
          fontSize: 11, color: '#cbd5e1', lineHeight: 1.5,
          fontStyle: 'italic',
          borderLeft: `2px solid ${color}66`,
        }}>
          <span style={{ color: '#fbbf24', fontWeight: 700, fontStyle: 'normal' }}>Análisis DHN: </span>
          {eq.dhn_reason}
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 10, color: `${color}88`, textAlign: 'right' }}>
        clic para ver reporte completo →
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   SECCIÓN POR NIVEL DHN
   ───────────────────────────────────────────────────────────── */
function LevelSection({ level, earthquakes, defaultOpen = true, onCardClick }) {
  const [open, setOpen] = useState(defaultOpen);
  const color = dhnColor(level);
  const count = earthquakes.length;

  if (count === 0) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 14px',
          background: `${color}11`,
          border: `1px solid ${color}44`,
          borderRadius: 6,
          cursor: 'pointer',
          marginBottom: open ? 8 : 0,
          transition: 'background 0.2s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, color, fontWeight: 700 }}>{open ? '▼' : '▶'}</span>
          <div style={{
            width: 14, height: 14, borderRadius: '50%',
            background: color, boxShadow: `0 0 8px ${color}88`,
          }} />
          <span style={{
            fontSize: 14, fontWeight: 700, color,
            letterSpacing: 2, fontFamily: "'JetBrains Mono', monospace",
          }}>
            {DHN_LABELS[level]}
          </span>
          <span style={{
            padding: '2px 10px', background: color, color: '#fff',
            borderRadius: 12, fontSize: 12, fontWeight: 700,
            minWidth: 24, textAlign: 'center',
          }}>
            {count}
          </span>
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
          {DHN_DESCRIPTIONS[level]}
        </div>
      </div>

      {open && (
        <div>
          {earthquakes.map((eq) => (
            <EarthquakeCard key={eq.id} eq={eq} onClick={onCardClick} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   COMPONENTE PRINCIPAL
   ───────────────────────────────────────────────────────────── */
export default function ModuloAlertasDHN({ earthquakes = [], alerts = [], kpis = {} }) {
  const [selectedEq, setSelectedEq] = useState(null);
  const [listModal, setListModal] = useState(null); // { title, color, items }

  const grouped = useMemo(() => {
    const result = { ALARMA: [], ALERTA: [], INFORMACION: [], NO_APLICA: [] };
    earthquakes.forEach((eq) => {
      const level = eq.dhn_level || 'NO_APLICA';
      if (result[level]) result[level].push(eq);
      else result.NO_APLICA.push(eq);
    });
    Object.keys(result).forEach((k) => {
      result[k].sort((a, b) => new Date(b.event_time) - new Date(a.event_time));
    });
    return result;
  }, [earthquakes]);

  const localQuakes = useMemo(
    () => earthquakes
      .filter((eq) => eq.is_local === true)
      .sort((a, b) => new Date(b.event_time) - new Date(a.event_time))
      .slice(0, 5),
    [earthquakes]
  );

  const dhnAlarma  = kpis.dhn_alarma_count      || grouped.ALARMA.length;
  const dhnAlerta  = kpis.dhn_alerta_count       || grouped.ALERTA.length;
  const dhnInfo    = kpis.dhn_informacion_count   || grouped.INFORMACION.length;
  const localCount = kpis.local_earthquakes_count || localQuakes.length;

  return (
    <div style={{ padding: '4px 8px' }}>

      {/* MODAL DETALLE SISMO */}
      {selectedEq && (
        <EarthquakeModal eq={selectedEq} onClose={() => setSelectedEq(null)} />
      )}

      {/* MODAL LISTA POR NIVEL */}
      {listModal && (
        <div
          onClick={() => setListModal(null)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.8)',
            zIndex: 9998,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, backdropFilter: 'blur(4px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#0a1628',
              border: `2px solid ${listModal.color}66`,
              borderRadius: 12, padding: 24,
              maxWidth: 600, width: '100%',
              maxHeight: '80vh', overflowY: 'auto',
              boxShadow: `0 0 40px ${listModal.color}33`,
              position: 'relative',
            }}
          >
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              height: 4, background: listModal.color, borderRadius: '12px 12px 0 0',
            }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingTop: 8 }}>
              <div>
                <div style={{ fontSize: 10, color: '#64748b', letterSpacing: 2 }}>EVENTOS CLASIFICADOS</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: listModal.color, fontFamily: "'Orbitron', monospace", letterSpacing: 2 }}>
                  {listModal.title}
                </div>
              </div>
              <button
                onClick={() => setListModal(null)}
                style={{
                  background: 'transparent', border: '1px solid #1e3a5f',
                  color: '#94a3b8', borderRadius: 6, padding: '4px 10px',
                  cursor: 'pointer', fontSize: 12,
                }}
              >
                ✕ CERRAR
              </button>
            </div>
            {listModal.items.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#64748b', padding: 30 }}>
                Sin eventos en esta categoría
              </div>
            ) : (
              listModal.items.map((eq) => (
                <EarthquakeCard
                  key={eq.id}
                  eq={eq}
                  onClick={(eq) => { setListModal(null); setSelectedEq(eq); }}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* ═══ ENCABEZADO ═══ */}
      <div style={{
        background: 'linear-gradient(90deg, #0a1628, #0d2847, #0a1628)',
        border: '1px solid #1e3a5f',
        borderRadius: 10, padding: 14, marginBottom: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <h3 style={{
              fontSize: 16, color: '#fbbf24', letterSpacing: 3,
              fontWeight: 700, fontFamily: "'Orbitron', monospace", margin: 0,
            }}>
              CENTRO DE COMANDO — MATRIZ OFICIAL DHN
            </h3>
            <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 0 0' }}>
              Clasificación según matriz oficial de la Dirección de Hidrografía y Navegación
            </p>
          </div>
          <div style={{ fontSize: 10, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: '#22c55e', animation: 'blink 2s infinite',
              boxShadow: '0 0 8px #22c55e',
            }} />
            ACTUALIZADO EN VIVO
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {[
            { label: 'ALARMA',          value: dhnAlarma,  color: DHN_COLORS.ALARMA,      items: grouped.ALARMA },
            { label: 'ALERTA',          value: dhnAlerta,  color: DHN_COLORS.ALERTA,      items: grouped.ALERTA },
            { label: 'INFORMACIÓN',     value: dhnInfo,    color: DHN_COLORS.INFORMACION, items: grouped.INFORMACION },
            { label: 'EVENTOS EN PERÚ', value: localCount, color: '#fbbf24',              items: localQuakes },
          ].map((kpi) => (
            <div
              key={kpi.label}
              onClick={() => setListModal({ title: kpi.label, color: kpi.color, items: kpi.items })}
              style={{
                background: '#070e1f', border: `1px solid ${kpi.color}44`,
                borderRadius: 6, padding: 10, textAlign: 'center',
                position: 'relative', overflow: 'hidden',
                cursor: 'pointer', transition: 'border-color 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = `${kpi.color}99`}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = `${kpi.color}44`}
            >
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0,
                height: 3, background: kpi.color,
              }} />
              <div style={{ fontSize: 10, color: kpi.color, fontWeight: 700, letterSpacing: 1 }}>
                {kpi.label}
              </div>
              <div style={{
                fontSize: 28, fontWeight: 700, color: kpi.color,
                fontFamily: "'Orbitron', monospace", marginTop: 4, lineHeight: 1,
              }}>
                {kpi.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ EVENTOS EN TERRITORIO PERUANO ═══ */}
      {localQuakes.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #fbbf2411, #0d1a2e)',
          border: '2px solid #fbbf2466',
          borderRadius: 10, padding: 14, marginBottom: 16,
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>🇵🇪</span>
              <span style={{ fontSize: 14, color: '#fbbf24', fontWeight: 700, letterSpacing: 2 }}>
                EVENTOS EN TERRITORIO PERUANO
              </span>
              <span style={{
                padding: '2px 10px', background: '#fbbf24',
                color: '#0a1628', borderRadius: 12, fontSize: 12, fontWeight: 700,
              }}>
                {localQuakes.length}
              </span>
            </div>
            <span style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic' }}>
              Últimos 5 sismos en territorio peruano (mar o hasta 60km tierra adentro)
            </span>
          </div>
          {localQuakes.map((eq) => (
            <EarthquakeCard
              key={`local-${eq.id}`}
              eq={eq}
              highlighted
              onClick={setSelectedEq}
            />
          ))}
        </div>
      )}

      {/* ═══ SECCIONES POR NIVEL DHN ═══ */}
      <LevelSection level="ALARMA"      earthquakes={grouped.ALARMA}                   defaultOpen={true}  onCardClick={setSelectedEq} />
      <LevelSection level="ALERTA"      earthquakes={grouped.ALERTA}                   defaultOpen={true}  onCardClick={setSelectedEq} />
      <LevelSection level="INFORMACION" earthquakes={grouped.INFORMACION.slice(0, 20)} defaultOpen={false} onCardClick={setSelectedEq} />

      {/* ═══ ALERTAS DE TSUNAMI PTWC/NTWC ═══ */}
      {alerts && alerts.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px',
            background: '#7f1d1d22', border: '1px solid #ef444466',
            borderRadius: 6, marginBottom: 10,
          }}>
            <span style={{ fontSize: 16 }}>🌊</span>
            <span style={{ fontSize: 13, color: '#ef4444', fontWeight: 700, letterSpacing: 2 }}>
              BOLETINES DE TSUNAMI (PTWC/NTWC)
            </span>
            <span style={{
              padding: '2px 10px', background: '#ef4444',
              color: '#fff', borderRadius: 12, fontSize: 12, fontWeight: 700,
            }}>
              {alerts.length}
            </span>
          </div>
          {alerts.map((a) => (
            <div key={a.id} style={{
              borderLeft: `4px solid ${a.severity === 'critical' ? '#ef4444' : '#f59e0b'}`,
              borderRadius: 8, padding: 12, marginBottom: 6, background: '#0d1a2e',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{
                  fontSize: 12, fontWeight: 700,
                  color: a.severity === 'critical' ? '#ef4444' : '#f59e0b', letterSpacing: 1,
                }}>
                  {a.alert_type}
                </span>
                <span style={{ fontSize: 10, color: '#94a3b8' }}>
                  {new Date(a.issued_at).toLocaleString('es-PE')}
                </span>
              </div>
              <p style={{ fontSize: 12, color: '#e2e8f0', margin: 0, lineHeight: 1.5 }}>
                {a.title}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ═══ ESTADO VACÍO ═══ */}
      {grouped.ALARMA.length === 0 && grouped.ALERTA.length === 0 &&
       grouped.INFORMACION.length === 0 && (!alerts || alerts.length === 0) && (
        <div style={{
          padding: 40, textAlign: 'center', color: '#64748b',
          background: '#0d1a2e', borderRadius: 8, border: '1px solid #1e3a5f',
        }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🟢</div>
          <div style={{ fontSize: 14, color: '#22c55e', fontWeight: 700, letterSpacing: 1 }}>
            SIN EVENTOS ACTIVOS
          </div>
          <div style={{ fontSize: 11, marginTop: 4 }}>
            No hay sismos clasificados ni alertas de tsunami en este momento
          </div>
        </div>
      )}

      {/* ═══ PIE ═══ */}
      <div style={{
        marginTop: 20, padding: '10px 14px',
        background: '#070e1f', border: '1px solid #1e3a5f33',
        borderRadius: 6, fontSize: 10, color: '#475569', textAlign: 'center',
      }}>
        Clasificación basada en la matriz oficial de la Dirección de Hidrografía y Navegación (DHN) — Marina de Guerra del Perú.
        <br />
        Niveles: <span style={{ color: DHN_COLORS.ALARMA }}>ALARMA</span> (genera tsunami) ·{' '}
        <span style={{ color: DHN_COLORS.ALERTA }}>ALERTA</span> (probable tsunami) ·{' '}
        <span style={{ color: DHN_COLORS.INFORMACION }}>INFORMACIÓN</span> (registrado, no genera).
      </div>
    </div>
  );
}
