-- ════════════════════════════════════════════════════════════
-- Migración: gestión limitada a la clase del administrador
-- Ejecutar en Supabase SQL Editor después de setup.sql.
-- ════════════════════════════════════════════════════════════

-- 1) Añadir el ámbito de clase a los recursos gestionables.
ALTER TABLE public.apuntes
  ADD COLUMN IF NOT EXISTS clase TEXT;

ALTER TABLE public.eventos
  ADD COLUMN IF NOT EXISTS clase TEXT;

ALTER TABLE public.actividades
  ADD COLUMN IF NOT EXISTS clase TEXT;

-- 2) Rellenar los registros existentes con la clase de su autor.
UPDATE public.apuntes a
SET clase = u.clase
FROM public.usuarios u
WHERE a.usuario_id = u.id
  AND a.clase IS NULL;

UPDATE public.eventos e
SET clase = u.clase
FROM public.usuarios u
WHERE e.created_by = u.id
  AND e.clase IS NULL;

UPDATE public.actividades a
SET clase = u.clase
FROM public.usuarios u
WHERE a.created_by = u.id
  AND a.clase IS NULL;

CREATE INDEX IF NOT EXISTS idx_apuntes_clase ON public.apuntes (clase);
CREATE INDEX IF NOT EXISTS idx_eventos_clase ON public.eventos (clase);
CREATE INDEX IF NOT EXISTS idx_actividades_clase ON public.actividades (clase);

-- Funciones seguras para que las políticas no choquen con los permisos de columnas
-- restringidos de public.usuarios.
CREATE OR REPLACE FUNCTION public.tc_usuario_clase_actual()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT clase FROM public.usuarios WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.tc_usuario_rol_actual()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rol FROM public.usuarios WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.tc_usuario_es_superadmin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT es_superadmin FROM public.usuarios WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.tc_usuario_clase_actual() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tc_usuario_rol_actual() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tc_usuario_es_superadmin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tc_usuario_clase_actual() TO authenticated;
GRANT EXECUTE ON FUNCTION public.tc_usuario_rol_actual() TO authenticated;
GRANT EXECUTE ON FUNCTION public.tc_usuario_es_superadmin() TO authenticated;

-- Perfil público de solo lectura para abrirlo desde el chat.
DROP FUNCTION IF EXISTS public.get_perfil_publico(uuid);
CREATE FUNCTION public.get_perfil_publico(p_usuario_id UUID)
RETURNS TABLE (
  id UUID,
  nombre TEXT,
  avatar_url TEXT,
  rol TEXT,
  clase TEXT,
  es_superadmin BOOLEAN,
  bio TEXT,
  stack TEXT[],
  github_url TEXT,
  linkedin_url TEXT,
  portfolio_url TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.nombre, u.avatar_url, u.rol, u.clase, u.es_superadmin,
         u.bio, u.stack, u.github_url, u.linkedin_url, u.portfolio_url
  FROM public.usuarios u
  WHERE u.id = p_usuario_id;
$$;

REVOKE ALL ON FUNCTION public.get_perfil_publico(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_perfil_publico(UUID) TO authenticated;

-- 3) Usuarios: un admin gestiona usuarios de su clase; el superadmin conserva acceso global.
REVOKE UPDATE (es_superadmin) ON public.usuarios FROM authenticated;

DROP POLICY IF EXISTS "usuarios_update_own" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_update_admin" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_update_admin_clase" ON public.usuarios;

CREATE POLICY "usuarios_update_own" ON public.usuarios
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND rol = public.tc_usuario_rol_actual()
  );

CREATE POLICY "usuarios_update_admin_clase" ON public.usuarios
  FOR UPDATE TO authenticated
  USING (
    public.tc_usuario_es_superadmin() = true
    OR (
      public.tc_usuario_rol_actual() = 'admin'
      AND clase = public.tc_usuario_clase_actual()
    )
  )
  WITH CHECK (
    public.tc_usuario_es_superadmin() = true
    OR (
      public.tc_usuario_rol_actual() = 'admin'
      AND rol IN ('admin', 'alumno')
    )
  );

-- 4) Horario: un administrador solo puede escribir en su propia clase.
DROP POLICY IF EXISTS "horario_insert_admin" ON public.horario;
DROP POLICY IF EXISTS "horario_update_admin" ON public.horario;
DROP POLICY IF EXISTS "horario_delete_admin" ON public.horario;
DROP POLICY IF EXISTS "horario_insert_admin_clase" ON public.horario;
DROP POLICY IF EXISTS "horario_update_admin_clase" ON public.horario;
DROP POLICY IF EXISTS "horario_delete_admin_clase" ON public.horario;

CREATE POLICY "horario_insert_admin_clase" ON public.horario
  FOR INSERT TO authenticated
  WITH CHECK (
    clase = public.tc_usuario_clase_actual()
    AND public.tc_usuario_rol_actual() = 'admin'
  );

CREATE POLICY "horario_update_admin_clase" ON public.horario
  FOR UPDATE TO authenticated
  USING (
    clase = public.tc_usuario_clase_actual()
    AND public.tc_usuario_rol_actual() = 'admin'
  )
  WITH CHECK (
    clase = public.tc_usuario_clase_actual()
    AND public.tc_usuario_rol_actual() = 'admin'
  );

CREATE POLICY "horario_delete_admin_clase" ON public.horario
  FOR DELETE TO authenticated
  USING (
    clase = public.tc_usuario_clase_actual()
    AND public.tc_usuario_rol_actual() = 'admin'
  );

-- 5) Apuntes: solo admins gestionan apuntes de su clase.
DROP POLICY IF EXISTS "apuntes_insert_own" ON public.apuntes;
DROP POLICY IF EXISTS "apuntes_delete_own" ON public.apuntes;
DROP POLICY IF EXISTS "apuntes_insert_admin_clase" ON public.apuntes;
DROP POLICY IF EXISTS "apuntes_delete_admin_clase" ON public.apuntes;

CREATE POLICY "apuntes_insert_admin_clase" ON public.apuntes
  FOR INSERT TO authenticated
  WITH CHECK (
    usuario_id = auth.uid()
    AND clase = public.tc_usuario_clase_actual()
    AND public.tc_usuario_rol_actual() = 'admin'
  );

CREATE POLICY "apuntes_delete_admin_clase" ON public.apuntes
  FOR DELETE TO authenticated
  USING (
    clase = public.tc_usuario_clase_actual()
    AND public.tc_usuario_rol_actual() = 'admin'
  );

-- 6) Calendario: solo admins gestionan eventos de su clase.
DROP POLICY IF EXISTS "eventos_insert_admin" ON public.eventos;
DROP POLICY IF EXISTS "eventos_update_admin" ON public.eventos;
DROP POLICY IF EXISTS "eventos_delete_admin" ON public.eventos;
DROP POLICY IF EXISTS "eventos_insert_admin_clase" ON public.eventos;
DROP POLICY IF EXISTS "eventos_update_admin_clase" ON public.eventos;
DROP POLICY IF EXISTS "eventos_delete_admin_clase" ON public.eventos;

CREATE POLICY "eventos_insert_admin_clase" ON public.eventos
  FOR INSERT TO authenticated
  WITH CHECK (
    clase = public.tc_usuario_clase_actual()
    AND created_by = auth.uid()
    AND public.tc_usuario_rol_actual() = 'admin'
  );

CREATE POLICY "eventos_update_admin_clase" ON public.eventos
  FOR UPDATE TO authenticated
  USING (
    clase = public.tc_usuario_clase_actual()
    AND public.tc_usuario_rol_actual() = 'admin'
  )
  WITH CHECK (
    clase = public.tc_usuario_clase_actual()
    AND public.tc_usuario_rol_actual() = 'admin'
  );

CREATE POLICY "eventos_delete_admin_clase" ON public.eventos
  FOR DELETE TO authenticated
  USING (
    clase = public.tc_usuario_clase_actual()
    AND public.tc_usuario_rol_actual() = 'admin'
  );

-- 7) Actividades: solo admins gestionan actividades de su clase.
DROP POLICY IF EXISTS "actividades_insert_admin" ON public.actividades;
DROP POLICY IF EXISTS "actividades_update_admin" ON public.actividades;
DROP POLICY IF EXISTS "actividades_delete_admin" ON public.actividades;
DROP POLICY IF EXISTS "actividades_insert_admin_clase" ON public.actividades;
DROP POLICY IF EXISTS "actividades_update_admin_clase" ON public.actividades;
DROP POLICY IF EXISTS "actividades_delete_admin_clase" ON public.actividades;

CREATE POLICY "actividades_insert_admin_clase" ON public.actividades
  FOR INSERT TO authenticated
  WITH CHECK (
    clase = public.tc_usuario_clase_actual()
    AND created_by = auth.uid()
    AND public.tc_usuario_rol_actual() = 'admin'
  );

CREATE POLICY "actividades_update_admin_clase" ON public.actividades
  FOR UPDATE TO authenticated
  USING (
    clase = public.tc_usuario_clase_actual()
    AND public.tc_usuario_rol_actual() = 'admin'
  )
  WITH CHECK (
    clase = public.tc_usuario_clase_actual()
    AND public.tc_usuario_rol_actual() = 'admin'
  );

CREATE POLICY "actividades_delete_admin_clase" ON public.actividades
  FOR DELETE TO authenticated
  USING (
    clase = public.tc_usuario_clase_actual()
    AND public.tc_usuario_rol_actual() = 'admin'
  );

-- 8) Storage de apuntes: el admin puede borrar archivos de su clase.
DROP POLICY IF EXISTS "apuntes_storage_delete" ON storage.objects;
DROP POLICY IF EXISTS "apuntes_storage_delete_admin_clase" ON storage.objects;

CREATE OR REPLACE FUNCTION public.tc_puede_borrar_apunte_storage(storage_name TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.tc_usuario_rol_actual() = 'admin'
    AND EXISTS (
      SELECT 1
      FROM public.usuarios propietario
      WHERE propietario.id::text = split_part(storage_name, '/', 1)
        AND propietario.clase = public.tc_usuario_clase_actual()
    );
$$;

REVOKE ALL ON FUNCTION public.tc_puede_borrar_apunte_storage(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tc_puede_borrar_apunte_storage(TEXT) TO authenticated;

CREATE POLICY "apuntes_storage_delete_admin_clase" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'apuntes'
    AND public.tc_puede_borrar_apunte_storage(name)
  );

-- 9) Acceso por aprobación del administrador de la clase.
-- Los usuarios existentes se conservan aprobados; los registros nuevos
-- quedan pendientes hasta que un administrador de su clase los acepte.
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS estado_acceso TEXT NOT NULL DEFAULT 'aprobado'
  CHECK (estado_acceso IN ('pendiente', 'aprobado', 'rechazado'));

CREATE INDEX IF NOT EXISTS idx_usuarios_clase_estado
  ON public.usuarios (clase, estado_acceso);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.usuarios (id, nombre, email, promedio, rol, clase, estado_acceso)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    NEW.email,
    0,
    'alumno',
    NEW.raw_user_meta_data->>'clase',
    'pendiente'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tc_usuario_acceso_aprobado()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT estado_acceso = 'aprobado' FROM public.usuarios WHERE id = auth.uid()),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.tc_usuario_acceso_aprobado() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tc_usuario_acceso_aprobado() TO authenticated;

DROP FUNCTION IF EXISTS public.get_mi_perfil();
CREATE FUNCTION public.get_mi_perfil()
RETURNS TABLE (
  id uuid, nombre text, email text, promedio numeric, avatar_url text,
  banner_url text, rol text, clase text, es_superadmin boolean,
  estado_acceso text, created_at timestamptz
)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT u.id, u.nombre, u.email, u.promedio, u.avatar_url, u.banner_url,
         u.rol, u.clase, u.es_superadmin, u.estado_acceso, u.created_at
  FROM public.usuarios u
  WHERE u.id = auth.uid()
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_mi_perfil() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_mi_perfil() TO authenticated;

DROP FUNCTION IF EXISTS public.get_todos_usuarios();
CREATE FUNCTION public.get_todos_usuarios()
RETURNS TABLE (
  id uuid, nombre text, email text, promedio numeric, avatar_url text,
  banner_url text, rol text, clase text, es_superadmin boolean,
  estado_acceso text, created_at timestamptz
)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT u.id, u.nombre, u.email, u.promedio, u.avatar_url, u.banner_url,
         u.rol, u.clase, u.es_superadmin, u.estado_acceso, u.created_at
  FROM public.usuarios u
  WHERE EXISTS (
    SELECT 1 FROM public.usuarios admin
    WHERE admin.id = auth.uid()
      AND admin.rol = 'admin'
      AND admin.estado_acceso = 'aprobado'
  )
    AND (
      public.tc_usuario_es_superadmin() = true
      OR u.clase = public.tc_usuario_clase_actual()
    )
  ORDER BY u.estado_acceso = 'pendiente' DESC, u.nombre;
$$;
REVOKE ALL ON FUNCTION public.get_todos_usuarios() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_todos_usuarios() TO authenticated;

DO $$
DECLARE tabla TEXT;
BEGIN
  FOREACH tabla IN ARRAY ARRAY[
    'usuarios', 'notas', 'mensajes', 'apuntes',
    'mensajes_privados', 'eventos', 'actividades', 'actividades_estado',
    'anuncios', 'horario'
  ] LOOP
    IF to_regclass(format('public.%I', tabla)) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('DROP POLICY IF EXISTS "acceso_aprobado" ON public.%I', tabla);
    EXECUTE format(
      'CREATE POLICY "acceso_aprobado" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.tc_usuario_acceso_aprobado()) WITH CHECK (public.tc_usuario_acceso_aprobado())',
      tabla
    );
  END LOOP;
END $$;

-- 10) Los anuncios son una función exclusiva del superadministrador.
DROP POLICY IF EXISTS "anuncios_select_auth" ON public.anuncios;
DROP POLICY IF EXISTS "anuncios_insert_admin" ON public.anuncios;
DROP POLICY IF EXISTS "anuncios_update_admin" ON public.anuncios;
DROP POLICY IF EXISTS "anuncios_delete_admin" ON public.anuncios;
DROP POLICY IF EXISTS "anuncios_select_authenticated" ON public.anuncios;
DROP POLICY IF EXISTS "anuncios_insert_superadmin" ON public.anuncios;
DROP POLICY IF EXISTS "anuncios_update_superadmin" ON public.anuncios;
DROP POLICY IF EXISTS "anuncios_delete_superadmin" ON public.anuncios;

CREATE POLICY "anuncios_select_authenticated" ON public.anuncios
  FOR SELECT TO authenticated
  USING (public.tc_usuario_acceso_aprobado());

CREATE POLICY "anuncios_insert_superadmin" ON public.anuncios
  FOR INSERT TO authenticated
  WITH CHECK (public.tc_usuario_es_superadmin() = true);

CREATE POLICY "anuncios_update_superadmin" ON public.anuncios
  FOR UPDATE TO authenticated
  USING (public.tc_usuario_es_superadmin() = true)
  WITH CHECK (public.tc_usuario_es_superadmin() = true);

CREATE POLICY "anuncios_delete_superadmin" ON public.anuncios
  FOR DELETE TO authenticated
  USING (public.tc_usuario_es_superadmin() = true);
