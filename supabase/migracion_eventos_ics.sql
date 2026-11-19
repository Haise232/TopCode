-- ════════════════════════════════════════════════════════════
-- migracion_eventos_ics.sql
-- Importar calendarios .ics (Moodle / Campus) sin repetir eventos:
-- guarda el UID del evento original y no deja meterlo dos veces.
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS uid_externo TEXT;
-- Índice completo (los NULL no chocan) para poder usar upsert con on_conflict
CREATE UNIQUE INDEX IF NOT EXISTS uq_eventos_uid_externo ON public.eventos (uid_externo);
COMMENT ON COLUMN public.eventos.uid_externo IS 'UID del evento en un calendario importado (.ics de Moodle); evita importarlo dos veces.';
