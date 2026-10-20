-- Seguridad (avisos del linter de Supabase).
-- 1. Funciones SECURITY DEFINER que se podían llamar sin iniciar sesión por /rest/v1/rpc. Todas las usa la web con
--    sesión (las páginas van detrás del login), así que basta con quitárselas a anon y a PUBLIC.
--    Las tc_usuario_*() las siguen necesitando las políticas RLS de authenticated: solo devuelven datos de quien llama.
-- 2. Funciones de trigger: nadie tiene que llamarlas a mano (Postgres solo comprueba el permiso al crear el trigger).
-- 3. La vista usuarios_publicos se saltaba la RLS de quien la consulta: ahora la respeta (security_invoker), así una
--    cuenta pendiente de aprobar ya no ve la lista de usuarios. Sus columnas ya tenían permiso de lectura.
-- 4. get_perfil_publico: además, solo para cuentas aprobadas.

revoke execute on function
  public.es_admin(),
  public.get_mi_perfil(),
  public.get_perfil_publico(uuid),
  public.get_todos_usuarios(),
  public.tc_puede_borrar_apunte_storage(text),
  public.tc_usuario_acceso_aprobado(),
  public.tc_usuario_clase_actual(),
  public.tc_usuario_es_superadmin(),
  public.tc_usuario_rol_actual()
from public, anon;

grant execute on function
  public.es_admin(),
  public.get_mi_perfil(),
  public.get_perfil_publico(uuid),
  public.get_todos_usuarios(),
  public.tc_puede_borrar_apunte_storage(text),
  public.tc_usuario_acceso_aprobado(),
  public.tc_usuario_clase_actual(),
  public.tc_usuario_es_superadmin(),
  public.tc_usuario_rol_actual()
to authenticated;

revoke execute on function
  public.handle_new_user(),
  public.tc_docs_guardar_revision(),
  public.tc_docs_set_autoria()
from public, anon, authenticated;

alter view public.usuarios_publicos set (security_invoker = on);

create or replace function public.get_perfil_publico(p_usuario_id uuid)
returns table(id uuid, nombre text, avatar_url text, rol text, clase text, es_superadmin boolean, bio text,
  stack text[], github_url text, linkedin_url text, portfolio_url text)
language sql stable security definer set search_path to 'public' as $$
  select u.id, u.nombre, u.avatar_url, u.rol, u.clase, u.es_superadmin, u.bio, u.stack, u.github_url,
    u.linkedin_url, u.portfolio_url
  from public.usuarios u
  where u.id = p_usuario_id and public.tc_usuario_acceso_aprobado();
$$;
