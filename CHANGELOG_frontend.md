# CHANGELOG — cnat-frontend
**Repositorio:** github.com/Juliomarchena/cnat-frontend  
**URL producción:** https://cnat-frontend.vercel.app  
**Stack:** React 18 + Create React App + Recharts + Leaflet + Vercel

---

## [v3.0.0] — 26-27/05/2026

### Agregado
- `ModuloIGP.jsx` — Módulo de inteligencia IGP con 3 vistas:
  - **⚡ Comparativa cruzada** — mismo sismo en IGP vs USGS con delta de magnitud y estado CONFIRMADO/DISCREPANCIA/SOLO IGP
  - **📡 Canales IGP** — tarjetas de estado para Web, Twitter x2, Telegram, USGS
  - **🐦 Tweets en vivo** — feed de tweets IGP parseados con magnitud, lugar, coordenadas
  - KPIs: tweets IGP, sismos locales, fuente USGS, cruces OK, sin cruce
  - Auto-refresh cada 30s
- `PanelIGP.jsx` — Panel sidebar con tweets IGP, blink animado y popup emergente con barra de cierre automático 10s
- `App.js` actualizado:
  - Import `ModuloIGP` y `PanelIGP`
  - `setInterval(fetchData, 30000)` — auto-refresh de datos cada 30 segundos
  - `FuentesTab` con botón toggle **◈ INTELIGENCIA IGP** que muestra `ModuloIGP`
  - `PanelIGP` en ambos sidebars (MAPA y otras tabs)
  - `API_BASE` como constante separada para pasarla a `ModuloIGP`

### Commits
| Commit | Descripción |
|--------|-------------|
| `4233fce` | feat: ModuloIGP integrado en FUENTES - comparativa cruzada IGP/USGS |
| `1ef603a` | fix: quitar simbolos > de cada linea ARIA |
| `f0f9539` | feat: ARIA v3.3 orden cronologico + panel ampliado 360px |
| `66cea22` | fix: eliminar horasAtras duplicado |
| `cfcd80f` | feat: AutoReport v3.2 formato tabla + blink 3 dias |

---

## [v2.2.0] — 22/05/2026

### Agregado
- `FuentesTab` — componente completo con estados inteligentes:
  - `EN LÍNEA` (⚙️ girando + pulso verde)
  - `EN ESPERA` (⏳ animado amarillo)
  - `ERROR` (⛔ rojo + botón EJECUTAR)
  - `EN CONSTRUCCIÓN` (🔧 gris)
  - Orden visual por prioridad de estado
  - Botón **EJECUTAR NOTICIAS** para BBC/NYT/WaPo
  - Botón **FETCH GENERAL**
  - Botón **RESUMEN VIGÍA**
  - Muestra `descripcion` y `fetch_mode` de cada fuente desde Supabase
- `VigiaResumenCRT` — componente CRT:
  - Fondo negro, letras verdes fosforescentes Courier New
  - Scanlines con CSS repeating-linear-gradient
  - Efecto typewriter a 10ms/carácter con cursor █ parpadeante
  - Animación PROCESANDO con puntos suspensivos en amarillo
  - Borde cambia verde→amarillo durante procesamiento
  - Fecha/hora exacta de emisión del boletín
  - Score de relevancia con color semáforo

### Commits
| Commit | Descripción |
|--------|-------------|
| `04c0173` | FASE 2: Pestaña FUENTES actualizada |
| `556a133` | FASE 2: Fuentes con iconos animados y estados inteligentes |
| `63d5f45` | FASE 2: VIGÍA typewriter real + fecha/hora emisión |
| `1f70bb2` | FASE 2: VIGÍA estilo CRT + ejecutar noticias |
| `ca92641` | VIGÍA: typewriter 10ms, interlineado compacto 1.4 |
| `(último)` | VIGÍA: procesando inmediato con puntos animados |

---

## [v2.1.0] — 19-21/05/2026

### Agregado
- `ModuloAlertasDHN` — módulo alertas con clasificación DHN
- `ModuloVIGIA` — asistente VIGÍA con Edge Function swift-worker
- `ModuloARIA` — asistente ARIA con prompt jerárquico primera plana
- `AutoReport` — mini-reporte CRT auto-refresh 5min, exportado como named export
- `TsunamiTracker` — mapa SVG proyección Pacífico con datos USGS reales
- `TideGaugeMap` — mapa Leaflet mareógrafo con IOC/SLSMF API
- `PacificMapLeaflet` — mapa Leaflet reemplazando SVG estático. CartoDB dark, marcadores pulsantes
- Helper `apiFetch()` centralizado con JWT Supabase
- Autenticación completa con roles: admin / operador / readonly
- Tab USUARIOS con gestión de roles
- Tab TSUNAMI con modelo de propagación
- Tab MAREOGRAFO con curva de nivel del mar por estación

### Estado al 22/05/2026
- 18/20 fuentes activas
- Sistema CNAT v2.2.0 en producción

---

## Módulos actuales en src/

| Archivo | Descripción |
|---------|-------------|
| `App.js` | Componente principal. Todos los tabs y sidebar |
| `ModuloARIA.jsx` | Asistente ARIA (IA conversacional) |
| `ModuloVIGIA.jsx` | Asistente VIGÍA (Edge Function) |
| `ModuloAlertasDHN.jsx` | Alertas con clasificación DHN |
| `ModuloIGP.jsx` | Inteligencia fuentes IGP ← NUEVO |
| `PanelIGP.jsx` | Panel sidebar tweets IGP ← NUEVO |
| `AutoReport.jsx` | Mini-reporte CRT automático |
| `TsunamiTracker.jsx` | Simulador propagación tsunami |
| `TideGaugeMap.jsx` | Mapa mareógrafo Pacífico |
| `supabaseClient.js` | Cliente Supabase |

---

## Pendientes prioritarios

1. 🔴 ARIA auto-regeneración — `useEffect` con deps en `data` prop (20 min)
2. 🟡 `ModuloIGP` — mostrar datos cuando lleguen tweets reales del IGP (automático al resolver backend)
3. 🟢 Indicador visual de último refresh en header (30 min)
