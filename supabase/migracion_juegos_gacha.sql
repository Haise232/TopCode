-- Gacha de Juegos, al estilo de Mudae: tiradas que ve todo el mundo, reclamar la carta antes que nadie y colección.
-- Las cartas (anime, cine y políticos) no están en la base de datos: viven en api/_juegos/gacha-catalogo.json.
-- RLS activado y sin políticas, como el resto de Juegos: solo la función del servidor lee y escribe.

-- Cada carta tiene como mucho un dueño.
create table if not exists public.juegos_gacha_cartas (
  carta      text primary key,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  reclamada  timestamptz not null default now()
);
create index if not exists juegos_gacha_cartas_usuario_idx on public.juegos_gacha_cartas (usuario_id);

-- Lo que ha salido en las tiradas de todos (el canal del gacha). Se borra lo de hace más de 7 días.
create table if not exists public.juegos_gacha_tiradas (
  id            bigserial primary key,
  usuario_id    uuid not null references public.usuarios(id) on delete cascade,
  carta         text not null,
  premium       boolean not null default false,
  creada        timestamptz not null default now(),
  reclamada_por uuid references public.usuarios(id) on delete set null
);
create index if not exists juegos_gacha_tiradas_creada_idx on public.juegos_gacha_tiradas (creada desc);

-- Tiradas gastadas en la hora en curso, cuándo puede volver a reclamar y su kakera.
create table if not exists public.juegos_gacha_jugadores (
  usuario_id    uuid primary key references public.usuarios(id) on delete cascade,
  hora          bigint not null default 0,
  tiradas       int not null default 0,
  reclamo_listo timestamptz not null default 'epoch',
  kakera        bigint not null default 0
);

alter table public.juegos_gacha_cartas    enable row level security;
alter table public.juegos_gacha_tiradas   enable row level security;
alter table public.juegos_gacha_jugadores enable row level security;

-- La función de Juegos se conecta como juegos_api (dueño de las demás tablas de juegos): si esta migración se ejecuta
-- como postgres, las tablas tienen que pasar a ser suyas o cada petición del gacha falla con «permission denied».
alter table public.juegos_gacha_cartas    owner to juegos_api;
alter table public.juegos_gacha_tiradas   owner to juegos_api;
alter table public.juegos_gacha_jugadores owner to juegos_api;
alter sequence public.juegos_gacha_tiradas_id_seq owner to juegos_api;
revoke all on public.juegos_gacha_cartas, public.juegos_gacha_tiradas, public.juegos_gacha_jugadores from anon, authenticated, service_role;
revoke all on sequence public.juegos_gacha_tiradas_id_seq from anon, authenticated, service_role;
