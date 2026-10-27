-- ============================================================
-- TopCode - Calendario: integracion de Actividades
-- Ejecuta este archivo en Supabase SQL Editor (idempotente) SOBRE
-- migracion_tipos_evento.sql y migracion_permisos_por_clase.sql ya aplicadas.
--
-- Cambios:
-- * public.eventos_estado: "marcar como hecha" por alumno y evento
--   (sustituye a actividades_estado en la web). Solo aplica a eventos
--   de tipo 'actividad' o 'trabajo' de la clase del usuario.
-- * public.eventos entra en la publicacion supabase_realtime.
-- * actividades / actividades_estado se conservan (la app movil las usa);
--   solo se marcan como obsoletas en la web.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tabla eventos_estado
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.eventos_estado (
  evento_id  UUID NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  completada BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (evento_id, usuario_id)
);

COMMENT ON TABLE public.eventos_estado IS
  'Estado de completado por alumno de los eventos tipo actividad/trabajo. PK (evento_id, usuario_id), usada por upsert.';

CREATE INDEX IF NOT EXISTS idx_eventos_estado_usuario_id
  ON public.eventos_estado (usuario_id);

-- ------------------------------------------------------------
-- 2) RLS
--    Alumnos: leen sus filas; escriben solo sus filas y solo de eventos
--    de su clase con tipo 'actividad' o 'trabajo'.
--    Admins: leen las filas de los eventos de SU clase (estadisticas).
--    Restrictiva acceso_aprobado como en el resto de tablas.
-- ------------------------------------------------------------
ALTER TABLE public.eventos_estado ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ee_select_own"   ON public.eventos_estado;
DROP POLICY IF EXISTS "ee_select_admin" ON public.eventos_estado;
DROP POLICY IF EXISTS "ee_insert_own"   ON public.eventos_estado;
DROP POLICY IF EXISTS "ee_update_own"   ON public.eventos_estado;
DROP POLICY IF EXISTS "ee_delete_own"   ON public.eventos_estado;
DROP POLICY IF EXISTS "acceso_aprobado" ON public.eventos_estado;

CREATE POLICY "ee_select_own" ON public.eventos_estado
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY "ee_select_admin" ON public.eventos_estado
  FOR SELECT TO authenticated
  USING (
    public.tc_usuario_rol_actual() = 'admin'
    AND EXISTS (
      SELECT 1 FROM public.eventos e
       WHERE e.id = eventos_estado.evento_id
         AND e.clase = public.tc_usuario_clase_actual()
    )
  );

CREATE POLICY "ee_insert_own" ON public.eventos_estado
  FOR INSERT TO authenticated
  WITH CHECK (
    usuario_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.eventos e
       WHERE e.id = eventos_estado.evento_id
         AND e.clase = public.tc_usuario_clase_actual()
         AND e.tipo IN ('actividad', 'trabajo')
    )
  );

CREATE POLICY "ee_update_own" ON public.eventos_estado
  FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (
    usuario_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.eventos e
       WHERE e.id = eventos_estado.evento_id
         AND e.clase = public.tc_usuario_clase_actual()
         AND e.tipo IN ('actividad', 'trabajo')
    )
  );

CREATE POLICY "ee_delete_own" ON public.eventos_estado
  FOR DELETE TO authenticated
  USING (
    usuario_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.eventos e
       WHERE e.id = eventos_estado.evento_id
         AND e.clase = public.tc_usuario_clase_actual()
         AND e.tipo IN ('actividad', 'trabajo')
    )
  );

CREATE POLICY "acceso_aprobado" ON public.eventos_estado
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.tc_usuario_acceso_aprobado())
  WITH CHECK (public.tc_usuario_acceso_aprobado());

REVOKE ALL ON public.eventos_estado FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eventos_estado TO authenticated;

-- ------------------------------------------------------------
-- 3) Realtime para eventos (la RLS de eventos limita lo que ve cada uno)
-- ------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'eventos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.eventos;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 4) Tablas antiguas: se conservan, obsoletas en la web
-- ------------------------------------------------------------
COMMENT ON TABLE public.actividades IS
  'OBSOLETA en la web: las actividades son ahora eventos con tipo actividad/trabajo. Se conserva porque la app movil aun la usa.';
COMMENT ON TABLE public.actividades_estado IS
  'OBSOLETA en la web: sustituida por public.eventos_estado. Se conserva porque la app movil aun la usa.';
