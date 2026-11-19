-- ════════════════════════════════════════════════════════════
-- migracion_faltas.sql
-- Registro personal de faltas: cada fila es una hora (sesión) faltada
-- en un módulo. Solo la ve y la toca su dueño.
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.faltas (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   UUID        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  modulo       TEXT        NOT NULL CHECK (char_length(modulo) BETWEEN 1 AND 10),
  fecha        DATE        NOT NULL DEFAULT current_date,
  -- Hora de la sesión del horario ('HH:MM'); NULL si se añadió a mano
  hora_inicio  TEXT        CHECK (hora_inicio IS NULL OR hora_inicio ~ '^\d{2}:\d{2}$'),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_faltas_usuario ON public.faltas (usuario_id, fecha DESC);
-- Una misma sesión no se puede marcar dos veces (las manuales, con hora NULL, no chocan).
-- Índice completo, no parcial, para que el upsert con on_conflict de la importación funcione.
CREATE UNIQUE INDEX IF NOT EXISTS uq_faltas_sesion
  ON public.faltas (usuario_id, fecha, hora_inicio);

ALTER TABLE public.faltas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "faltas_select_own" ON public.faltas;
CREATE POLICY "faltas_select_own" ON public.faltas
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = usuario_id);

DROP POLICY IF EXISTS "faltas_insert_own" ON public.faltas;
CREATE POLICY "faltas_insert_own" ON public.faltas
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = usuario_id);

DROP POLICY IF EXISTS "faltas_delete_own" ON public.faltas;
CREATE POLICY "faltas_delete_own" ON public.faltas
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = usuario_id);

GRANT SELECT, INSERT, DELETE ON public.faltas TO authenticated;

-- ────────────────────────────────────────────────────────────
-- Faltas justificadas: cuentan un 25 % menos (0,75 h por sesión).
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.faltas ADD COLUMN IF NOT EXISTS justificada BOOLEAN NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "faltas_update_own" ON public.faltas;
CREATE POLICY "faltas_update_own" ON public.faltas
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = usuario_id)
  WITH CHECK ((SELECT auth.uid()) = usuario_id);

GRANT UPDATE ON public.faltas TO authenticated;
