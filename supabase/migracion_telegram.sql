-- ============================================================
-- TopCode - Bot de Telegram para crear eventos del calendario
-- Ejecuta este archivo en Supabase SQL Editor (idempotente).
-- Depende de: migracion_permisos_por_clase.sql (tc_usuario_*_actual).
--
-- Decisiones:
-- * El codigo de vinculacion se guarda en claro: tiene solo 6 digitos
--   (1e6 combinaciones), un hash no aporta proteccion real; la defensa es
--   caducidad corta (10 min), uso unico, un solo codigo vivo por usuario,
--   limite de fallos por Telegram ID y que la tabla no es legible por
--   anon/authenticated (RLS sin politicas + REVOKE).
-- * Todas las tablas telegram_* tienen RLS activada. Solo el usuario ve y
--   borra su propio vinculo; el resto solo lo toca service_role / funciones
--   SECURITY DEFINER.
-- ============================================================

-- gen_random_bytes() vive en pgcrypto (esquema extensions en Supabase).
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ------------------------------------------------------------
-- 1) Tablas
-- ------------------------------------------------------------

-- Vinculo Telegram <-> usuario (1 a 1).
CREATE TABLE IF NOT EXISTS public.telegram_vinculos (
  telegram_user_id BIGINT PRIMARY KEY,
  usuario_id UUID NOT NULL UNIQUE REFERENCES public.usuarios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Codigos de vinculacion de un solo uso.
CREATE TABLE IF NOT EXISTS public.telegram_codigos (
  codigo TEXT PRIMARY KEY CHECK (codigo ~ '^[0-9]{6}$'),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  expira_en TIMESTAMPTZ NOT NULL,
  usado_en TIMESTAMPTZ
);

-- Eventos pendientes de confirmar (botones OK/cancelar).
CREATE TABLE IF NOT EXISTS public.telegram_pendientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT NOT NULL,
  payload JSONB NOT NULL,
  expira_en TIMESTAMPTZ NOT NULL
);

-- Control de fuerza bruta: fallos de codigo por Telegram ID.
CREATE TABLE IF NOT EXISTS public.telegram_intentos (
  telegram_user_id BIGINT PRIMARY KEY,
  fallos INT NOT NULL DEFAULT 0,
  ventana_inicio TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 2) Indices
-- ------------------------------------------------------------
-- (usuario_id ya tiene indice unico en telegram_vinculos)
CREATE INDEX IF NOT EXISTS idx_telegram_codigos_usuario ON public.telegram_codigos (usuario_id);
CREATE INDEX IF NOT EXISTS idx_telegram_codigos_expira ON public.telegram_codigos (expira_en);
-- Un unico codigo vivo (sin usar) por usuario, tambien a nivel de BD.
CREATE UNIQUE INDEX IF NOT EXISTS uq_telegram_codigos_vivo_por_usuario
  ON public.telegram_codigos (usuario_id) WHERE usado_en IS NULL;
CREATE INDEX IF NOT EXISTS idx_telegram_pendientes_expira ON public.telegram_pendientes (expira_en);
CREATE INDEX IF NOT EXISTS idx_telegram_pendientes_tg ON public.telegram_pendientes (telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_intentos_ventana ON public.telegram_intentos (ventana_inicio);

-- ------------------------------------------------------------
-- 3) RLS y privilegios de tabla
-- ------------------------------------------------------------
ALTER TABLE public.telegram_vinculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_codigos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_pendientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_intentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "telegram_vinculos_select_propio" ON public.telegram_vinculos;
CREATE POLICY "telegram_vinculos_select_propio" ON public.telegram_vinculos
  FOR SELECT TO authenticated
  USING (usuario_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "telegram_vinculos_delete_propio" ON public.telegram_vinculos;
CREATE POLICY "telegram_vinculos_delete_propio" ON public.telegram_vinculos
  FOR DELETE TO authenticated
  USING (usuario_id = (SELECT auth.uid()));

-- Sin politicas en codigos, pendientes e intentos: nadie salvo service_role
-- y las funciones SECURITY DEFINER puede leer/escribir.
REVOKE ALL ON public.telegram_vinculos, public.telegram_codigos,
              public.telegram_pendientes, public.telegram_intentos
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.telegram_vinculos TO authenticated;
GRANT ALL ON public.telegram_vinculos, public.telegram_codigos,
             public.telegram_pendientes, public.telegram_intentos
  TO service_role;

-- ------------------------------------------------------------
-- 4) Limpieza de filas caducadas
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.limpiar_telegram_caducados();
CREATE FUNCTION public.limpiar_telegram_caducados()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  DELETE FROM public.telegram_codigos
   WHERE expira_en < now() - interval '1 hour'
      OR usado_en < now() - interval '1 hour';
  DELETE FROM public.telegram_pendientes WHERE expira_en < now();
  DELETE FROM public.telegram_intentos WHERE ventana_inicio < now() - interval '1 hour';
$$;

REVOKE ALL ON FUNCTION public.limpiar_telegram_caducados() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.limpiar_telegram_caducados() TO service_role;

-- ------------------------------------------------------------
-- 5) generar_codigo_telegram(): solo admin con clase
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.generar_codigo_telegram();
CREATE FUNCTION public.generar_codigo_telegram()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_codigo TEXT;
  v_n BIGINT;
  v_bytes BYTEA;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  IF public.tc_usuario_rol_actual() IS DISTINCT FROM 'admin'
     OR public.tc_usuario_clase_actual() IS NULL THEN
    RAISE EXCEPTION 'Solo un administrador con clase puede vincular Telegram'
      USING ERRCODE = '42501';
  END IF;

  PERFORM public.limpiar_telegram_caducados();

  -- Invalida cualquier codigo previo del usuario (vivo, usado o caducado).
  DELETE FROM public.telegram_codigos WHERE usuario_id = v_uid;

  LOOP
    -- 4 bytes aleatorios criptograficos -> entero sin signo; se descartan los
    -- valores >= 4294000000 para que el modulo 1e6 sea uniforme.
    v_bytes := extensions.gen_random_bytes(4);
    v_n := (get_byte(v_bytes, 0)::BIGINT << 24)
         + (get_byte(v_bytes, 1)::BIGINT << 16)
         + (get_byte(v_bytes, 2)::BIGINT << 8)
         +  get_byte(v_bytes, 3)::BIGINT;
    CONTINUE WHEN v_n >= 4294000000;

    v_codigo := lpad((v_n % 1000000)::TEXT, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.telegram_codigos WHERE codigo = v_codigo);
  END LOOP;

  INSERT INTO public.telegram_codigos (codigo, usuario_id, expira_en)
  VALUES (v_codigo, v_uid, now() + interval '10 minutes');

  RETURN v_codigo;
END;
$$;

REVOKE ALL ON FUNCTION public.generar_codigo_telegram() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generar_codigo_telegram() TO authenticated;

-- ------------------------------------------------------------
-- 6) desvincular_telegram()
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.desvincular_telegram();
CREATE FUNCTION public.desvincular_telegram()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  -- Tambien invalida pendientes del Telegram ID y codigos vivos.
  DELETE FROM public.telegram_pendientes
   WHERE telegram_user_id IN (
     SELECT telegram_user_id FROM public.telegram_vinculos WHERE usuario_id = v_uid
   );
  DELETE FROM public.telegram_codigos WHERE usuario_id = v_uid;
  DELETE FROM public.telegram_vinculos WHERE usuario_id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.desvincular_telegram() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.desvincular_telegram() TO authenticated;

-- ------------------------------------------------------------
-- 7) consumir_codigo_telegram(): solo service_role (Edge Function)
--    Devuelve usuario_id o NULL (codigo invalido/caducado/usado,
--    bloqueado por fallos, o usuario ya no es admin con clase).
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.consumir_codigo_telegram(text, bigint);
CREATE FUNCTION public.consumir_codigo_telegram(p_codigo text, p_telegram_id bigint)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c_max_fallos CONSTANT INT := 5;
  v_usuario UUID;
  v_fallos INT;
  v_ventana TIMESTAMPTZ;
BEGIN
  IF p_telegram_id IS NULL OR p_codigo IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM public.limpiar_telegram_caducados();

  -- Bloqueo temporal: 5 fallos dentro de la ventana de 1 hora.
  SELECT fallos, ventana_inicio INTO v_fallos, v_ventana
    FROM public.telegram_intentos WHERE telegram_user_id = p_telegram_id;
  IF FOUND AND v_ventana > now() - interval '1 hour' AND v_fallos >= c_max_fallos THEN
    RETURN NULL;
  END IF;

  -- Consumo atomico: un solo ganador aunque haya peticiones concurrentes.
  IF p_codigo ~ '^[0-9]{6}$' THEN
    UPDATE public.telegram_codigos
       SET usado_en = now()
     WHERE codigo = p_codigo
       AND usado_en IS NULL
       AND expira_en > now()
    RETURNING usuario_id INTO v_usuario;
  END IF;

  -- Fallo: contabilizar (reinicia la ventana si ya caduco).
  IF v_usuario IS NULL THEN
    INSERT INTO public.telegram_intentos AS i (telegram_user_id, fallos, ventana_inicio)
    VALUES (p_telegram_id, 1, now())
    ON CONFLICT (telegram_user_id) DO UPDATE
      SET fallos = CASE WHEN i.ventana_inicio > now() - interval '1 hour'
                        THEN i.fallos + 1 ELSE 1 END,
          ventana_inicio = CASE WHEN i.ventana_inicio > now() - interval '1 hour'
                                THEN i.ventana_inicio ELSE now() END;
    RETURN NULL;
  END IF;

  -- El usuario debe seguir siendo admin con clase (replica la RLS de eventos).
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios
     WHERE id = v_usuario AND rol = 'admin' AND clase IS NOT NULL
  ) THEN
    RETURN NULL;
  END IF;

  DELETE FROM public.telegram_intentos WHERE telegram_user_id = p_telegram_id;

  -- Un usuario = una cuenta de Telegram; una cuenta de Telegram = un usuario.
  DELETE FROM public.telegram_vinculos
   WHERE usuario_id = v_usuario AND telegram_user_id <> p_telegram_id;

  INSERT INTO public.telegram_vinculos (telegram_user_id, usuario_id)
  VALUES (p_telegram_id, v_usuario)
  ON CONFLICT (telegram_user_id) DO UPDATE
    SET usuario_id = EXCLUDED.usuario_id, created_at = now();

  RETURN v_usuario;
END;
$$;

REVOKE ALL ON FUNCTION public.consumir_codigo_telegram(text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consumir_codigo_telegram(text, bigint) TO service_role;
