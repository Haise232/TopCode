-- ════════════════════════════════════════════════════════════
-- migracion_unidades_trabajo.sql
-- Apuntes y Documentación se organizan por asignatura y, dentro de cada
-- asignatura, por unidad de trabajo (UT). La UT es opcional: NULL = "Sin UT".
-- Idempotente.
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.apuntes          ADD COLUMN IF NOT EXISTS ut SMALLINT NULL;
ALTER TABLE public.docs_colecciones ADD COLUMN IF NOT EXISTS ut SMALLINT NULL;

ALTER TABLE public.apuntes DROP CONSTRAINT IF EXISTS apuntes_ut_check;
ALTER TABLE public.apuntes ADD CONSTRAINT apuntes_ut_check CHECK (ut IS NULL OR ut BETWEEN 1 AND 30);

ALTER TABLE public.docs_colecciones DROP CONSTRAINT IF EXISTS docs_colecciones_ut_check;
ALTER TABLE public.docs_colecciones ADD CONSTRAINT docs_colecciones_ut_check CHECK (ut IS NULL OR ut BETWEEN 1 AND 30);

-- Colecciones que ya dicen su UT en el título («… UT1», «UT 2 …»).
UPDATE public.docs_colecciones
   SET ut = substring(titulo FROM '(?i)\mUT\s*(\d{1,2})\M')::SMALLINT
 WHERE ut IS NULL AND titulo ~* '\mUT\s*\d{1,2}\M';

NOTIFY pgrst, 'reload schema';
