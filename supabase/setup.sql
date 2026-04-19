-- ══════════════════════════════════════════════════════
-- CNAT — Sistema de usuarios con roles
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════

-- 1. Tabla de usuarios CNAT (extiende auth.users de Supabase)
CREATE TABLE IF NOT EXISTS public.cnat_users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'operador' CHECK (role IN ('admin', 'operador', 'readonly')),
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login  TIMESTAMPTZ
);

-- 2. Habilitar RLS
ALTER TABLE public.cnat_users ENABLE ROW LEVEL SECURITY;

-- 3. Políticas RLS
-- Cualquier usuario autenticado puede ver su propio perfil
CREATE POLICY "usuario_ve_su_perfil"
  ON public.cnat_users FOR SELECT
  USING (auth.uid() = id);

-- Solo admins pueden ver todos los usuarios
CREATE POLICY "admin_ve_todos"
  ON public.cnat_users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cnat_users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Solo admins pueden insertar/actualizar usuarios
CREATE POLICY "admin_gestiona_usuarios"
  ON public.cnat_users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.cnat_users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 4. Trigger: al registrar un usuario en Supabase Auth → crear su perfil automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.cnat_users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'operador')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Trigger: actualizar last_login al iniciar sesión
CREATE OR REPLACE FUNCTION public.handle_user_login()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.cnat_users
  SET last_login = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Crear usuario admin inicial
-- INSTRUCCIONES:
--   a) Ir a Supabase Dashboard → Authentication → Users → Add User
--   b) Email: admin@cnat.gob.pe  Password: (definir con la Marina)
--   c) Luego ejecutar este UPDATE con el UUID que asignó Supabase:
--
-- UPDATE public.cnat_users
-- SET role = 'admin', full_name = 'Administrador CNAT'
-- WHERE email = 'admin@cnat.gob.pe';
