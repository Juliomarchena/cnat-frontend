# Plan: Sistema de Login CNAT con Roles y JWT

## Stack de Auth
- **Supabase Auth** — maneja login/sesión/JWT (email + password)
- **Tabla `cnat_users`** — extiende auth.users con rol (admin/operador/readonly)
- **Frontend React** — `@supabase/supabase-js` para sesión; protege rutas por rol
- **FastAPI backend** — valida el JWT de Supabase en headers para proteger /api/*

---

## PASO 1 — Supabase: SQL ✅ PENDIENTE
- [ ] Crear tabla `cnat_users` vinculada a `auth.users`
- [ ] Habilitar RLS con políticas por rol
- [ ] Trigger: al crear usuario en auth → insertar en cnat_users con rol 'operador' por defecto
- [ ] Crear usuario admin inicial en Supabase Dashboard

Archivo: `supabase/setup.sql`

## PASO 2 — Instalar dependencia Supabase ✅ PENDIENTE
- [ ] `npm install @supabase/supabase-js`
- [ ] Crear `src/supabaseClient.js`
- [ ] Agregar vars de entorno al .env y Vercel

## PASO 3 — Frontend: LoginScreen ✅ PENDIENTE
- [ ] Componente `LoginScreen` — estilo sala de control oscuro
- [ ] Campos: email + password + botón INGRESAR
- [ ] Manejo de error (credenciales incorrectas)
- [ ] Logo CNAT + "CENTRO NACIONAL DE ALERTA DE TSUNAMIS"

## PASO 4 — Frontend: AuthProvider y protección de rutas ✅ PENDIENTE
- [ ] Hook `useAuth()` — expone `user`, `role`, `logout`
- [ ] App.js verifica sesión al iniciar; si no hay sesión → LoginScreen
- [ ] Guardar rol en estado global desde `cnat_users`

## PASO 5 — Frontend: Control de acceso por rol ✅ PENDIENTE
- [ ] `admin` → todo visible + tab USUARIOS
- [ ] `operador` → dashboard completo, sin gestión de usuarios
- [ ] `readonly` → sin botones REFRESH de ARIA, sin acciones
- [ ] Header muestra nombre + rol + botón CERRAR SESIÓN

## PASO 6 — Backend FastAPI: middleware JWT ✅ PENDIENTE
- [ ] Dependencia: `python-jose` o verificación con Supabase public key
- [ ] Middleware que extrae Bearer token del header Authorization
- [ ] Rutas protegidas devuelven 401 si token inválido/expirado
- [ ] Nota: cambio en repo `cnat-backend` (separado)

## PASO 7 — Tab USUARIOS (solo admin) ✅ PENDIENTE
- [ ] Tabla con todos los `cnat_users`
- [ ] Crear usuario (llama a Supabase Admin API via backend)
- [ ] Cambiar rol (UPDATE en cnat_users)
- [ ] Desactivar/activar cuenta

---

## Orden de ejecución
1. SQL Supabase → 2. Dependencia + supabaseClient → 3. LoginScreen →
4. AuthProvider → 5. Control de roles en UI → 6. Backend JWT → 7. Tab Usuarios

## Variables de entorno necesarias
```
REACT_APP_SUPABASE_URL=https://zgcjggfbdpfbmivwqjvt.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJ...
REACT_APP_API_URL=https://cnat-backend-1.onrender.com
REACT_APP_CLAUDE_KEY=sk-ant-...
```
