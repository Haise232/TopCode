-- ════════════════════════════════════════════════════════════
-- Anuncios: lectura guardada en el servidor + enlace opcional
--   anuncios_leidos  un anuncio sale una sola vez por usuario, en
--                    cualquier dispositivo (antes solo localStorage).
--   anuncios.enlace  ruta interna opcional (p. ej. /docs/<id>) que el
--                    modal muestra como botón "Abrir".
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.anuncios
  ADD COLUMN IF NOT EXISTS enlace TEXT
  CHECK (enlace IS NULL OR (enlace LIKE '/%' AND length(enlace) <= 200));

CREATE TABLE IF NOT EXISTS public.anuncios_leidos (
  anuncio_id  BIGINT NOT NULL REFERENCES public.anuncios(id) ON DELETE CASCADE,
  usuario_id  UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  leido_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usuario_id, anuncio_id)
);

CREATE INDEX IF NOT EXISTS idx_anuncios_leidos_anuncio
  ON public.anuncios_leidos (anuncio_id);

ALTER TABLE public.anuncios_leidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anuncios_leidos_select_propio" ON public.anuncios_leidos;
DROP POLICY IF EXISTS "anuncios_leidos_insert_propio" ON public.anuncios_leidos;

CREATE POLICY "anuncios_leidos_select_propio" ON public.anuncios_leidos
  FOR SELECT TO authenticated
  USING (usuario_id = (SELECT auth.uid()));

CREATE POLICY "anuncios_leidos_insert_propio" ON public.anuncios_leidos
  FOR INSERT TO authenticated
  WITH CHECK (usuario_id = (SELECT auth.uid()));

GRANT SELECT, INSERT ON public.anuncios_leidos TO authenticated;
