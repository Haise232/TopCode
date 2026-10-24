-- Juegos, Season 3: la Torre, el Atraco, la Subasta a ciegas y el Puente de Cristal guardan su partida en juegos_solo
-- (como la ruleta o el bingo), así que se amplía el check de la columna juego. Se puede ejecutar más de una vez.
alter table public.juegos_solo drop constraint if exists juegos_solo_juego_check;
alter table public.juegos_solo add constraint juegos_solo_juego_check
  check (juego in ('roulette', 'blackjack', 'crash', 'frog', 'race', 'dungeon', 'bribe', 'wheel', 'bingo', 'tower', 'heist', 'auction', 'bridge'));
