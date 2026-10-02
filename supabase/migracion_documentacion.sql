-- ════════════════════════════════════════════════════════════
-- Migración: biblioteca de documentación en Markdown (sustituye a Noticias)
-- Pega y ejecuta todo este bloque en el SQL Editor de Supabase.
-- Requiere migracion_permisos_por_clase.sql (funciones tc_usuario_*).
-- Es idempotente: se puede ejecutar varias veces sin problema.
--
-- Modelo tipo wiki:
--   docs_colecciones → una "carpeta" de documentación (p. ej. un vault de Obsidian)
--   docs_paginas     → cada nota .md de la colección
--   docs_revisiones  → versión anterior de cada página al editarla (historial)
-- Cualquier usuario aprobado puede crear y editar; borrar solo el autor o un admin.
-- Elimina por completo la antigua sección de Noticias (tabla, políticas e índices).
-- ════════════════════════════════════════════════════════════

-- 0) Eliminar Noticias (borra también sus datos)
DROP TABLE IF EXISTS public.noticias CASCADE;

-- 1) Tablas
CREATE TABLE IF NOT EXISTS public.docs_colecciones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo      TEXT NOT NULL CHECK (char_length(titulo) BETWEEN 1 AND 200),
  descripcion TEXT CHECK (descripcion IS NULL OR char_length(descripcion) <= 1000),
  materia     TEXT NOT NULL DEFAULT 'general',
  created_by  UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  autor       TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.docs_paginas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coleccion_id    UUID NOT NULL REFERENCES public.docs_colecciones(id) ON DELETE CASCADE,
  titulo          TEXT NOT NULL CHECK (char_length(titulo) BETWEEN 1 AND 200),
  contenido       TEXT NOT NULL DEFAULT '' CHECK (char_length(contenido) <= 200000),
  orden           INTEGER NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  autor           TEXT NOT NULL DEFAULT '',
  updated_by      UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  updated_by_nombre TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (coleccion_id, titulo)
);

CREATE TABLE IF NOT EXISTS public.docs_revisiones (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pagina_id          UUID NOT NULL REFERENCES public.docs_paginas(id) ON DELETE CASCADE,
  titulo             TEXT NOT NULL,
  contenido          TEXT NOT NULL,
  editado_por        UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  editado_por_nombre TEXT NOT NULL DEFAULT '',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.docs_colecciones IS 'Colecciones de documentación Markdown (equivalente a un vault/carpeta).';
COMMENT ON TABLE public.docs_paginas IS 'Páginas Markdown de una colección. Los [[wikilinks]] se resuelven por título dentro de la colección.';
COMMENT ON TABLE public.docs_revisiones IS 'Versión previa de una página, guardada automáticamente por trigger en cada edición.';

CREATE INDEX IF NOT EXISTS idx_docs_colecciones_updated ON public.docs_colecciones (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_docs_paginas_coleccion   ON public.docs_paginas (coleccion_id, orden, titulo);
CREATE INDEX IF NOT EXISTS idx_docs_paginas_updated     ON public.docs_paginas (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_docs_paginas_created     ON public.docs_paginas (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_docs_revisiones_pagina   ON public.docs_revisiones (pagina_id, created_at DESC);

-- 2) Triggers: autoría la fija el servidor (no se fía del cliente)
CREATE OR REPLACE FUNCTION public.tc_docs_set_autoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nombre TEXT;
BEGIN
  SELECT nombre INTO v_nombre FROM public.usuarios WHERE id = auth.uid();
  NEW.updated_at := NOW();

  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    NEW.autor      := COALESCE(v_nombre, '');
    NEW.created_at := NOW();
  ELSE
    NEW.created_by := OLD.created_by;
    NEW.autor      := OLD.autor;
    NEW.created_at := OLD.created_at;
  END IF;

  IF TG_TABLE_NAME = 'docs_paginas' THEN
    NEW.updated_by        := auth.uid();
    NEW.updated_by_nombre := COALESCE(v_nombre, '');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_docs_colecciones_autoria ON public.docs_colecciones;
CREATE TRIGGER trg_docs_colecciones_autoria
  BEFORE INSERT OR UPDATE ON public.docs_colecciones
  FOR EACH ROW EXECUTE FUNCTION public.tc_docs_set_autoria();

DROP TRIGGER IF EXISTS trg_docs_paginas_autoria ON public.docs_paginas;
CREATE TRIGGER trg_docs_paginas_autoria
  BEFORE INSERT OR UPDATE ON public.docs_paginas
  FOR EACH ROW EXECUTE FUNCTION public.tc_docs_set_autoria();

-- Guarda la versión anterior y marca la colección como actualizada
CREATE OR REPLACE FUNCTION public.tc_docs_guardar_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.contenido IS DISTINCT FROM NEW.contenido OR OLD.titulo IS DISTINCT FROM NEW.titulo) THEN
    INSERT INTO public.docs_revisiones (pagina_id, titulo, contenido, editado_por, editado_por_nombre, created_at)
    VALUES (OLD.id, OLD.titulo, OLD.contenido, OLD.updated_by, OLD.updated_by_nombre, OLD.updated_at);
  END IF;

  UPDATE public.docs_colecciones SET updated_at = NOW()
  WHERE id = COALESCE(NEW.coleccion_id, OLD.coleccion_id);

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_docs_paginas_revision ON public.docs_paginas;
CREATE TRIGGER trg_docs_paginas_revision
  AFTER INSERT OR UPDATE ON public.docs_paginas
  FOR EACH ROW EXECUTE FUNCTION public.tc_docs_guardar_revision();

-- El UPDATE interno de docs_colecciones dispara tc_docs_set_autoria, que conserva
-- created_by/autor gracias a la rama ELSE.

-- 3) RLS
ALTER TABLE public.docs_colecciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docs_paginas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docs_revisiones  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "docs_colecciones_select" ON public.docs_colecciones;
DROP POLICY IF EXISTS "docs_colecciones_insert" ON public.docs_colecciones;
DROP POLICY IF EXISTS "docs_colecciones_update" ON public.docs_colecciones;
DROP POLICY IF EXISTS "docs_colecciones_delete" ON public.docs_colecciones;
DROP POLICY IF EXISTS "docs_paginas_select"     ON public.docs_paginas;
DROP POLICY IF EXISTS "docs_paginas_insert"     ON public.docs_paginas;
DROP POLICY IF EXISTS "docs_paginas_update"     ON public.docs_paginas;
DROP POLICY IF EXISTS "docs_paginas_delete"     ON public.docs_paginas;
DROP POLICY IF EXISTS "docs_revisiones_select"  ON public.docs_revisiones;

-- Colecciones: todos leen y crean; editar metadatos y borrar solo autor o admin
CREATE POLICY "docs_colecciones_select" ON public.docs_colecciones
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "docs_colecciones_insert" ON public.docs_colecciones
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "docs_colecciones_update" ON public.docs_colecciones
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.tc_usuario_rol_actual() = 'admin' OR public.tc_usuario_es_superadmin() = true)
  WITH CHECK (true);

CREATE POLICY "docs_colecciones_delete" ON public.docs_colecciones
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.tc_usuario_rol_actual() = 'admin' OR public.tc_usuario_es_superadmin() = true);

-- Páginas: wiki abierta (todos leen, crean y editan); borrar solo autor o admin
CREATE POLICY "docs_paginas_select" ON public.docs_paginas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "docs_paginas_insert" ON public.docs_paginas
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "docs_paginas_update" ON public.docs_paginas
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "docs_paginas_delete" ON public.docs_paginas
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.tc_usuario_rol_actual() = 'admin' OR public.tc_usuario_es_superadmin() = true);

-- Revisiones: solo lectura (las escribe el trigger)
CREATE POLICY "docs_revisiones_select" ON public.docs_revisiones
  FOR SELECT TO authenticated USING (true);

-- Solo usuarios con acceso aprobado (misma política restrictiva que el resto de tablas)
DO $$
DECLARE tabla TEXT;
BEGIN
  FOREACH tabla IN ARRAY ARRAY['docs_colecciones', 'docs_paginas', 'docs_revisiones'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "acceso_aprobado" ON public.%I', tabla);
    EXECUTE format(
      'CREATE POLICY "acceso_aprobado" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.tc_usuario_acceso_aprobado()) WITH CHECK (public.tc_usuario_acceso_aprobado())',
      tabla
    );
  END LOOP;
END $$;

-- 4) Forzar a PostgREST a recargar el esquema
NOTIFY pgrst, 'reload schema';
