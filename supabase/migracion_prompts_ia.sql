-- ════════════════════════════════════════════════════════════
-- migracion_prompts_ia.sql
-- Sustituye la sección de Recursos por una zona de prompts de IA.
-- Ejecutar después de migracion_foro_recursos.sql.
-- ════════════════════════════════════════════════════════════

-- La tabla de recursos deja de usarse.
DROP TABLE IF EXISTS public.recursos;

-- ────────────────────────────────────────────────────────────
-- prompts
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.prompts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  autor        TEXT        NOT NULL,
  titulo       TEXT        NOT NULL CHECK (char_length(titulo) BETWEEN 1 AND 120),
  contenido    TEXT        NOT NULL CHECK (char_length(contenido) BETWEEN 1 AND 8000),
  descripcion  TEXT        CHECK (descripcion IS NULL OR char_length(descripcion) <= 300),
  categoria    TEXT        NOT NULL DEFAULT 'general'
               CHECK (categoria IN ('general', 'codigo', 'estudio', 'escritura', 'depuracion', 'imagen')),
  modelo       TEXT        NOT NULL DEFAULT 'cualquiera'
               CHECK (modelo IN ('cualquiera', 'chatgpt', 'claude', 'gemini', 'copilot')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prompts_created_at ON public.prompts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompts_categoria  ON public.prompts (categoria);
CREATE INDEX IF NOT EXISTS idx_prompts_usuario    ON public.prompts (usuario_id);

ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prompts_select" ON public.prompts;
CREATE POLICY "prompts_select" ON public.prompts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "prompts_insert" ON public.prompts;
CREATE POLICY "prompts_insert" ON public.prompts
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = usuario_id);

DROP POLICY IF EXISTS "prompts_update_own" ON public.prompts;
CREATE POLICY "prompts_update_own" ON public.prompts
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = usuario_id)
  WITH CHECK ((SELECT auth.uid()) = usuario_id);

DROP POLICY IF EXISTS "prompts_delete_own" ON public.prompts;
CREATE POLICY "prompts_delete_own" ON public.prompts
  FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = usuario_id
    OR EXISTS (SELECT 1 FROM public.usuarios
               WHERE usuarios.id = (SELECT auth.uid()) AND usuarios.rol = 'admin')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompts TO authenticated;
