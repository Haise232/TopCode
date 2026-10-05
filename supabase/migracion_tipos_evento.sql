-- ============================================================
-- TopCode - Tipos de evento: migracion
-- Ejecuta este archivo en Supabase SQL Editor (idempotente) SOBRE
-- migracion_telegram_v2.sql ya aplicada.
--
-- Cambios:
-- * eventos.tipo: 'actividad' | 'trabajo' | 'examen_teorico' | 'examen_practico'
--   | 'presentacion' | 'especial' (NOT NULL, por defecto 'actividad').
--   Las filas existentes se clasifican a partir del titulo.
-- * Indice eventos (clase, fecha).
-- * crear_evento_telegram: nuevo parametro p_tipo (6 argumentos).
--   p_tipo NULL -> 'actividad'; valor no valido -> NULL.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Columna tipo: se anade como NULL (sin rellenar las filas
--    existentes), se fija el DEFAULT para las filas nuevas, se
--    clasifican las existentes y despues se pasa a NOT NULL.
-- ------------------------------------------------------------
ALTER TABLE public.eventos
  ADD COLUMN IF NOT EXISTS tipo TEXT NULL;

ALTER TABLE public.eventos
  ALTER COLUMN tipo SET DEFAULT 'actividad';

-- Backfill (solo filas sin tipo) segun el titulo, con y sin tildes.
-- Se anade un espacio final al titulo para que 'expo ' case al final.
UPDATE public.eventos
   SET tipo = CASE
         WHEN lower(titulo) ~ '(examen|parcial|final|quiz|evaluac)' THEN
           CASE
             WHEN lower(titulo) ~ '(practic|práctic)' THEN 'examen_practico'
             ELSE 'examen_teorico'
           END
         WHEN lower(titulo || ' ') ~ '(presentaci|exposici|expo )' THEN 'presentacion'
         WHEN lower(titulo) ~ '(trabajo|proyecto)' THEN 'trabajo'
         WHEN lower(titulo) ~ '(clase|taller|seminario|charla|excursi|especial)' THEN 'especial'
         ELSE 'actividad'
       END
 WHERE tipo IS NULL;

ALTER TABLE public.eventos
  ALTER COLUMN tipo SET NOT NULL;

ALTER TABLE public.eventos
  DROP CONSTRAINT IF EXISTS eventos_tipo_check;
ALTER TABLE public.eventos
  ADD CONSTRAINT eventos_tipo_check
  CHECK (tipo IN ('actividad', 'trabajo', 'examen_teorico', 'examen_practico', 'presentacion', 'especial'));

-- ------------------------------------------------------------
-- 2) Indice (clase, fecha)
--    Existentes: idx_eventos_fecha (fecha) e idx_eventos_clase (clase);
--    ninguno cubre la consulta por clase ordenada por fecha.
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_eventos_clase_fecha
  ON public.eventos (clase, fecha);

-- ------------------------------------------------------------
-- 3) crear_evento_telegram(): ahora con p_tipo (solo service_role)
--    Devuelve el id del evento o NULL (no autorizado o datos invalidos).
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.crear_evento_telegram(bigint, text, date, text, text);
DROP FUNCTION IF EXISTS public.crear_evento_telegram(bigint, text, date, text, text, text);
CREATE FUNCTION public.crear_evento_telegram(
  p_telegram_id bigint,
  p_titulo text,
  p_fecha date,
  p_hora text,
  p_materia text,
  p_tipo text
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
  v_id UUID;
BEGIN
  IF p_telegram_id IS NULL
     OR v_titulo IS NULL OR v_titulo = '' OR char_length(v_titulo) > 120
     OR p_fecha IS NULL
     OR p_fecha < current_date - 1
     OR p_fecha > (current_date + interval '2 years')::date
     OR (p_hora IS NOT NULL AND p_hora !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
     OR (v_materia IS NOT NULL AND char_length(v_materia) > 120)
     OR v_tipo NOT IN ('actividad', 'trabajo', 'examen_teorico', 'examen_practico', 'presentacion', 'especial')
  THEN
    RETURN NULL;
  END IF;

  -- Una sola sentencia: autoriza (vinculo + admin aprobado con clase) e inserta.
  INSERT INTO public.eventos (titulo, descripcion, fecha, hora, materia, clase, tipo, created_by)
  SELECT v_titulo, NULL, p_fecha, p_hora, v_materia, u.clase, v_tipo, u.id
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

REVOKE ALL ON FUNCTION public.crear_evento_telegram(bigint, text, date, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crear_evento_telegram(bigint, text, date, text, text, text) TO service_role;
