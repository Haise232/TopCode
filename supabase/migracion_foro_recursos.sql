-- ============================================================
-- migracion_foro_recursos.sql
-- Tablas del foro de dudas y de recursos compartidos.
-- Exportadas del proyecto en producción (se crearon desde el
-- panel y no estaban versionadas). Idempotente.
-- Ejecutar después de setup.sql.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- foro_posts
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.foro_posts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  autor       TEXT        NOT NULL,
  titulo      TEXT        NOT NULL,
  cuerpo      TEXT        NOT NULL,
  materia     TEXT        NOT NULL DEFAULT 'general',
  resuelto    BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_foro_posts_created_at ON public.foro_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_foro_posts_materia    ON public.foro_posts (materia);

ALTER TABLE public.foro_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "foro_posts_select" ON public.foro_posts;
CREATE POLICY "foro_posts_select" ON public.foro_posts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "foro_posts_insert" ON public.foro_posts;
CREATE POLICY "foro_posts_insert" ON public.foro_posts
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = usuario_id);

DROP POLICY IF EXISTS "foro_posts_update_own" ON public.foro_posts;
CREATE POLICY "foro_posts_update_own" ON public.foro_posts
  FOR UPDATE TO authenticated
  USING (
    (SELECT auth.uid()) = usuario_id
    OR EXISTS (SELECT 1 FROM public.usuarios
               WHERE usuarios.id = (SELECT auth.uid()) AND usuarios.rol = 'admin')
  );

DROP POLICY IF EXISTS "foro_posts_delete_own" ON public.foro_posts;
CREATE POLICY "foro_posts_delete_own" ON public.foro_posts
  FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = usuario_id
    OR EXISTS (SELECT 1 FROM public.usuarios
               WHERE usuarios.id = (SELECT auth.uid()) AND usuarios.rol = 'admin')
  );

-- ────────────────────────────────────────────────────────────
-- foro_respuestas
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.foro_respuestas (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      UUID        NOT NULL REFERENCES public.foro_posts(id) ON DELETE CASCADE,
  usuario_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  autor        TEXT        NOT NULL,
  cuerpo       TEXT        NOT NULL,
  es_solucion  BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_foro_respuestas_post ON public.foro_respuestas (post_id, created_at);

ALTER TABLE public.foro_respuestas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "foro_respuestas_select" ON public.foro_respuestas;
CREATE POLICY "foro_respuestas_select" ON public.foro_respuestas
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "foro_respuestas_insert" ON public.foro_respuestas;
CREATE POLICY "foro_respuestas_insert" ON public.foro_respuestas
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = usuario_id);

-- El autor del post también puede editar respuestas (marcar la solución).
DROP POLICY IF EXISTS "foro_respuestas_update_own" ON public.foro_respuestas;
CREATE POLICY "foro_respuestas_update_own" ON public.foro_respuestas
  FOR UPDATE TO authenticated
  USING (
    (SELECT auth.uid()) = usuario_id
    OR EXISTS (SELECT 1 FROM public.usuarios
               WHERE usuarios.id = (SELECT auth.uid()) AND usuarios.rol = 'admin')
    OR EXISTS (SELECT 1 FROM public.foro_posts
               WHERE foro_posts.id = foro_respuestas.post_id
                 AND foro_posts.usuario_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "foro_respuestas_delete_own" ON public.foro_respuestas;
CREATE POLICY "foro_respuestas_delete_own" ON public.foro_respuestas
  FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = usuario_id
    OR EXISTS (SELECT 1 FROM public.usuarios
               WHERE usuarios.id = (SELECT auth.uid()) AND usuarios.rol = 'admin')
  );

-- ────────────────────────────────────────────────────────────
-- recursos
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.recursos (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  autor        TEXT        NOT NULL,
  titulo       TEXT        NOT NULL,
  url          TEXT        NOT NULL,
  descripcion  TEXT,
  materia      TEXT        NOT NULL DEFAULT 'general',
  tipo         TEXT        NOT NULL DEFAULT 'link'
               CHECK (tipo IN ('link', 'doc', 'video', 'repo', 'herramienta')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recursos_created_at ON public.recursos (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recursos_materia    ON public.recursos (materia);
CREATE INDEX IF NOT EXISTS idx_recursos_usuario    ON public.recursos (usuario_id);

ALTER TABLE public.recursos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recursos_select" ON public.recursos;
CREATE POLICY "recursos_select" ON public.recursos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "recursos_insert" ON public.recursos;
CREATE POLICY "recursos_insert" ON public.recursos
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = usuario_id);

DROP POLICY IF EXISTS "recursos_delete_own" ON public.recursos;
CREATE POLICY "recursos_delete_own" ON public.recursos
  FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = usuario_id
    OR EXISTS (SELECT 1 FROM public.usuarios
               WHERE usuarios.id = (SELECT auth.uid()) AND usuarios.rol = 'admin')
  );
