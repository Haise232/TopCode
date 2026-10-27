-- ============================================================
-- migracion_seguridad.sql
-- Cierra escaladas de privilegios en public.usuarios y ajusta
-- las políticas de Storage. Idempotente: se puede ejecutar
-- varias veces.
--
-- Problema: `GRANT UPDATE ON public.usuarios TO authenticated`
-- es un grant de tabla completa, así que el
-- `REVOKE UPDATE (es_superadmin)` de migracion_permisos_por_clase.sql
-- no tiene efecto. Cualquier alumno aprobado podía hacer
--   update usuarios set es_superadmin = true where id = auth.uid()
-- y también cambiar su promedio, email o clase.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Grants: anon no escribe nunca, nadie borra desde el cliente
-- ────────────────────────────────────────────────────────────
REVOKE INSERT, UPDATE, DELETE ON public.usuarios FROM anon;
REVOKE DELETE ON public.usuarios FROM authenticated;

-- ────────────────────────────────────────────────────────────
-- 2. Trigger que protege las columnas sensibles
--   SECURITY INVOKER a propósito: `current_user` es el rol de quien
--   hace la consulta. Las funciones SECURITY DEFINER (recalcular_promedio,
--   handle_new_user) y el service_role no se ven afectadas.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tc_proteger_usuarios()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- El perfil lo crea handle_new_user; desde el cliente solo se
    -- permite la fila propia con valores por defecto.
    NEW.rol           := 'alumno';
    NEW.es_superadmin := false;
    NEW.estado_acceso := 'pendiente';
    NEW.promedio      := 0;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF public.tc_usuario_es_superadmin() THEN
    RETURN NEW;
  END IF;

  IF NEW.id            IS DISTINCT FROM OLD.id
  OR NEW.email         IS DISTINCT FROM OLD.email
  OR NEW.es_superadmin IS DISTINCT FROM OLD.es_superadmin
  OR NEW.promedio      IS DISTINCT FROM OLD.promedio
  OR NEW.clase         IS DISTINCT FROM OLD.clase THEN
    RAISE EXCEPTION 'No tienes permiso para modificar estos campos'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.id = auth.uid() THEN
    -- Perfil propio: no puede cambiarse el rol ni el estado de acceso.
    IF NEW.rol           IS DISTINCT FROM OLD.rol
    OR NEW.estado_acceso IS DISTINCT FROM OLD.estado_acceso THEN
      RAISE EXCEPTION 'No puedes cambiar tu propio rol o estado de acceso'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    -- Admin de clase sobre otro usuario (la RLS ya exige misma clase):
    -- solo puede tocar rol y estado_acceso.
    IF NEW.nombre        IS DISTINCT FROM OLD.nombre
    OR NEW.avatar_url    IS DISTINCT FROM OLD.avatar_url
    OR NEW.banner_url    IS DISTINCT FROM OLD.banner_url
    OR NEW.bio           IS DISTINCT FROM OLD.bio
    OR NEW.stack         IS DISTINCT FROM OLD.stack
    OR NEW.github_url    IS DISTINCT FROM OLD.github_url
    OR NEW.linkedin_url  IS DISTINCT FROM OLD.linkedin_url
    OR NEW.portfolio_url IS DISTINCT FROM OLD.portfolio_url
    OR NEW.push_token    IS DISTINCT FROM OLD.push_token THEN
      RAISE EXCEPTION 'Solo puedes cambiar el rol y el estado de acceso de otros usuarios'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tc_proteger_usuarios ON public.usuarios;
CREATE TRIGGER tc_proteger_usuarios
  BEFORE INSERT OR UPDATE ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.tc_proteger_usuarios();

-- ────────────────────────────────────────────────────────────
-- 3. Storage
-- ────────────────────────────────────────────────────────────

-- 3.1 avatars: políticas antiguas que dejaban a cualquier usuario
--     sobrescribir o subir en la carpeta de otro. Las versiones
--     *_own (carpeta = auth.uid()) siguen vigentes.
DROP POLICY IF EXISTS "avatars: actualizar propio" ON storage.objects;
DROP POLICY IF EXISTS "avatars: subir propio"      ON storage.objects;

-- 3.2 apuntes: alinear la subida con la tabla public.apuntes,
--     que solo admite inserts de admins (o superadmin).
DROP POLICY IF EXISTS "apuntes_storage_insert" ON storage.objects;
CREATE POLICY "apuntes_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'apuntes'
    AND (auth.uid())::text = (storage.foldername(name))[1]
    AND (
      public.tc_usuario_rol_actual() = 'admin'
      OR public.tc_usuario_es_superadmin() = true
    )
  );
