-- ════════════════════════════════════════════════════════════
-- Migración: tabla "horario" (horario semanal editable por clase)
-- Pega y ejecuta todo este bloque en el SQL Editor de Supabase.
-- Es idempotente: se puede ejecutar varias veces sin problema.
-- ════════════════════════════════════════════════════════════

-- 1) Tabla horario
CREATE TABLE IF NOT EXISTS public.horario (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clase       TEXT NOT NULL CHECK (clase IN (
    '1º DAM A','1º DAM B','2º DAM A','2º DAM B',
    '1º DAW A','1º DAW B','2º DAW A','2º DAW B',
    '1º ASIR A','1º ASIR B','2º ASIR A','2º ASIR B'
  )),
  dia_semana  SMALLINT NOT NULL CHECK (dia_semana BETWEEN 1 AND 5),
  hora_inicio TEXT NOT NULL CHECK (hora_inicio ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  hora_fin    TEXT NOT NULL CHECK (hora_fin ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  materia     TEXT NOT NULL,
  codigo      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.horario IS
  'Horario semanal de clases por grupo-clase. dia_semana: 1=lunes .. 5=viernes. Solo admins escriben; todos los autenticados leen.';

-- 2) Índice para la query de Home.tsx: .eq('clase', X).order('dia_semana').order('hora_inicio')
CREATE INDEX IF NOT EXISTS idx_horario_clase_dia
  ON public.horario (clase, dia_semana, hora_inicio);

-- 3) RLS: lectura para todos los autenticados, escritura solo admins
ALTER TABLE public.horario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "horario_select_auth"  ON public.horario;
DROP POLICY IF EXISTS "horario_insert_admin" ON public.horario;
DROP POLICY IF EXISTS "horario_update_admin" ON public.horario;
DROP POLICY IF EXISTS "horario_delete_admin" ON public.horario;

CREATE POLICY "horario_select_auth" ON public.horario
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "horario_insert_admin" ON public.horario
  FOR INSERT TO authenticated
  WITH CHECK (
    clase = (SELECT clase FROM public.usuarios WHERE id = auth.uid())
    AND (SELECT rol FROM public.usuarios WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "horario_update_admin" ON public.horario
  FOR UPDATE TO authenticated
  USING (
    clase = (SELECT clase FROM public.usuarios WHERE id = auth.uid())
    AND (SELECT rol FROM public.usuarios WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    clase = (SELECT clase FROM public.usuarios WHERE id = auth.uid())
    AND (SELECT rol FROM public.usuarios WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "horario_delete_admin" ON public.horario
  FOR DELETE TO authenticated
  USING (
    clase = (SELECT clase FROM public.usuarios WHERE id = auth.uid())
    AND (SELECT rol FROM public.usuarios WHERE id = auth.uid()) = 'admin'
  );

-- 4) Seed: horario actual de 1º DAM B (único grupo existente hasta esta migración).
--    El resto de clases se rellenan desde el panel de Admin.
INSERT INTO public.horario (clase, dia_semana, hora_inicio, hora_fin, materia, codigo)
SELECT * FROM (VALUES
  -- Lunes
  ('1º DAM B'::text, 1::smallint, '14:30', '15:25', 'Lenguajes de marcas',               'LND'),
  ('1º DAM B',       1,           '15:25', '16:20', 'Lenguajes de marcas',               'LND'),
  ('1º DAM B',       1,           '16:20', '17:15', 'Itinerario para la empleabilidad',  'ITK'),
  ('1º DAM B',       1,           '17:45', '18:40', 'Inglés profesional',                'IKL'),
  ('1º DAM B',       1,           '18:40', '19:35', 'Programación',                      'PRO'),
  ('1º DAM B',       1,           '19:35', '20:30', 'Bases de datos',                    'BAE'),
  -- Martes
  ('1º DAM B',       2,           '15:30', '16:20', 'Digitalización aplicada',           'DJK'),
  ('1º DAM B',       2,           '16:20', '17:10', 'Programación',                      'PRO'),
  ('1º DAM B',       2,           '17:10', '18:00', 'Entornos de desarrollo',            'ETS'),
  ('1º DAM B',       2,           '18:30', '19:20', 'Sistemas informáticos',             'SSF'),
  ('1º DAM B',       2,           '19:20', '20:10', 'Sistemas informáticos',             'SSF'),
  ('1º DAM B',       2,           '20:10', '21:00', 'Bases de datos',                    'BAE'),
  -- Miércoles
  ('1º DAM B',       3,           '14:30', '15:25', 'Sistemas informáticos',             'SSF'),
  ('1º DAM B',       3,           '15:25', '16:20', 'Itinerario para la empleabilidad',  'ITK'),
  ('1º DAM B',       3,           '16:20', '17:15', 'Digitalización aplicada',           'DJK'),
  ('1º DAM B',       3,           '17:45', '18:40', 'Programación',                      'PRO'),
  ('1º DAM B',       3,           '18:40', '19:35', 'Programación',                      'PRO'),
  ('1º DAM B',       3,           '19:35', '20:30', 'Inglés profesional',                'IKL'),
  -- Jueves
  ('1º DAM B',       4,           '14:30', '15:25', 'Lenguajes de marcas',               'LND'),
  ('1º DAM B',       4,           '15:25', '16:20', 'Lenguajes de marcas',               'LND'),
  ('1º DAM B',       4,           '16:20', '17:15', 'Programación',                      'PRO'),
  ('1º DAM B',       4,           '17:45', '18:40', 'Sistemas informáticos',             'SSF'),
  ('1º DAM B',       4,           '18:40', '19:35', 'Bases de datos',                    'BAE'),
  ('1º DAM B',       4,           '19:35', '20:30', 'Entornos de desarrollo',            'ETS'),
  -- Viernes
  ('1º DAM B',       5,           '14:30', '15:25', 'Sistemas informáticos',             'SSF'),
  ('1º DAM B',       5,           '15:25', '16:20', 'Bases de datos',                    'BAE'),
  ('1º DAM B',       5,           '16:20', '17:15', 'Bases de datos',                    'BAE'),
  ('1º DAM B',       5,           '17:45', '18:40', 'Itinerario para la empleabilidad',  'ITK'),
  ('1º DAM B',       5,           '18:40', '19:35', 'Programación',                      'PRO'),
  ('1º DAM B',       5,           '19:35', '20:30', 'Entornos de desarrollo',            'ETS')
) AS seed(clase, dia_semana, hora_inicio, hora_fin, materia, codigo)
WHERE NOT EXISTS (SELECT 1 FROM public.horario WHERE clase = '1º DAM B');

-- 5) Forzar a PostgREST a recargar el esquema
NOTIFY pgrst, 'reload schema';
