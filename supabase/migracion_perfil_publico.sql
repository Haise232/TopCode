-- ════════════════════════════════════════════════════════════
-- Perfil público: añade created_at ("Miembro desde").
--   Cambia el tipo de retorno, así que hay que borrar y recrear.
-- ════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.get_perfil_publico(UUID);

CREATE FUNCTION public.get_perfil_publico(p_usuario_id UUID)
RETURNS TABLE(id UUID, nombre TEXT, avatar_url TEXT, rol TEXT, clase TEXT, es_superadmin BOOLEAN, bio TEXT,
  stack TEXT[], github_url TEXT, linkedin_url TEXT, portfolio_url TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select u.id, u.nombre, u.avatar_url, u.rol, u.clase, u.es_superadmin, u.bio, u.stack, u.github_url,
    u.linkedin_url, u.portfolio_url, u.created_at
  from public.usuarios u
  where u.id = p_usuario_id and public.tc_usuario_acceso_aprobado();
$$;

REVOKE ALL ON FUNCTION public.get_perfil_publico(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_perfil_publico(UUID) TO authenticated;
