-- Juegos es ahora GcGames, con su propio Supabase: fuera de TopCode sus tablas, sus roles y el acceso temporal que
-- se usó para copiar los datos. Ejecutar una vez en el editor SQL de Supabase (proyecto TopCode).
grant juegos_api to postgres;
grant juegos_migra to postgres;
drop owned by juegos_api cascade;
drop owned by juegos_migra cascade;
drop function if exists public.juegos_migra_export();
revoke juegos_api from postgres;
revoke juegos_migra from postgres;
drop role juegos_api;
drop role juegos_migra;
