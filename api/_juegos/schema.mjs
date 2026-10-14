// Tablas de juegos. Las crea la propia función la primera vez (idempotente); el mismo SQL está en
// supabase/migracion_juegos.sql por si se prefiere ejecutarlo a mano.
// RLS activado y sin políticas: desde el navegador no se puede leer ni escribir nada; solo la función del servidor.
export const SCHEMA_SQL = `
create table if not exists public.juegos_meta (
  id            int primary key default 1 check (id = 1),
  semana        text not null,
  semana_pasada jsonb
);

create table if not exists public.juegos_cuentas (
  usuario_id uuid primary key references public.usuarios(id) on delete cascade,
  nombre     text not null default '',
  avatar     text,
  saldo      bigint not null default 10000,
  dias       bigint[] not null default array[null, null, null, null, null, null, null]::bigint[],
  jugado     boolean not null default false,
  mesa       text,
  visto      timestamptz not null default now()
);
create index if not exists juegos_cuentas_ranking_idx on public.juegos_cuentas (saldo desc) where jugado;

create table if not exists public.juegos_mesas (
  codigo      text primary key,
  juego       text not null check (juego in ('blackjack', 'poker')),
  etiqueta    text not null,
  numero      int not null,
  persistente boolean not null default false,
  estado      jsonb not null,
  version     int not null default 0,
  actualizado timestamptz not null default now()
);
create unique index if not exists juegos_mesas_numero_idx on public.juegos_mesas (juego, numero);

create table if not exists public.juegos_chat (
  id         bigserial primary key,
  mesa       text not null,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  nombre     text not null,
  avatar     text,
  texto      text not null check (char_length(texto) between 1 and 200),
  creado     timestamptz not null default now()
);
create index if not exists juegos_chat_mesa_idx on public.juegos_chat (mesa, id desc);

alter table public.juegos_meta    enable row level security;
alter table public.juegos_cuentas enable row level security;
alter table public.juegos_mesas   enable row level security;
alter table public.juegos_chat    enable row level security;
`
