-- ============================================================
-- TopCode — Intranet Académica
-- Schema v2.0 — Web Edition (migrado de React Native/Expo)
-- Fecha: 2026-04-04
-- Base de datos: Supabase (PostgreSQL)
-- Descripción: Script idempotente completo. Crea las tablas
--   base si no existen, aplica RLS, índices de rendimiento,
--   storage buckets y realtime. Seguro de ejecutar sobre una
--   instancia ya existente o desde cero.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- NOTAS DE MIGRACIÓN v1.x → v2.0
--   - Eliminada columna push_token (era mobile-only, Expo)
--   - Se añaden las definiciones CREATE TABLE que faltaban
--   - Se añaden índices de rendimiento para todas las queries
--     críticas del frontend web
--   - Se habilita Realtime también en "mensajes" (chat público)
--   - Se normaliza created_at en todas las tablas a TIMESTAMPTZ
-- ────────────────────────────────────────────────────────────


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1: TABLAS BASE
-- Orden: primero tablas sin FK, luego las dependientes
-- ════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────
-- 1.1 Tabla: usuarios
--   Espejo de auth.users con datos de perfil adicionales.
--   La columna "id" es FK a auth.users — se gestiona por trigger.
--   Se usa en prácticamente todas las queries del frontend.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.usuarios (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre     TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  promedio   NUMERIC(5,2) NOT NULL DEFAULT 0
               CHECK (promedio >= 0 AND promedio <= 10),
  avatar_url TEXT DEFAULT NULL,
  -- push_token eliminado: era exclusivo de Expo/React Native (mobile).
  -- La versión web no usa notificaciones push nativas.
  rol        TEXT NOT NULL DEFAULT 'alumno'
               CHECK (rol IN ('alumno', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.usuarios IS
  'Perfiles de usuario. Espejo de auth.users con datos académicos y de rol.';
COMMENT ON COLUMN public.usuarios.promedio IS
  'Media de todas las notas del alumno. Se recalcula automáticamente desde el frontend tras cada INSERT/DELETE en notas.';
COMMENT ON COLUMN public.usuarios.rol IS
  'Rol de acceso: alumno (lectura) o admin (gestión de eventos y roles).';


-- ────────────────────────────────────────────────────────────
-- 1.2 Tabla: notas
--   Calificaciones por materia/tema del alumno.
--   Query más frecuente: .eq('usuario_id', X).order('created_at', desc)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  materia     TEXT NOT NULL,
  tema        TEXT NOT NULL,
  teorica     NUMERIC(4,2) NOT NULL CHECK (teorica >= 0 AND teorica <= 10),
  practica    NUMERIC(4,2) NOT NULL CHECK (practica >= 0 AND practica <= 10),
  media       NUMERIC(4,2) NOT NULL CHECK (media >= 0 AND media <= 10),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.notas IS
  'Calificaciones académicas por materia y tema. La columna media = (teorica + practica) / 2 calculada en el cliente.';


-- ────────────────────────────────────────────────────────────
-- 1.3 Tabla: noticias (sector tecnológico)
--   Noticias del sector tech gestionadas por admins.
--   Lectura: todos los usuarios. Escritura/borrado: solo admins.
--   Query más frecuente: .order('created_at', desc)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.noticias (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo      TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  url_fuente  TEXT NOT NULL,
  url_imagen  TEXT DEFAULT NULL,
  created_by  UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.noticias IS
  'Noticias del sector tecnológico añadidas por admins. url_imagen es opcional.';

CREATE INDEX IF NOT EXISTS idx_noticias_created_at
  ON public.noticias (created_at DESC);

-- RLS: lectura pública para usuarios autenticados; escritura solo admins
ALTER TABLE public.noticias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "noticias_select_authenticated" ON public.noticias;
DROP POLICY IF EXISTS "noticias_insert_admin"         ON public.noticias;
DROP POLICY IF EXISTS "noticias_delete_admin"         ON public.noticias;

CREATE POLICY "noticias_select_authenticated"
  ON public.noticias FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "noticias_insert_admin"
  ON public.noticias FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid() AND rol = 'admin'
    )
  );

CREATE POLICY "noticias_delete_admin"
  ON public.noticias FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid() AND rol = 'admin'
    )
  );


-- ────────────────────────────────────────────────────────────
-- 1.4 Tabla: mensajes (chat público)
--   Chat en tiempo real accesible a todos los usuarios.
--   Queries: .order('created_at', asc).limit(100)
--   INSERT con usuario_id + autor (nombre desnormalizado para
--   evitar JOIN en tiempo real; aceptable en chat).
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mensajes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  -- "autor" se denormaliza intencionalmente: evita un JOIN en la
  -- query de chat que se ejecuta en tiempo real con muchos usuarios.
  -- El tradeoff (inconsistencia si el nombre cambia) es aceptable
  -- en un chat donde los mensajes históricos son inmutables.
  autor       TEXT NOT NULL,
  texto       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.mensajes IS
  'Chat público en tiempo real. autor desnormalizado deliberadamente para evitar JOINs en lecturas de tiempo real.';


-- ────────────────────────────────────────────────────────────
-- 1.4 Tabla: apuntes
--   Archivos subidos al bucket de Storage "apuntes".
--   La URL es pública (bucket público). El frontend agrupa
--   por usuario_id para distinguir "mis archivos" vs "compañeros".
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.apuntes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  url         TEXT NOT NULL,
  tipo        TEXT NOT NULL DEFAULT 'otro'
                CHECK (tipo IN ('pdf', 'imagen', 'otro')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.apuntes IS
  'Metadatos de archivos subidos al bucket Storage "apuntes". La URL es la URL pública del objeto.';


-- ────────────────────────────────────────────────────────────
-- 1.5 Tabla: mensajes_privados
--   Chat 1-a-1 en tiempo real. RLS restringe acceso al par
--   emisor/receptor. de_nombre desnormalizado = mismo criterio
--   que "mensajes".
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mensajes_privados (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  de_id      UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  -- de_nombre desnormalizado igual que "autor" en mensajes.
  de_nombre  TEXT NOT NULL,
  para_id    UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  texto      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.mensajes_privados IS
  'Mensajes privados 1-a-1 en tiempo real. RLS garantiza que solo emisor/receptor leen la conversación.';


-- ────────────────────────────────────────────────────────────
-- 1.6 Tabla: eventos (calendario académico)
--   Solo admins pueden crear/eliminar. Todos los usuarios
--   autenticados pueden leer. La query ordena por fecha ASC.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.eventos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo      TEXT NOT NULL,
  descripcion TEXT DEFAULT NULL,
  fecha       DATE NOT NULL,
  created_by  UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.eventos IS
  'Eventos del calendario académico. Solo admins los crean/eliminan. La fecha es tipo DATE (sin hora) para simplificar comparaciones en el cliente.';


-- ────────────────────────────────────────────────────────────
-- 1.7 Tabla: actividades
--   Tareas/entregas académicas con fecha límite.
--   Solo admins crean/eliminan. Las actividades expiradas
--   se borran automáticamente en cada carga de Actividades.tsx.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.actividades (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo        TEXT NOT NULL,
  descripcion   TEXT DEFAULT NULL,
  materia       TEXT DEFAULT NULL,
  fecha_entrega TIMESTAMPTZ NOT NULL,
  created_by    UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.actividades IS
  'Tareas y entregas académicas. Fecha_entrega en TIMESTAMPTZ para comparaciones precisas. Solo admins crean/eliminan.';


-- ────────────────────────────────────────────────────────────
-- 1.8 Tabla: actividades_estado
--   Estado completado/pendiente por usuario y actividad.
--   PK compuesta (actividad_id, usuario_id) garantiza unicidad.
--   Se usa upsert con onConflict en toggleEstado().
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.actividades_estado (
  actividad_id UUID NOT NULL REFERENCES public.actividades(id) ON DELETE CASCADE,
  usuario_id   UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  completada   BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (actividad_id, usuario_id)
);

COMMENT ON TABLE public.actividades_estado IS
  'Estado de completado por alumno y actividad. PK compuesta (actividad_id, usuario_id) usada por upsert en toggleEstado().';


-- ────────────────────────────────────────────────────────────
-- 1.9 Tabla: anuncios
--   Mensajes globales creados por admins que aparecen como modal
--   a todos los usuarios hasta que los lean.
--   Lectura: todos los autenticados. Escritura/borrado: solo admins.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.anuncios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo      TEXT NOT NULL CHECK (length(titulo) BETWEEN 1 AND 100),
  contenido   TEXT NOT NULL CHECK (length(contenido) BETWEEN 1 AND 1000),
  activo      BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.anuncios IS
  'Anuncios globales creados por admins. El último activo se muestra como modal a todos los usuarios.';

CREATE INDEX IF NOT EXISTS idx_anuncios_created_at
  ON public.anuncios (created_at DESC);

ALTER TABLE public.anuncios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anuncios_select_auth"   ON public.anuncios;
DROP POLICY IF EXISTS "anuncios_insert_admin"  ON public.anuncios;
DROP POLICY IF EXISTS "anuncios_update_admin"  ON public.anuncios;
DROP POLICY IF EXISTS "anuncios_delete_admin"  ON public.anuncios;

CREATE POLICY "anuncios_select_auth" ON public.anuncios
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "anuncios_insert_admin" ON public.anuncios
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT rol FROM public.usuarios WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "anuncios_update_admin" ON public.anuncios
  FOR UPDATE TO authenticated
  USING (
    (SELECT rol FROM public.usuarios WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT rol FROM public.usuarios WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "anuncios_delete_admin" ON public.anuncios
  FOR DELETE TO authenticated
  USING (
    (SELECT rol FROM public.usuarios WHERE id = auth.uid()) = 'admin'
  );


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2: COLUMNAS OPCIONALES (idempotente con IF NOT EXISTS)
-- Añade columnas que pueden no existir en instancias antiguas
-- ════════════════════════════════════════════════════════════

-- Columna rol (añadida en v1.2, incluida aquí para compatibilidad)
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS rol TEXT NOT NULL DEFAULT 'alumno'
  CHECK (rol IN ('alumno', 'admin'));

-- Normalizar filas con NULL en rol (migración de datos)
UPDATE public.usuarios SET rol = 'alumno' WHERE rol IS NULL;

-- avatar_url (referenciada en Profile.tsx, Chat.tsx, Admin.tsx)
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL;

-- banner_url (referenciada en Home.tsx, Admin.tsx, Chat.tsx; subida a bucket "avatars")
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS banner_url TEXT DEFAULT NULL;

-- promedio (referenciado en Profile.tsx, calculado en supabase.ts)
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS promedio NUMERIC(5,2) NOT NULL DEFAULT 0;

-- created_at en usuarios (referenciado en Profile.tsx)
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- es_superadmin: controla quién puede cambiar roles desde el panel admin.
-- Solo se establece manualmente en la base de datos (nunca desde el cliente).
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS es_superadmin BOOLEAN NOT NULL DEFAULT false;

-- banner_url: referenciada en Home.tsx para la imagen de cabecera del perfil
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS banner_url TEXT DEFAULT NULL;

-- NOTA: push_token NO se añade. Era una columna mobile-only
-- usada por Expo para notificaciones push. La versión web no
-- usa push tokens. Si existe en producción, se puede eliminar:
--   ALTER TABLE public.usuarios DROP COLUMN IF EXISTS push_token;
-- (No se ejecuta aquí para no perder datos en producción sin
--  revisión manual previa.)


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3: ÍNDICES DE RENDIMIENTO
-- Objetivo: eliminar full table scans en las queries más
-- frecuentes del frontend. Todas las queries críticas
-- identificadas en el código fuente están cubiertas.
-- ════════════════════════════════════════════════════════════

-- ── notas ────────────────────────────────────────────────────
-- Query: .eq('usuario_id', X).order('created_at', desc)
-- Índice compuesto cubriente: filtra por usuario y ordena por
-- fecha sin tocar el heap. Crítico para actualizarPromedio().
CREATE INDEX IF NOT EXISTS idx_notas_usuario_created
  ON public.notas (usuario_id, created_at DESC);

-- Query: SELECT media WHERE usuario_id = X (actualizarPromedio)
-- Índice cubriente: la columna media está incluida, el planner
-- puede satisfacer la query solo con el índice (index-only scan).
CREATE INDEX IF NOT EXISTS idx_notas_usuario_media
  ON public.notas (usuario_id) INCLUDE (media);

-- ── mensajes (chat público) ───────────────────────────────────
-- Query: .order('created_at', asc).limit(100)
-- La tabla crece indefinidamente; el índice en created_at evita
-- un seqscan + sort en cada carga del chat.
CREATE INDEX IF NOT EXISTS idx_mensajes_created
  ON public.mensajes (created_at ASC);

-- Índice adicional por usuario (para futuras moderación/admin)
CREATE INDEX IF NOT EXISTS idx_mensajes_usuario
  ON public.mensajes (usuario_id);

-- ── mensajes_privados ────────────────────────────────────────
-- Query crítica del chat privado:
--   .or(`and(de_id.eq.X,para_id.eq.Y),and(de_id.eq.Y,para_id.eq.X)`)
--   .order('created_at', asc)
-- Índice compuesto (de_id, para_id) cubre los dos lados del OR;
-- el planner puede hacer un BitmapOr de dos index scans.
CREATE INDEX IF NOT EXISTS idx_mp_de_para
  ON public.mensajes_privados (de_id, para_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_mp_para_de
  ON public.mensajes_privados (para_id, de_id, created_at ASC);

-- ── apuntes ──────────────────────────────────────────────────
-- Query: .order('created_at', desc) — lista global de apuntes
-- El cliente filtra en memoria por usuario_id para "mis archivos"
-- vs "de compañeros". El índice en created_at cubre el ORDER BY.
CREATE INDEX IF NOT EXISTS idx_apuntes_created
  ON public.apuntes (created_at DESC);

-- Índice en usuario_id para filtros de RLS y eliminación
CREATE INDEX IF NOT EXISTS idx_apuntes_usuario
  ON public.apuntes (usuario_id);

-- ── eventos (calendario) ─────────────────────────────────────
-- Query: .order('fecha', asc) — el calendario ordena por fecha
CREATE INDEX IF NOT EXISTS idx_eventos_fecha
  ON public.eventos (fecha ASC);

-- Índice en created_by para las políticas RLS de admin
CREATE INDEX IF NOT EXISTS idx_eventos_created_by
  ON public.eventos (created_by);

-- ── usuarios ──────────────────────────────────────────────────
-- Query (Admin.tsx): .order('nombre') — lista completa de usuarios
CREATE INDEX IF NOT EXISTS idx_usuarios_nombre
  ON public.usuarios (nombre);

-- Índice en rol: las políticas RLS de eventos y admin hacen
-- subquery SELECT rol WHERE id = auth.uid(). La PK cubre el
-- WHERE id = X, pero el índice en (id, rol) lo convierte en
-- index-only scan (el planner no necesita ir al heap).
CREATE INDEX IF NOT EXISTS idx_usuarios_id_rol
  ON public.usuarios (id) INCLUDE (rol);

-- Query (Chat.tsx UserList): .neq('id', X).order('nombre')
-- El índice idx_usuarios_nombre ya cubre el ORDER BY.

-- ── actividades ───────────────────────────────────────────────
-- Query principal: .order('fecha_entrega', asc).limit(100)
CREATE INDEX IF NOT EXISTS idx_actividades_fecha_entrega
  ON public.actividades (fecha_entrega ASC);

-- Índice en created_by para políticas RLS y filtros de admin
CREATE INDEX IF NOT EXISTS idx_actividades_created_by
  ON public.actividades (created_by);

-- ── actividades_estado ────────────────────────────────────────
-- Query del alumno: .eq('usuario_id', X) — cubre el filtro RLS
CREATE INDEX IF NOT EXISTS idx_ae_usuario
  ON public.actividades_estado (usuario_id);

-- Query de stats del admin: .eq('completada', true)
-- + JOIN implícito por actividad_id → índice parcial
CREATE INDEX IF NOT EXISTS idx_ae_completada
  ON public.actividades_estado (actividad_id)
  WHERE completada = TRUE;

-- ── anuncios ──────────────────────────────────────────────────
-- Query de AnuncioModal: .eq('activo', true)
CREATE INDEX IF NOT EXISTS idx_anuncios_activo
  ON public.anuncios (activo)
  WHERE activo = TRUE;

-- Query de Admin.tsx: .order('created_at', desc)
CREATE INDEX IF NOT EXISTS idx_anuncios_created
  ON public.anuncios (created_at DESC);


-- ════════════════════════════════════════════════════════════
-- BLOQUE 4: TRIGGER — crear perfil al registrarse
--   SECURITY DEFINER: bypasa RLS para poder insertar en
--   usuarios sin que el usuario recién creado tenga sesión.
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.usuarios (id, nombre, email, promedio, rol)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    NEW.email,
    0,
    'alumno'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ════════════════════════════════════════════════════════════
-- BLOQUE 4b: FUNCIÓN RPC — recalcular_promedio
--   Reemplaza el patrón SELECT + UPDATE de dos round-trips en
--   actualizarPromedio() (supabase.ts) por una sola operación
--   atómica en el servidor.
--   Llamada desde el cliente: supabase.rpc('recalcular_promedio',
--     { p_usuario_id: userId })
--   SECURITY DEFINER: puede actualizar la fila del usuario aunque
--   la política UPDATE de usuarios solo permita al propio usuario.
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.recalcular_promedio(p_usuario_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promedio NUMERIC(5,2);
BEGIN
  SELECT COALESCE(ROUND(AVG(media)::NUMERIC, 2), 0)
    INTO v_promedio
    FROM public.notas
   WHERE usuario_id = p_usuario_id;

  UPDATE public.usuarios
     SET promedio = v_promedio
   WHERE id = p_usuario_id;
END;
$$;

COMMENT ON FUNCTION public.recalcular_promedio(UUID) IS
  'Recalcula y persiste el promedio del alumno en una sola round-trip. '
  'Llamada desde supabase.ts tras INSERT/DELETE en notas.';

-- Revocar acceso público y conceder solo a usuarios autenticados
REVOKE ALL ON FUNCTION public.recalcular_promedio(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalcular_promedio(UUID) TO authenticated;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 5: ROW LEVEL SECURITY (RLS)
-- Cada tabla tiene su propio bloque. Las políticas son
-- idempotentes: DROP IF EXISTS antes de cada CREATE POLICY.
-- ════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────
-- 5.1 RLS — usuarios
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios_select_all"    ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_select_self"   ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_select_admin"  ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_insert_own"    ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_update_own"    ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_update_admin"  ON public.usuarios;

-- NOTA: No se añaden políticas SELECT adicionales.
-- La política legacy "usuarios: ver todos" (USING true) y "Usuarios autenticados"
-- (FOR ALL) ya cubren el acceso de lectura sin causar recursión infinita.
-- Añadir políticas SELECT que hagan subqueries sobre la misma tabla usuarios
-- provoca bucle infinito → HTTP 500 en todas las queries.

-- Vista pública con solo los campos no-sensibles para el chat
-- security_invoker=off → usa permisos del owner (postgres), ignora RLS
-- Así cualquier alumno autenticado puede ver nombre+avatar de otros usuarios
-- sin acceder a email, promedio ni es_superadmin.
DROP VIEW IF EXISTS public.usuarios_publicos;
CREATE VIEW public.usuarios_publicos
  WITH (security_invoker = off)
AS
  SELECT id, nombre, avatar_url, rol FROM public.usuarios;
REVOKE ALL ON public.usuarios_publicos FROM anon, authenticated;
GRANT SELECT ON public.usuarios_publicos TO authenticated;

-- Solo el trigger SECURITY DEFINER inserta en producción,
-- pero esta política cubre el caso de inserción directa.
CREATE POLICY "usuarios_insert_own" ON public.usuarios
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Cada usuario puede editar solo su propia fila
-- (nombre, avatar_url — desde Profile.tsx)
-- WITH CHECK impide que el usuario cambie su propio campo "rol".
-- Sin esta cláusula, un alumno podría hacer:
--   supabase.from('usuarios').update({ rol: 'admin' }).eq('id', suUid)
-- y RLS lo permitiría porque es su propia fila.
CREATE POLICY "usuarios_update_own" ON public.usuarios
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND rol = (SELECT rol FROM public.usuarios WHERE id = auth.uid())
  );

-- Los admins pueden actualizar cualquier fila (cambio de rol desde Admin.tsx)
-- Sin WITH CHECK de es_superadmin para evitar subqueries recursivos.
CREATE POLICY "usuarios_update_admin" ON public.usuarios
  FOR UPDATE
  USING (
    (SELECT rol FROM public.usuarios WHERE id = auth.uid()) = 'admin'
  );


-- ────────────────────────────────────────────────────────────
-- 5.2 RLS — notas
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.notas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notas_select_auth"  ON public.notas;
DROP POLICY IF EXISTS "notas_insert_own"   ON public.notas;
DROP POLICY IF EXISTS "notas_update_own"   ON public.notas;
DROP POLICY IF EXISTS "notas_delete_own"   ON public.notas;

-- Todos los usuarios autenticados ven todas las notas
-- (el cliente filtra por usuario_id en memoria — decisión de diseño)
CREATE POLICY "notas_select_auth" ON public.notas
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "notas_insert_own" ON public.notas
  FOR INSERT WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "notas_update_own" ON public.notas
  FOR UPDATE USING (auth.uid() = usuario_id);

CREATE POLICY "notas_delete_own" ON public.notas
  FOR DELETE USING (auth.uid() = usuario_id);


-- ────────────────────────────────────────────────────────────
-- 5.3 RLS — mensajes (chat público)
-- DELETE no habilitado intencionalmente: los mensajes del
-- chat público son inmutables una vez enviados.
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.mensajes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mensajes_select_auth"  ON public.mensajes;
DROP POLICY IF EXISTS "mensajes_insert_own"   ON public.mensajes;

CREATE POLICY "mensajes_select_auth" ON public.mensajes
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "mensajes_insert_own" ON public.mensajes
  FOR INSERT WITH CHECK (auth.uid() = usuario_id);


-- ────────────────────────────────────────────────────────────
-- 5.4 RLS — apuntes
-- UPDATE no habilitado: los archivos no se editan, solo
-- se suben y se eliminan (reemplazar = borrar + subir nuevo).
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.apuntes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "apuntes_select_auth"  ON public.apuntes;
DROP POLICY IF EXISTS "apuntes_insert_own"   ON public.apuntes;
DROP POLICY IF EXISTS "apuntes_delete_own"   ON public.apuntes;

-- Todos pueden ver todos los apuntes (compartición entre alumnos)
CREATE POLICY "apuntes_select_auth" ON public.apuntes
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "apuntes_insert_own" ON public.apuntes
  FOR INSERT WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "apuntes_delete_own" ON public.apuntes
  FOR DELETE USING (auth.uid() = usuario_id);


-- ────────────────────────────────────────────────────────────
-- 5.5 RLS — mensajes_privados
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.mensajes_privados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mp_select_own"  ON public.mensajes_privados;
DROP POLICY IF EXISTS "mp_insert_own"  ON public.mensajes_privados;

-- Solo emisor o receptor pueden leer la conversación
CREATE POLICY "mp_select_own" ON public.mensajes_privados
  FOR SELECT USING (de_id = auth.uid() OR para_id = auth.uid());

-- Solo el emisor puede insertar (no puede suplantar a otro)
CREATE POLICY "mp_insert_own" ON public.mensajes_privados
  FOR INSERT WITH CHECK (de_id = auth.uid());


-- ────────────────────────────────────────────────────────────
-- 5.6 RLS — eventos (calendario)
-- Las políticas de INSERT/DELETE usan subquery en usuarios
-- para verificar el rol. El índice idx_usuarios_id_rol hace
-- que esa subquery sea un index-only scan (rendimiento óptimo).
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "eventos_select_auth"   ON public.eventos;
DROP POLICY IF EXISTS "eventos_insert_admin"  ON public.eventos;
DROP POLICY IF EXISTS "eventos_update_admin"  ON public.eventos;
DROP POLICY IF EXISTS "eventos_delete_admin"  ON public.eventos;

-- Todos los autenticados ven los eventos
CREATE POLICY "eventos_select_auth" ON public.eventos
  FOR SELECT USING (auth.role() = 'authenticated');

-- Solo admins pueden crear eventos
CREATE POLICY "eventos_insert_admin" ON public.eventos
  FOR INSERT WITH CHECK (
    (SELECT rol FROM public.usuarios WHERE id = auth.uid()) = 'admin'
  );

-- Solo admins pueden editar eventos (para futuras ediciones in-place)
CREATE POLICY "eventos_update_admin" ON public.eventos
  FOR UPDATE USING (
    (SELECT rol FROM public.usuarios WHERE id = auth.uid()) = 'admin'
  );

-- Solo admins pueden eliminar eventos
CREATE POLICY "eventos_delete_admin" ON public.eventos
  FOR DELETE USING (
    (SELECT rol FROM public.usuarios WHERE id = auth.uid()) = 'admin'
  );


-- ────────────────────────────────────────────────────────────
-- 5.7 RLS — actividades
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.actividades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "actividades_select_auth"   ON public.actividades;
DROP POLICY IF EXISTS "actividades_insert_admin"  ON public.actividades;
DROP POLICY IF EXISTS "actividades_update_admin"  ON public.actividades;
DROP POLICY IF EXISTS "actividades_delete_admin"  ON public.actividades;

CREATE POLICY "actividades_select_auth" ON public.actividades
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "actividades_insert_admin" ON public.actividades
  FOR INSERT WITH CHECK (
    (SELECT rol FROM public.usuarios WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "actividades_update_admin" ON public.actividades
  FOR UPDATE USING (
    (SELECT rol FROM public.usuarios WHERE id = auth.uid()) = 'admin'
  );

-- useActividades.ts borra actividades vencidas: solo admins
CREATE POLICY "actividades_delete_admin" ON public.actividades
  FOR DELETE USING (
    (SELECT rol FROM public.usuarios WHERE id = auth.uid()) = 'admin'
  );


-- ────────────────────────────────────────────────────────────
-- 5.8 RLS — actividades_estado
--   Alumnos: ven y modifican solo sus filas.
--   Admins: ven todas las filas (para stats de completado).
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.actividades_estado ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ae_select_own"    ON public.actividades_estado;
DROP POLICY IF EXISTS "ae_select_admin"  ON public.actividades_estado;
DROP POLICY IF EXISTS "ae_upsert_own"    ON public.actividades_estado;
DROP POLICY IF EXISTS "ae_update_own"    ON public.actividades_estado;

-- Alumnos ven sus propias filas
CREATE POLICY "ae_select_own" ON public.actividades_estado
  FOR SELECT USING (usuario_id = auth.uid());

-- Admins ven todas las filas (necesario para stats en useActividades)
CREATE POLICY "ae_select_admin" ON public.actividades_estado
  FOR SELECT USING (
    (SELECT rol FROM public.usuarios WHERE id = auth.uid()) = 'admin'
  );

-- Cada alumno inserta y actualiza solo sus propias filas
CREATE POLICY "ae_upsert_own" ON public.actividades_estado
  FOR INSERT WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "ae_update_own" ON public.actividades_estado
  FOR UPDATE USING (usuario_id = auth.uid());


-- ────────────────────────────────────────────────────────────
-- 5.9 RLS — anuncios
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.anuncios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anuncios_select_auth"   ON public.anuncios;
DROP POLICY IF EXISTS "anuncios_insert_admin"  ON public.anuncios;
DROP POLICY IF EXISTS "anuncios_update_admin"  ON public.anuncios;
DROP POLICY IF EXISTS "anuncios_delete_admin"  ON public.anuncios;

CREATE POLICY "anuncios_select_auth" ON public.anuncios
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "anuncios_insert_admin" ON public.anuncios
  FOR INSERT WITH CHECK (
    (SELECT rol FROM public.usuarios WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "anuncios_update_admin" ON public.anuncios
  FOR UPDATE USING (
    (SELECT rol FROM public.usuarios WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "anuncios_delete_admin" ON public.anuncios
  FOR DELETE USING (
    (SELECT rol FROM public.usuarios WHERE id = auth.uid()) = 'admin'
  );


-- ════════════════════════════════════════════════════════════
-- BLOQUE 6: STORAGE BUCKETS Y POLÍTICAS
-- ════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────
-- 6.1 Bucket "apuntes"
--   Público: cualquiera puede leer la URL (links directos).
--   Sube: usuarios autenticados, en carpeta propia (UID/archivo).
--   Borra: solo el propietario de la carpeta.
-- ────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('apuntes', 'apuntes', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "apuntes_storage_select"  ON storage.objects;
DROP POLICY IF EXISTS "apuntes_storage_insert"  ON storage.objects;
DROP POLICY IF EXISTS "apuntes_storage_delete"  ON storage.objects;

CREATE POLICY "apuntes_storage_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'apuntes');

CREATE POLICY "apuntes_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'apuntes'
    AND auth.role() = 'authenticated'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "apuntes_storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'apuntes'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );


-- ────────────────────────────────────────────────────────────
-- 6.2 Bucket "avatars"
--   Público: las fotos de perfil son accesibles sin auth.
--   Sube/actualiza/borra: solo el propio usuario en su carpeta.
--   El upload usa upsert:true (Profile.tsx: siempre sobreescribe
--   avatar.ext), por lo que la política UPDATE es necesaria.
-- ────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatars_select_public"  ON storage.objects;
DROP POLICY IF EXISTS "avatars_insert_own"     ON storage.objects;
DROP POLICY IF EXISTS "avatars_update_own"     ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete_own"     ON storage.objects;

-- Cualquiera puede ver avatares (sin auth, son URLs públicas)
CREATE POLICY "avatars_select_public" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Necesario para upsert:true en subirAvatar() (Profile.tsx)
CREATE POLICY "avatars_update_own" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );


-- ════════════════════════════════════════════════════════════
-- BLOQUE 7: REALTIME
-- Habilitar replicación en tiempo real para las tablas que
-- usan suscripciones Postgres Changes en el frontend.
-- ════════════════════════════════════════════════════════════

-- Chat público (Chat.tsx: channel 'public-chat', event INSERT)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'mensajes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mensajes;
  END IF;
END $$;

-- Chat privado (Chat.tsx: channel 'private-X-Y', event INSERT)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'mensajes_privados'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mensajes_privados;
  END IF;
END $$;

-- Anuncios (AnuncioModal.tsx: channel 'anuncios', event INSERT/UPDATE)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'anuncios'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.anuncios;
  END IF;
END $$;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 8: CONFIGURACIÓN INICIAL DE ROLES
-- ════════════════════════════════════════════════════════════

-- Para promover a admin al primer usuario (ejecutar manualmente
-- con el email correcto antes de que otros usuarios accedan):
--
--   UPDATE public.usuarios
--   SET rol = 'admin'
--   WHERE email = 'tu@email.com';
--
-- Para marcar al propietario como super-admin (puede cambiar roles
-- desde el panel de admin). NUNCA exponer este email en el código fuente:
--
--   UPDATE public.usuarios
--   SET es_superadmin = true
--   WHERE email = 'tu@email.com';


-- ════════════════════════════════════════════════════════════
-- NOTAS DE RENDIMIENTO Y DECISIONES DE DISEÑO
-- ════════════════════════════════════════════════════════════
--
-- ÍNDICES ESTRATÉGICOS:
--   - idx_notas_usuario_created: cubre la query principal de Notes.tsx
--     (filter usuario_id + sort created_at). Índice compuesto = evita
--     un Index Scan + Sort separados.
--   - idx_notas_usuario_media: índice cubriente para actualizarPromedio()
--     en supabase.ts. SELECT media WHERE usuario_id = X → index-only scan.
--   - idx_mp_de_para / idx_mp_para_de: los dos lados del OR en la query
--     de chat privado. PostgreSQL hace BitmapOr sobre ambos índices.
--   - idx_usuarios_id_rol: cubriente para las subqueries de RLS en
--     eventos e usuarios_update_admin. Convierte esas comprobaciones
--     de pol en index-only scans sin ir al heap.
--
-- DESNORMALIZACIÓN JUSTIFICADA:
--   - mensajes.autor y mensajes_privados.de_nombre: el nombre del
--     emisor se almacena en el mensaje para evitar JOINs en tiempo
--     real. Si el usuario cambia su nombre, los mensajes históricos
--     mantienen el nombre original — comportamiento aceptable en chat.
--
-- COLUMNAS MOBILE ELIMINADAS:
--   - push_token: columna de Expo Notifications, no usada en web.
--     Se documenta pero NO se elimina automáticamente para preservar
--     datos en instancias de producción existentes.
--
-- REALTIME:
--   - Solo "mensajes" y "mensajes_privados" tienen Realtime habilitado.
--   - "eventos" y "apuntes" usan polling manual (botón Refresh) —
--     apropiado dado su baja frecuencia de cambio.
--   - "notas" nunca necesita Realtime (son datos privados por usuario).
--
-- ALTA CONCURRENCIA (intranet académica):
--   - InnoDB no aplica (es PostgreSQL/Supabase). El motor usa MVCC
--     nativo, que maneja concurrencia sin bloqueos de lectura.
--   - Las políticas RLS con subquery (rol = admin) se evalúan por fila.
--     Los índices cubrientes en usuarios(id) INCLUDE (rol) minimizan
--     el overhead de esas evaluaciones bajo carga simultánea.
--   - El chat público (.limit(100)) previene queries de carga masiva.
--     En producción con > 1000 mensajes, considerar paginación por
--     cursor (created_at < cursor) en lugar de offset.
--
-- SEGURIDAD:
--   - El bucket "apuntes_storage_insert" original no validaba que la
--     carpeta perteneciera al usuario autenticado. v2.0 añade la
--     comprobación auth.uid()::text = (storage.foldername(name))[1]
--     para que ningún usuario suba archivos en la carpeta de otro.
--   - RLS habilitado en todas las tablas. Sin políticas = acceso
--     denegado por defecto en Supabase.
-- ════════════════════════════════════════════════════════════
