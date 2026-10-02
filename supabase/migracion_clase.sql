-- ════════════════════════════════════════════════════════════
-- Migración: columna "clase" en usuarios (DAM/DAW/ASIR, 12 grupos)
-- Pega y ejecuta todo este bloque en el SQL Editor de Supabase.
-- Es idempotente: se puede ejecutar varias veces sin problema.
-- ════════════════════════════════════════════════════════════

-- 1) Columna clase + constraint de los 12 valores válidos
DO $$ BEGIN
  ALTER TABLE public.usuarios
    ADD COLUMN IF NOT EXISTS clase TEXT DEFAULT NULL;
  ALTER TABLE public.usuarios
    ADD CONSTRAINT usuarios_clase_check CHECK (clase IN (
      '1º DAM A','1º DAM B','2º DAM A','2º DAM B',
      '1º DAW A','1º DAW B','2º DAW A','2º DAW B',
      '1º ASIR A','1º ASIR B','2º ASIR A','2º ASIR B'
    ));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.usuarios.clase IS
  'Grupo-clase del alumno: curso (1º/2º) + ciclo (DAM/DAW/ASIR) + subgrupo (A/B). NULL hasta que el usuario la configure.';

-- 2) Todos los usuarios existentes hasta esta migración son de 1º DAM B
UPDATE public.usuarios SET clase = '1º DAM B' WHERE clase IS NULL;

-- 3) Trigger de alta de usuario: guarda la clase elegida en el registro
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.usuarios (id, nombre, email, promedio, rol, clase)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    NEW.email,
    0,
    'alumno',
    NEW.raw_user_meta_data->>'clase'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4) get_mi_perfil(): incluir clase
DROP FUNCTION IF EXISTS public.get_mi_perfil();
CREATE FUNCTION public.get_mi_perfil()
RETURNS TABLE (
  id            uuid,
  nombre        text,
  email         text,
  promedio      numeric,
  avatar_url    text,
  banner_url    text,
  rol           text,
  clase         text,
  es_superadmin boolean,
  created_at    timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, nombre, email, promedio, avatar_url, banner_url, rol, clase, es_superadmin, created_at
  FROM public.usuarios
  WHERE id = auth.uid()
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_mi_perfil() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_mi_perfil() TO authenticated;

-- 5) get_todos_usuarios(): incluir clase
DROP FUNCTION IF EXISTS public.get_todos_usuarios();
CREATE FUNCTION public.get_todos_usuarios()
RETURNS TABLE (
  id            uuid,
  nombre        text,
  email         text,
  promedio      numeric,
  avatar_url    text,
  banner_url    text,
  rol           text,
  clase         text,
  es_superadmin boolean,
  created_at    timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.nombre, u.email, u.promedio, u.avatar_url, u.banner_url,
         u.rol, u.clase, u.es_superadmin, u.created_at
  FROM public.usuarios u
  WHERE EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND rol = 'admin'
  )
  ORDER BY u.nombre;
$$;

-- 6) Forzar a PostgREST a recargar el esquema (soluciona el error
--    "Could not find the 'clase' column ... in the schema cache")
NOTIFY pgrst, 'reload schema';
