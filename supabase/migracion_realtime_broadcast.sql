-- Realtime por Broadcast en lugar de postgres_changes.
-- Con postgres_changes, Supabase Realtime lee sin parar todo lo que se escribe en la base de datos (también las jugadas
-- de Juegos) para buscar cambios: era lo que más disco y CPU gastaba. Ahora cada tabla avisa con un trigger solo cuando
-- cambia, por canales privados cuyas políticas (en realtime.messages) dicen quién puede escuchar cada tema:
--   chat:<canal>  mensajes del chat público (INSERT / UPDATE) y «escribiendo…» de los navegadores
--   dm:<usuario>  mensajes privados que recibe ese usuario (INSERT)
--   eventos       eventos nuevos del calendario (INSERT)
--   anuncios      cualquier cambio en los anuncios (solo el aviso; el cliente vuelve a cargar)

-- ── Triggers ──────────────────────────────────────────────────────────────────

create or replace function public.tc_rt_mensajes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(
    jsonb_build_object('id', new.id, 'usuario_id', new.usuario_id, 'autor', new.autor, 'texto', new.texto,
      'editado', new.editado, 'eliminado', new.eliminado, 'canal', new.canal, 'created_at', new.created_at),
    tg_op, 'chat:' || new.canal, true);
  return null;
end $$;

drop trigger if exists tc_rt_mensajes on public.mensajes;
create trigger tc_rt_mensajes after insert or update on public.mensajes
  for each row execute function public.tc_rt_mensajes();

create or replace function public.tc_rt_mensajes_privados() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(
    jsonb_build_object('id', new.id, 'de_id', new.de_id, 'de_nombre', new.de_nombre, 'para_id', new.para_id,
      'texto', new.texto, 'created_at', new.created_at),
    'INSERT', 'dm:' || new.para_id, true);
  return null;
end $$;

drop trigger if exists tc_rt_mensajes_privados on public.mensajes_privados;
create trigger tc_rt_mensajes_privados after insert on public.mensajes_privados
  for each row execute function public.tc_rt_mensajes_privados();

create or replace function public.tc_rt_eventos() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(to_jsonb(new), 'INSERT', 'eventos', true);
  return null;
end $$;

drop trigger if exists tc_rt_eventos on public.eventos;
create trigger tc_rt_eventos after insert on public.eventos
  for each row execute function public.tc_rt_eventos();

create or replace function public.tc_rt_anuncios() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send('{}'::jsonb, 'cambio', 'anuncios', true);
  return null;
end $$;

drop trigger if exists tc_rt_anuncios on public.anuncios;
create trigger tc_rt_anuncios after insert or update or delete on public.anuncios
  for each statement execute function public.tc_rt_anuncios();

revoke execute on function public.tc_rt_mensajes(), public.tc_rt_mensajes_privados(), public.tc_rt_eventos(),
  public.tc_rt_anuncios() from public, anon, authenticated;

-- ── Quién escucha qué ─────────────────────────────────────────────────────────

drop policy if exists tc_rt_leer on realtime.messages;
create policy tc_rt_leer on realtime.messages for select to authenticated using (
  realtime.messages.extension = 'broadcast' and (
    realtime.topic() = 'dm:' || (select auth.uid())::text
    or ((realtime.topic() like 'chat:%' or realtime.topic() in ('eventos', 'anuncios'))
        and (select public.tc_usuario_acceso_aprobado()))
  )
);

-- Lo único que mandan los navegadores es el «escribiendo…» del chat público.
drop policy if exists tc_rt_escribir on realtime.messages;
create policy tc_rt_escribir on realtime.messages for insert to authenticated with check (
  realtime.messages.extension = 'broadcast'
  and realtime.topic() like 'chat:%'
  and (select public.tc_usuario_acceso_aprobado())
);

-- ── Fuera postgres_changes ────────────────────────────────────────────────────
-- Sin tablas en la publicación, Realtime deja de leer los cambios de la base de datos.

alter publication supabase_realtime drop table public.mensajes, public.mensajes_privados, public.eventos, public.anuncios;
