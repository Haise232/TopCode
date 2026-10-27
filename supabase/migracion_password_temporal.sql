-- ════════════════════════════════════════════════════════════
-- Contraseñas temporales: quien olvida la suya pide una a un
-- administrador, entra con ella y TopCode le obliga a elegir una
-- nueva antes de nada.
--
-- - tc_password_temporal(usuario): la genera un admin aprobado (el
--   superadmin, para cualquiera; un admin de clase, solo para alumnos
--   de su clase). Cierra las sesiones abiertas de ese usuario y
--   devuelve la contraseña para pasársela.
-- - get_mi_perfil() devuelve debe_cambiar_password.
-- - tc_password_cambiada(): la llama la app tras updateUser. Solo
--   quita la marca si la contraseña ya no es la temporal (se compara
--   el hash): llamarla sin cambiarla no sirve para saltarse el cambio.
--
-- Aplicada en producción el 20/10/2026. Se puede ejecutar más de una
-- vez. Líneas cortas a propósito: al copiarla desde la terminal, las
-- largas se partían.
-- ════════════════════════════════════════════════════════════

-- 1) Quién tiene una contraseña temporal pendiente.
--    RLS sin políticas: solo la usan las funciones de abajo.
CREATE TABLE IF NOT EXISTS public.passwords_temporales (
  usuario_id uuid PRIMARY KEY
    REFERENCES public.usuarios(id) ON DELETE CASCADE,
  hash       text NOT NULL,
  creada_por uuid
    REFERENCES public.usuarios(id) ON DELETE SET NULL,
  creada_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.passwords_temporales
  ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.passwords_temporales
  FROM anon, authenticated;

-- 2) Generar la contraseña temporal (solo admins).
CREATE OR REPLACE FUNCTION public.tc_password_temporal(
  p_usuario uuid
)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- Sin 0/o ni 1/l/i: 32 símbolos.
  alfabeto constant text :=
    'abcdefghjkmnpqrstuvwxyz23456789';
  admin    public.usuarios%ROWTYPE;
  objetivo public.usuarios%ROWTYPE;
  bytes    bytea := extensions.gen_random_bytes(12);
  password text := '';
  nuevo    text;
BEGIN
  SELECT * INTO admin
  FROM public.usuarios WHERE id = auth.uid();

  IF admin.id IS NULL
     OR admin.rol <> 'admin'
     OR admin.estado_acceso <> 'aprobado' THEN
    RAISE EXCEPTION
      'Solo un administrador puede hacer esto'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO objetivo
  FROM public.usuarios WHERE id = p_usuario;

  IF objetivo.id IS NULL THEN
    RAISE EXCEPTION 'Ese usuario no existe'
      USING ERRCODE = 'P0002';
  END IF;

  IF objetivo.id = admin.id THEN
    RAISE EXCEPTION
      'No puedes generarte una a ti mismo'
      USING ERRCODE = '42501';
  END IF;

  -- Admin de clase: solo alumnos de su clase (así no puede
  -- quedarse con la cuenta de otro admin).
  IF NOT admin.es_superadmin AND (
       admin.clase IS NULL
       OR objetivo.clase IS DISTINCT FROM admin.clase
       OR objetivo.rol <> 'alumno'
       OR objetivo.es_superadmin
     ) THEN
    RAISE EXCEPTION
      'Solo puedes hacerlo con alumnos de tu clase'
      USING ERRCODE = '42501';
  END IF;

  -- Tres grupos de cuatro, p. ej. k7mp-q3rx-9tza (60 bits).
  FOR i IN 0..11 LOOP
    IF i > 0 AND i % 4 = 0 THEN
      password := password || '-';
    END IF;
    password := password || substr(
      alfabeto, (get_byte(bytes, i) % 32) + 1, 1
    );
  END LOOP;

  -- bcrypt coste 10, como Supabase Auth.
  nuevo := extensions.crypt(
    password, extensions.gen_salt('bf', 10)
  );

  UPDATE auth.users
  SET encrypted_password = nuevo, updated_at = now()
  WHERE id = p_usuario;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ese usuario no tiene cuenta'
      USING ERRCODE = 'P0002';
  END IF;

  -- Cierra sus sesiones abiertas.
  DELETE FROM auth.sessions WHERE user_id = p_usuario;

  INSERT INTO public.passwords_temporales
    (usuario_id, hash, creada_por)
  VALUES (p_usuario, nuevo, admin.id)
  ON CONFLICT (usuario_id) DO UPDATE
  SET hash       = EXCLUDED.hash,
      creada_por = EXCLUDED.creada_por,
      creada_at  = now();

  RETURN password;
END;
$$;
REVOKE ALL ON FUNCTION public.tc_password_temporal(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tc_password_temporal(uuid)
  TO authenticated;

-- 3) Quitar la marca cuando ya eligió su contraseña.
--    Solo si el hash ya no es el de la temporal.
CREATE OR REPLACE FUNCTION public.tc_password_cambiada()
RETURNS boolean
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH borrada AS (
    DELETE FROM public.passwords_temporales t
    USING auth.users u
    WHERE t.usuario_id = auth.uid()
      AND u.id = t.usuario_id
      AND u.encrypted_password IS DISTINCT FROM t.hash
    RETURNING 1
  )
  SELECT NOT EXISTS (
           SELECT 1 FROM public.passwords_temporales
           WHERE usuario_id = auth.uid()
         )
      OR EXISTS (SELECT 1 FROM borrada);
$$;
REVOKE ALL ON FUNCTION public.tc_password_cambiada()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tc_password_cambiada()
  TO authenticated;

-- 4) get_mi_perfil() con debe_cambiar_password (cambia el tipo de
--    retorno: hay que recrearla; ejecutar todo el archivo de una vez).
DROP FUNCTION IF EXISTS public.get_mi_perfil();
CREATE FUNCTION public.get_mi_perfil()
RETURNS TABLE (
  id                    uuid,
  nombre                text,
  email                 text,
  promedio              numeric,
  avatar_url            text,
  banner_url            text,
  rol                   text,
  clase                 text,
  es_superadmin         boolean,
  estado_acceso         text,
  created_at            timestamptz,
  debe_cambiar_password boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.nombre, u.email, u.promedio,
         u.avatar_url, u.banner_url, u.rol, u.clase,
         u.es_superadmin, u.estado_acceso, u.created_at,
         EXISTS (
           SELECT 1 FROM public.passwords_temporales t
           WHERE t.usuario_id = u.id
         )
  FROM public.usuarios u
  WHERE u.id = auth.uid()
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_mi_perfil() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_mi_perfil()
  TO anon, authenticated, service_role;
