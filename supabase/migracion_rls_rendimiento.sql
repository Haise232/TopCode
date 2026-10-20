-- Rendimiento de RLS (avisos «auth_rls_initplan» y «unindexed_foreign_keys» de Supabase).
-- auth.uid(), auth.role() y las funciones tc_usuario_*() no dependen de la fila: dentro de (select …) Postgres las
-- calcula una vez por consulta en lugar de una vez por fila. Solo cambia eso; quién puede hacer qué sigue igual.

alter policy usuarios_update_own on public.usuarios
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id and rol = (select public.tc_usuario_rol_actual()));

alter policy apuntes_insert_admin_clase on public.apuntes
  with check (usuario_id = (select auth.uid()) and clase = (select public.tc_usuario_clase_actual())
    and (select public.tc_usuario_rol_actual()) = 'admin');

alter policy eventos_insert_admin_clase on public.eventos
  with check (clase = (select public.tc_usuario_clase_actual()) and created_by = (select auth.uid())
    and (select public.tc_usuario_rol_actual()) = 'admin');

alter policy eventos_select_auth on public.eventos
  using ((select auth.role()) = 'authenticated');

alter policy actividades_insert_admin_clase on public.actividades
  with check (clase = (select public.tc_usuario_clase_actual()) and created_by = (select auth.uid())
    and (select public.tc_usuario_rol_actual()) = 'admin');

alter policy actividades_select_auth on public.actividades
  using ((select auth.role()) = 'authenticated');

alter policy docs_colecciones_delete on public.docs_colecciones
  using (created_by = (select auth.uid()) or (select public.tc_usuario_rol_actual()) = 'admin'
    or (select public.tc_usuario_es_superadmin()) = true);

alter policy docs_colecciones_update on public.docs_colecciones
  using (created_by = (select auth.uid()) or (select public.tc_usuario_rol_actual()) = 'admin'
    or (select public.tc_usuario_es_superadmin()) = true);

alter policy docs_paginas_delete on public.docs_paginas
  using (created_by = (select auth.uid()) or (select public.tc_usuario_rol_actual()) = 'admin'
    or (select public.tc_usuario_es_superadmin()) = true);

alter policy ee_select_own on public.eventos_estado
  using (usuario_id = (select auth.uid()));

alter policy ee_insert_own on public.eventos_estado
  with check (usuario_id = (select auth.uid()) and exists (
    select 1 from public.eventos e
    where e.id = eventos_estado.evento_id and e.clase = (select public.tc_usuario_clase_actual())
      and e.tipo in ('actividad', 'trabajo')));

alter policy ee_update_own on public.eventos_estado
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()) and exists (
    select 1 from public.eventos e
    where e.id = eventos_estado.evento_id and e.clase = (select public.tc_usuario_clase_actual())
      and e.tipo in ('actividad', 'trabajo')));

alter policy ee_delete_own on public.eventos_estado
  using (usuario_id = (select auth.uid()) and exists (
    select 1 from public.eventos e
    where e.id = eventos_estado.evento_id and e.clase = (select public.tc_usuario_clase_actual())
      and e.tipo in ('actividad', 'trabajo')));

-- Claves foráneas sin índice: al borrar un usuario, Postgres tenía que recorrer estas tablas enteras.
create index if not exists idx_docs_colecciones_created_by on public.docs_colecciones (created_by);
create index if not exists idx_docs_paginas_created_by on public.docs_paginas (created_by);
create index if not exists idx_docs_paginas_updated_by on public.docs_paginas (updated_by);
create index if not exists idx_docs_revisiones_editado_por on public.docs_revisiones (editado_por);
create index if not exists idx_foro_posts_usuario on public.foro_posts (usuario_id);
create index if not exists idx_foro_respuestas_usuario on public.foro_respuestas (usuario_id);
create index if not exists idx_passwords_temporales_creada_por on public.passwords_temporales (creada_por);
