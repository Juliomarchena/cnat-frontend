# CNAT Backend — Protección JWT con Supabase Auth
# Aplicar en repo: cnat-backend (FastAPI en Render)

## Contexto
El frontend ya tiene login con Supabase Auth. Cada usuario autenticado recibe
un JWT de Supabase. El backend debe validar ese token en cada request para
proteger los endpoints /api/*.

El JWT viene en el header: `Authorization: Bearer <token>`

---

## PASO 1 — Instalar dependencias

```bash
pip install python-jose[cryptography] httpx
```

Agregar a `requirements.txt`:
```
python-jose[cryptography]==3.3.0
httpx==0.27.0
```

---

## PASO 2 — Variables de entorno en Render

En Render → cnat-backend → Environment → agregar:

```
SUPABASE_URL=https://zgcjggfbdpfbmivwqjvt.supabase.co
SUPABASE_JWT_SECRET=<JWT Secret de Supabase>
```

Para obtener el JWT Secret:
> Supabase Dashboard → Settings → API → JWT Settings → JWT Secret (copiar)

---

## PASO 3 — Archivo auth.py (crear en raíz del proyecto)

```python
# auth.py
import os
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")
ALGORITHM = "HS256"

security = HTTPBearer()

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=[ALGORITHM],
            audience="authenticated"
        )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_current_user(payload: dict = Depends(verify_token)):
    user_id = payload.get("sub")
    email = payload.get("email")
    role = payload.get("user_metadata", {}).get("role", "readonly")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token sin usuario")
    return {"id": user_id, "email": email, "role": role}

def require_admin(user: dict = Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Se requiere rol admin")
    return user
```

---

## PASO 4 — Aplicar en main.py

### Opción A: Proteger rutas individualmente (recomendado)

```python
# main.py
from auth import get_current_user, require_admin

# Ruta pública (sin auth) — mantener para healthcheck
@app.get("/")
def root():
    return {"status": "CNAT API operativa"}

# Rutas protegidas — agregar Depends(get_current_user)
@app.get("/api/dashboard")
def get_dashboard(user: dict = Depends(get_current_user)):
    # ... codigo existente sin cambios
    return dashboard_data

@app.get("/api/sealevel/stations")
def get_stations(user: dict = Depends(get_current_user)):
    # ... codigo existente sin cambios
    pass

@app.get("/api/sealevel/station/{code}")
def get_station_data(code: str, user: dict = Depends(get_current_user)):
    # ... codigo existente sin cambios
    pass

# Rutas solo admin
@app.get("/api/admin/users")
def get_users(admin: dict = Depends(require_admin)):
    # Consultar cnat_users desde Supabase
    pass
```

### Opción B: Proteger TODAS las rutas con middleware global

```python
# main.py — agregar antes de las rutas
from fastapi import Request
from auth import verify_token

RUTAS_PUBLICAS = ["/", "/docs", "/openapi.json", "/redoc"]

@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    if request.url.path in RUTAS_PUBLICAS:
        return await call_next(request)
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=401, content={"detail": "Token requerido"})
    try:
        from fastapi.security import HTTPAuthorizationCredentials
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=auth_header[7:])
        verify_token(creds)
    except Exception:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=401, content={"detail": "Token invalido"})
    return await call_next(request)
```

---

## PASO 5 — Frontend: enviar el token en cada request

En el frontend (App.js), modificar la función `fetchData` para incluir el token:

```javascript
// En App.js — reemplazar fetchData
const fetchData = useCallback(async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || '';
    const r = await fetch(`${API}/dashboard`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const d = await r.json();
    setData(d);
    // ... resto igual
  } catch (e) { setError(e.message); }
}, [playAlarm]);
```

---

## PASO 6 — Endpoint admin/users (opcional)

```python
# main.py
import httpx, os

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")  # agregar en Render

@app.get("/api/admin/users")
async def list_users(admin: dict = Depends(require_admin)):
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/cnat_users?select=*&order=created_at",
            headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"
            }
        )
    return r.json()

@app.patch("/api/admin/users/{user_id}/role")
async def update_role(user_id: str, body: dict, admin: dict = Depends(require_admin)):
    role = body.get("role")
    if role not in ["admin", "operador", "readonly"]:
        raise HTTPException(400, "Rol invalido")
    async with httpx.AsyncClient() as client:
        await client.patch(
            f"{SUPABASE_URL}/rest/v1/cnat_users?id=eq.{user_id}",
            headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                "Content-Type": "application/json"
            },
            json={"role": role}
        )
    return {"ok": True}
```

---

## PASO 7 — CORS: asegurarse de permitir el header Authorization

```python
# main.py — en la configuracion de CORS existente
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://cnat-frontend.vercel.app",
        "https://cnat-frontend-git-main-juliomarchenas-projects.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],  # <-- esto ya incluye Authorization
)
```

---

## Variables de entorno finales en Render

```
SUPABASE_URL=https://zgcjggfbdpfbmivwqjvt.supabase.co
SUPABASE_JWT_SECRET=<JWT Secret — Supabase → Settings → API>
SUPABASE_SERVICE_KEY=<service_role key — Supabase → Settings → API>
```

## Orden de implementación

1. Agregar env vars en Render
2. Crear auth.py
3. Aplicar Opcion A (Depends) en las rutas existentes
4. Verificar CORS incluye Authorization header
5. Modificar fetchData en frontend para enviar token
6. Probar con login real en cnat-frontend.vercel.app
