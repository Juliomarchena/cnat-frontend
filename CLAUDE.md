# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto
Dashboard del Centro Nacional de Alerta de Tsunamis (CNAT) — cliente: DHN, Marina de Guerra del Perú.
Desarrollador: Julius Marchena (MICROHELP, Lima). Prefiere archivos completos de reemplazo, NO snippets.

## Comandos
```bash
npm start                    # Dev en localhost:3000
npm run build                # Build producción
git add <archivos> && git commit -m "fix|feat: desc" && git push   # Deploy automático a Vercel
```

## Stack
- React 18 (Create React App) — NO Next.js, NO TypeScript
- Recharts para gráficos, Leaflet puro (via `require('leaflet')` en useEffect) para mapas
- CSS inline en todos los componentes — no hay archivos CSS separados
- Vercel (frontend) + Render/FastAPI (backend) + Supabase PostgreSQL (BD)

## Arquitectura — todo en src/App.js

Un único archivo con todos los componentes. Orden de arriba a abajo:

1. **Constantes globales** — `API`, `CLAUDE_KEY` (ambas desde `process.env.REACT_APP_*`)
2. **AutoReport** — llama a Claude API directo desde el browser con `anthropic-dangerous-direct-browser-access: true`; genera micro-reporte cada 5 min con efecto typewriter
3. **StatsSummary** — panel derecho con estadísticas numéricas de sismos
4. **AnalyticsDashboard** — 6 gráficos Recharts en grid 3 columnas; recibe `data` del endpoint `/api/dashboard`
5. **PacificMap** — SVG puro (no Leaflet), viewBox cambia con zoom buttons; `toX/toY` convierten lat/lng a coordenadas SVG
6. **MapLegend** — componente separado de la leyenda del mapa SVG
7. **TideGaugeMap** — mapa mareográfico con Leaflet real (cargado dinámicamente via `require`); fallback IOC API v1 si el backend devuelve 0 estaciones
8. **AriaAssistant** — chat con Claude, construye contexto desde `data` del dashboard
9. **App** — componente raíz; polling cada 30s a `GET /api/dashboard`; tabs: mapa/analytics/alertas/mareografo/boyas/fuentes/umbrales/aria

## Datos críticos

**Estaciones mareográficas Peru (IOC codes verificados con datos reales):**
`call` (Callao), `chan` (Chancay), `IsHor` (Isla Hormiga), `chimb` (Chimbote), `salav` (Salaverry), `paita` (Paita), `tala2` (Talara), `lobos` (Lobos de Afuera), `pdas` (Pisco), `sjuan` (San Juan), `chala` (Chala), `mata` (Matarani), `ilom` (Ilo)
Sin datos activos: `huarm`, `huach`, `bayo`, `cazul`

**Backend endpoint único:** `GET /api/dashboard` devuelve `{kpis, earthquakes, alerts, buoys, sources, thresholds}`

**Supabase CNAT:** `https://zgcjggfbdpfbmivwqjvt.supabase.co` — distinto al proyecto Intrepid DMC. El frontend NO llama a Supabase directamente (excepción: auth de usuarios futura).

## Variables de entorno (.env — UTF-8, no UTF-16)
```
REACT_APP_API_URL=https://cnat-backend-1.onrender.com
REACT_APP_CLAUDE_KEY=sk-ant-...
```
El `.env` debe estar en UTF-8 puro (usar `printf` en bash, no el editor de Windows que guarda UTF-16).

## Vercel — configuración (vercel.json)
- `buildCommand`: llamar react-scripts via `node node_modules/react-scripts/bin/react-scripts.js build` si hay problemas de permisos
- `DISABLE_ESLINT_PLUGIN=true` y `GENERATE_SOURCEMAP=false` en env
- NO agregar `react-leaflet` como dependencia — el código usa `leaflet` puro
- NO agregar `eslint` como devDependency — conflicta con el eslint@8 interno de react-scripts@5

## Diseño (no cambiar)
- Fondo: `#050b18`, estilo sala de control/monitoreo oscuro
- Fuente principal: `'JetBrains Mono', monospace`; títulos: `'Orbitron'`
- Colores de alerta: crítico `#ef4444`, warning `#f59e0b`, moderado `#fb923c`, normal `#64748b`
- Pestañas inactivas: `#e2e8f0` (blanco), 15px — optimizado para operadores con baja visión
