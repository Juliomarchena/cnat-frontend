import React, { useState, useCallback } from 'react';
import { supabase } from './supabaseClient';

/**
 * VIGIA - Asistente IA del CNAT
 * Marina de Guerra del Perú
 *
 * A diferencia del ARIA original, VIGIA llama a la Edge Function
 * "vigia" de Supabase, que tiene acceso directo a la tabla
 * earthquakes y otras tablas del CNAT.
 */
export default function ModuloVIGIA({ data }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const prompts = [
    "Busca los sismos registrados ayer en Perú",
    "Hay sismos significativos M5.0+ en las últimas 24 horas?",
    "Resumen de actividad sísmica en el Pacífico hoy",
    "Sismos locales del Perú esta semana",
    "Cuál fue el sismo más fuerte de los últimos 7 días?"
  ];

  const send = async (text) => {
    if (!text.trim()) return;

    const userMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const VIGIA_URL = 'https://zgcjggfbdpfbmivwqjvt.supabase.co/functions/v1/vigia';

      const response = await fetch(VIGIA_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: text,
          conversationHistory: messages.map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.response || result.error || 'Sin respuesta'
      }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠ Error de conexión con VIGIA: ${e.message}`
      }]);
    }

    setLoading(false);
  };

  const exportPDF = () => {
    const k = data?.kpis || {};
    const now = new Date().toLocaleString('es-PE');

    const content = messages.map(m => `
      <div style="margin-bottom:20px;padding:14px;border-left:4px solid ${m.role === 'user' ? '#f59e0b' : '#06b6d4'};background:${m.role === 'user' ? '#fff8e7' : '#ecfeff'}">
        <div style="font-size:11px;font-weight:700;color:${m.role === 'user' ? '#92400e' : '#0e7490'};margin-bottom:8px;letter-spacing:1px">
          ${m.role === 'user' ? 'OPERADOR' : 'VIGIA — Asistente IA CNAT'}
        </div>
        <div style="font-size:13px;color:#1e293b;line-height:1.8;white-space:pre-wrap">${m.content}</div>
      </div>
    `).join('');

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Reporte VIGIA - CNAT ${now}</title>
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
      <div style="font-size:10px;color:#06b6d4">REPORTE VIGIA — IA</div>
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
  <span>CNAT v2.0</span>
  <span>Documento generado automáticamente por VIGIA</span>
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

      {/* ── Header VIGIA ── */}
      <div style={{ padding: 16, borderBottom: '2px solid #06b6d4', background: '#0a1628' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'linear-gradient(135deg,#06b6d4,#0891b2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, color: '#fff', fontWeight: 700
          }}>V</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fbbf24', fontFamily: "'Orbitron'" }}>
              VIGIA
            </div>
            <div style={{ fontSize: 11, color: '#67e8f9' }}>
              Vigilancia Inteligente Geosísmica e Información de Alertas
            </div>
          </div>
          {messages.length > 0 && (
            <>
              <button onClick={exportPDF} style={{
                padding: '6px 14px', borderRadius: 6, border: '1px solid #0891b2',
                background: '#164e63', color: '#67e8f9', fontSize: 11, cursor: 'pointer',
                fontFamily: 'inherit', fontWeight: 700, marginRight: 8
              }}>⬇ PDF</button>
              <button onClick={() => setMessages([])} style={{
                padding: '6px 14px', borderRadius: 6, border: '1px solid #334155',
                background: '#0d1a2e', color: '#94a3b8', fontSize: 11, cursor: 'pointer',
                fontFamily: 'inherit'
              }}>↩ Nueva consulta</button>
            </>
          )}
        </div>
      </div>

      {/* ── Pantalla inicial: descripción + consultas rápidas ── */}
      {messages.length === 0 && (
        <div style={{ padding: 16 }}>

          {/* Descripción */}
          <div style={{
            background: '#000000',
            border: '2px solid #06b6d4',
            borderRadius: 10,
            padding: '16px 18px',
            marginBottom: 18,
            boxShadow: '0 0 18px rgba(6,182,212,0.4), inset 0 0 30px rgba(6,182,212,0.05)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ position:'absolute', top:0, left:0, width:'100%', height:2, background:'linear-gradient(90deg,#06b6d4,#0891b2,#06b6d4)' }} />
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
              <span style={{ fontSize:18 }}>⚠️</span>
              <span style={{ fontSize:11, color:'#67e8f9', fontWeight:700, letterSpacing:2.5 }}>GUÍA DE USO — VIGÍA</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>🔭</span>
                <div style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.7, fontStyle: 'italic' }}>
                  <span style={{ color: '#fbbf24', fontWeight: 700, fontStyle: 'normal' }}>Pregunta a VIGÍA</span> para saber{' '}
                  <span style={{ color: '#67e8f9', fontWeight: 700, fontStyle: 'normal' }}>qué pasó antes</span> — consulta sismos históricos, busca por región, fecha o magnitud.
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>📡</span>
                <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7, fontStyle: 'italic' }}>
                  Para el estado actual del sistema en tiempo real, usa el módulo{' '}
                  <span style={{ color: '#a78bfa', fontWeight: 700, fontStyle: 'normal' }}>ARIA (IA)</span>.
                </div>
              </div>
            </div>
          </div>

          {/* Consultas rápidas */}
          <div style={{ fontSize: 11, color: '#fbbf24', letterSpacing: 1.5, marginBottom: 10, fontWeight: 700 }}>
            CONSULTAS RÁPIDAS
          </div>
          {prompts.map((p, i) => (
            <button key={i} onClick={() => send(p)} style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '10px 14px', marginBottom: 6, background: '#0d1a2e',
              border: '1px solid #1e3a5f66', borderRadius: 8, color: '#cbd5e1',
              fontSize: 12, cursor: 'pointer', fontFamily: 'inherit'
            }}
              onMouseOver={e => { e.target.style.background = '#164e6344'; e.target.style.color = '#67e8f9'; }}
              onMouseOut={e => { e.target.style.background = '#0d1a2e'; e.target.style.color = '#cbd5e1'; }}>
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
            background: m.role === 'user' ? '#1e3a5f22' : '#0d1a2e',
            borderLeft: m.role === 'user' ? '4px solid #f59e0b' : '4px solid #06b6d4'
          }}>
            <div style={{
              fontSize: 11, color: m.role === 'user' ? '#fbbf24' : '#67e8f9',
              fontWeight: 700, marginBottom: 8
            }}>
              {m.role === 'user' ? 'OPERADOR' : 'VIGIA'}
            </div>
            <div style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ padding: 14, borderRadius: 8, background: '#0d1a2e', borderLeft: '4px solid #06b6d4' }}>
            <div style={{ fontSize: 13, color: '#67e8f9' }}>
              VIGIA está consultando la base de datos...
            </div>
          </div>
        )}
      </div>

      {/* ── Input ── */}
      <div style={{ padding: 14, borderTop: '2px solid #1e3a5f', display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && send(input)}
          placeholder="Consulta a VIGIA sobre sismos, alertas, boyas..."
          disabled={loading}
          style={{
            flex: 1, padding: '12px 16px', borderRadius: 8, border: '2px solid #1e3a5f',
            background: '#0a1628', color: '#fbbf24', fontSize: 13,
            fontFamily: 'inherit', outline: 'none'
          }}
        />
        <button
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          style={{
            padding: '12px 24px', borderRadius: 8, border: 'none',
            background: loading ? '#334155' : '#06b6d4', color: '#fff',
            fontSize: 13, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit'
          }}
        >
          {loading ? '...' : 'ENVIAR'}
        </button>
      </div>
    </div>
  );
}
