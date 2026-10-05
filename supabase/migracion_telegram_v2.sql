-- ============================================================
-- TopCode - Bot de Telegram: migracion v2 (correcciones de auditoria)
-- Ejecuta este archivo en Supabase SQL Editor (idempotente) SOBRE
-- migracion_telegram.sql (v1) ya aplicada.
--
-- Cambios:
-- * telegram_vinculos.telegram_username (opcional, <= 64 caracteres).
-- * consumir_codigo_telegram: contador de fallos ATOMICO (se incrementa
--   antes de decidir) + limite global de 30 fallos/minuto. Nuevo contrato:
--   (p_codigo, p_telegram_id, p_telegram_username) ->
--   TABLE(usuario_id, telegram_anterior); 0 filas si falla.
-- * crear_evento_telegram: alta de evento desde el bot (solo service_role).
-- * generar_codigo_telegram: advisory lock por usuario, tolera colisiones
--   de PK entre usuarios y exige estado_acceso = 'aprobado'.
--
-- Limite global: fila centinela telegram_intentos.telegram_user_id = 0
-- (los Telegram ID reales son siempre > 0), con ventana de 1 minuto.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Columna telegram_username
-- ------------------------------------------------------------
ALTER TABLE public.telegram_vinculos
  ADD COLUMN IF NOT EXISTS telegram_username TEXT NULL;

-- ------------------------------------------------------------
-- 2) generar_codigo_telegram(): lock por usuario, colisiones, aprobado
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

  -- Serializa las llamadas concurrentes del mismo usuario (hasta el commit).
  PERFORM pg_advisory_xact_lock(hashtext('tg_codigo:' || v_uid::text));

  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios u
     WHERE u.id = v_uid
       AND u.rol = 'admin'
       AND u.clase IS NOT NULL
       AND u.estado_acceso = 'aprobado'
  ) THEN
    RAISE EXCEPTION 'Solo un administrador aprobado con clase puede vincular Telegram'
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

    -- Si otro usuario ha tomado el mismo codigo a la vez, no falla: reintenta.
    INSERT INTO public.telegram_codigos (codigo, usuario_id, expira_en)
    VALUES (v_codigo, v_uid, now() + interval '10 minutes')
    ON CONFLICT (codigo) DO NOTHING;

    EXIT WHEN FOUND;
  END LOOP;

  RETURN v_codigo;
END;
$$;

REVOKE ALL ON FUNCTION public.generar_codigo_telegram() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generar_codigo_telegram() TO authenticated;

-- ------------------------------------------------------------
-- 3) consumir_codigo_telegram(): contador atomico, limite global, nuevo contrato
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.consumir_codigo_telegram(text, bigint);
DROP FUNCTION IF EXISTS public.consumir_codigo_telegram(text, bigint, text);
CREATE FUNCTION public.consumir_codigo_telegram(
  p_codigo text,
  p_telegram_id bigint,
  p_telegram_username text
)
RETURNS TABLE (usuario_id uuid, telegram_anterior bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  c_max_fallos CONSTANT INT := 5;           -- por Telegram ID y hora
  c_max_global CONSTANT INT := 30;          -- global por minuto
  v_fallos INT;
  v_global INT;
  v_usuario UUID;
  v_anterior BIGINT;
  v_username TEXT;
BEGIN
  -- 0 es el centinela del limite global: no es un Telegram ID valido.
  IF p_telegram_id IS NULL OR p_telegram_id <= 0 OR p_codigo IS NULL THEN
    RETURN;
  END IF;

  PERFORM public.limpiar_telegram_caducados();

  -- Cada intento cuenta ANTES de decidir (un solo INSERT ... ON CONFLICT
  -- atomico): las peticiones concurrentes no pueden saltarse el limite.
  INSERT INTO public.telegram_intentos AS i (telegram_user_id, fallos, ventana_inicio)
  VALUES (p_telegram_id, 1, now())
  ON CONFLICT (telegram_user_id) DO UPDATE
    SET fallos = CASE WHEN i.ventana_inicio > now() - interval '1 hour'
                      THEN i.fallos + 1 ELSE 1 END,
        ventana_inicio = CASE WHEN i.ventana_inicio > now() - interval '1 hour'
                              THEN i.ventana_inicio ELSE now() END
  RETURNING i.fallos INTO v_fallos;

  INSERT INTO public.telegram_intentos AS i (telegram_user_id, fallos, ventana_inicio)
  VALUES (0, 1, now())
  ON CONFLICT (telegram_user_id) DO UPDATE
    SET fallos = CASE WHEN i.ventana_inicio > now() - interval '1 minute'
                      THEN i.fallos + 1 ELSE 1 END,
        ventana_inicio = CASE WHEN i.ventana_inicio > now() - interval '1 minute'
                              THEN i.ventana_inicio ELSE now() END
  RETURNING i.fallos INTO v_global;

  -- Limite superado: sin resultado aunque el codigo fuera correcto.
  IF v_fallos > c_max_fallos OR v_global > c_max_global THEN
    RETURN;
  END IF;

  -- Consumo atomico: un solo ganador aunque haya peticiones concurrentes.
  -- El usuario debe seguir siendo admin aprobado con clase (replica la RLS
  -- de eventos); si no, el codigo no se consume y cuenta como fallo.
  IF p_codigo ~ '^[0-9]{6}$' THEN
    UPDATE public.telegram_codigos AS c
       SET usado_en = now()
      FROM public.usuarios AS u
     WHERE c.codigo = p_codigo
       AND c.usado_en IS NULL
       AND c.expira_en > now()
       AND u.id = c.usuario_id
       AND u.rol = 'admin'
       AND u.clase IS NOT NULL
       AND u.estado_acceso = 'aprobado'
    RETURNING c.usuario_id INTO v_usuario;
  END IF;

  IF v_usuario IS NULL THEN
    RETURN;
  END IF;

  -- Acierto: se resetea el contador del Telegram ID y el acierto no cuenta
  -- para el limite global de fallos.
  DELETE FROM public.telegram_intentos WHERE telegram_user_id = p_telegram_id;
  UPDATE public.telegram_intentos
     SET fallos = GREATEST(fallos - 1, 0)
   WHERE telegram_user_id = 0;

  v_username := NULLIF(left(btrim(p_telegram_username), 64), '');

  -- Un usuario = una cuenta de Telegram; una cuenta de Telegram = un usuario.
  -- Se devuelve el Telegram ID previo del usuario (si era otro) para avisarle.
  DELETE FROM public.telegram_vinculos AS v
   WHERE v.usuario_id = v_usuario AND v.telegram_user_id <> p_telegram_id
  RETURNING v.telegram_user_id INTO v_anterior;

  IF v_anterior IS NOT NULL THEN
    DELETE FROM public.telegram_pendientes WHERE telegram_user_id = v_anterior;
  END IF;

  INSERT INTO public.telegram_vinculos (telegram_user_id, usuario_id, telegram_username)
  VALUES (p_telegram_id, v_usuario, v_username)
  ON CONFLICT (telegram_user_id) DO UPDATE
    SET usuario_id = EXCLUDED.usuario_id,
        telegram_username = EXCLUDED.telegram_username,
        created_at = now();

  RETURN QUERY SELECT v_usuario, v_anterior;
END;
$$;

REVOKE ALL ON FUNCTION public.consumir_codigo_telegram(text, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consumir_codigo_telegram(text, bigint, text) TO service_role;

-- ------------------------------------------------------------
-- 4) crear_evento_telegram(): solo service_role (Edge Function)
--    Devuelve el id del evento o NULL (no autorizado o datos invalidos).
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.crear_evento_telegram(bigint, text, date, text, text);
CREATE FUNCTION public.crear_evento_telegram(
  p_telegram_id bigint,
  p_titulo text,
  p_fecha date,
  p_hora text,
  p_materia text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_titulo TEXT := btrim(p_titulo);
  v_materia TEXT := NULLIF(btrim(p_materia), '');
  v_id UUID;
BEGIN
  IF p_telegram_id IS NULL
     OR v_titulo IS NULL OR v_titulo = '' OR char_length(v_titulo) > 120
     OR p_fecha IS NULL
     OR p_fecha < current_date - 1
     OR p_fecha > (current_date + interval '2 years')::date
     OR (p_hora IS NOT NULL AND p_hora !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
     OR (v_materia IS NOT NULL AND char_length(v_materia) > 120)
  THEN
    RETURN NULL;
  END IF;

  -- Una sola sentencia: autoriza (vinculo + admin aprobado con clase) e inserta.
  INSERT INTO public.eventos (titulo, descripcion, fecha, hora, materia, clase, created_by)
  SELECT v_titulo, NULL, p_fecha, p_hora, v_materia, u.clase, u.id
    FROM public.usuarios AS u
    JOIN public.telegram_vinculos AS v ON v.usuario_id = u.id
   WHERE v.telegram_user_id = p_telegram_id
     AND u.rol = 'admin'
     AND u.clase IS NOT NULL
     AND u.estado_acceso = 'aprobado'
  RETURNING id INTO v_id;

  RETURN v_id;  -- NULL si no esta autorizado
END;
$$;

REVOKE ALL ON FUNCTION public.crear_evento_telegram(bigint, text, date, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crear_evento_telegram(bigint, text, date, text, text) TO service_role;
