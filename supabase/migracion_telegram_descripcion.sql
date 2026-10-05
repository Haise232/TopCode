-- ============================================================
-- TopCode - Bot de Telegram: descripcion opcional
-- Ejecuta este archivo en Supabase SQL Editor (idempotente) SOBRE
-- migracion_tipos_evento.sql ya aplicada.
--
-- Cambios:
-- * crear_evento_telegram: nuevo parametro p_descripcion (7 argumentos,
--   DEFAULT NULL). Vacia -> NULL; mas de 1000 caracteres -> NULL (no inserta).
-- ============================================================

DROP FUNCTION IF EXISTS public.crear_evento_telegram(bigint, text, date, text, text, text);
DROP FUNCTION IF EXISTS public.crear_evento_telegram(bigint, text, date, text, text, text, text);
CREATE FUNCTION public.crear_evento_telegram(
  p_telegram_id bigint,
  p_titulo text,
  p_fecha date,
  p_hora text,
  p_materia text,
  p_tipo text,
  p_descripcion text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_titulo TEXT := btrim(p_titulo);
  v_materia TEXT := NULLIF(btrim(p_materia), '');
  v_tipo TEXT := COALESCE(p_tipo, 'actividad');
  v_descripcion TEXT := NULLIF(btrim(p_descripcion), '');
  v_id UUID;
BEGIN
  IF p_telegram_id IS NULL
     OR v_titulo IS NULL OR v_titulo = '' OR char_length(v_titulo) > 120
     OR p_fecha IS NULL
     OR p_fecha < current_date - 1
     OR p_fecha > (current_date + interval '2 years')::date
     OR (p_hora IS NOT NULL AND p_hora !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
     OR (v_materia IS NOT NULL AND char_length(v_materia) > 120)
     OR (v_descripcion IS NOT NULL AND char_length(v_descripcion) > 1000)
     OR v_tipo NOT IN ('actividad', 'trabajo', 'examen_teorico', 'examen_practico', 'presentacion', 'especial')
  THEN
    RETURN NULL;
  END IF;

  -- Una sola sentencia: autoriza (vinculo + admin aprobado con clase) e inserta.
  INSERT INTO public.eventos (titulo, descripcion, fecha, hora, materia, clase, tipo, created_by)
  SELECT v_titulo, v_descripcion, p_fecha, p_hora, v_materia, u.clase, v_tipo, u.id
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

REVOKE ALL ON FUNCTION public.crear_evento_telegram(bigint, text, date, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crear_evento_telegram(bigint, text, date, text, text, text, text) TO service_role;
