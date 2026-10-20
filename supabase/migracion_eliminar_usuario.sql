-- Eliminar una cuenta desde el panel de admin: el perfil, todo lo suyo (en cascada) y la cuenta de inicio de sesión.
-- Mismas reglas que tc_password_temporal: el superadmin, a cualquiera; un admin de clase, solo a alumnos de su clase.
-- Nadie puede eliminarse a sí mismo ni eliminar al superadmin.
-- Los archivos que subió a Storage (avatar, apuntes) no se tocan: Supabase no deja borrarlos desde SQL.

create or replace function public.tc_eliminar_usuario(p_usuario uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  admin public.usuarios%rowtype;
  objetivo public.usuarios%rowtype;
begin
  select * into admin from public.usuarios where id = auth.uid();
  if admin.id is null or admin.rol <> 'admin' or admin.estado_acceso <> 'aprobado' then
    raise exception 'Solo un administrador puede eliminar cuentas' using errcode = '42501';
  end if;

  select * into objetivo from public.usuarios where id = p_usuario;
  if objetivo.id is null then
    raise exception 'Ese usuario no existe' using errcode = 'P0002';
  end if;
  if objetivo.id = admin.id then
    raise exception 'No puedes eliminar tu propia cuenta' using errcode = '42501';
  end if;
  if objetivo.es_superadmin then
    raise exception 'No se puede eliminar al superadmin' using errcode = '42501';
  end if;
  if not admin.es_superadmin and (objetivo.clase is distinct from admin.clase or objetivo.rol <> 'alumno') then
    raise exception 'Solo puedes eliminar alumnos de tu clase' using errcode = '42501';
  end if;

  -- actividades.created_by no se borra en cascada: la actividad se queda, sin autor.
  update public.actividades set created_by = null where created_by = p_usuario;
  delete from public.usuarios where id = p_usuario;
  delete from auth.users where id = p_usuario;
end $$;

revoke execute on function public.tc_eliminar_usuario(uuid) from public, anon;
grant execute on function public.tc_eliminar_usuario(uuid) to authenticated;
