import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Anuncio, onBroadcast } from '@topcode/shared'
import { AnuncioDialogo } from './acceso/AnuncioDialogo'

// La lectura se guarda en anuncios_leidos (servidor), así cada anuncio sale una sola
// vez por usuario en cualquier dispositivo. localStorage solo evita la consulta extra.
const clave = (userId: string, anuncioId: Anuncio['id']) => `topcode-anuncio-leido-${userId}-${anuncioId}`

function leidoLocal(userId: string, anuncioId: Anuncio['id']): boolean {
  try { return localStorage.getItem(clave(userId, anuncioId)) === '1' } catch { return false }
}

function guardarLocal(userId: string, anuncioId: Anuncio['id']) {
  try { localStorage.setItem(clave(userId, anuncioId), '1') } catch { /* sin almacenamiento */ }
}

export default function AnuncioModal() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [anuncio, setAnuncio] = useState<Anuncio | null>(null)
  const [cerrando, setCerrando] = useState(false)

  useEffect(() => {
    if (!usuario) return
    const uid = usuario.id
    let vivo = true

    async function cargar() {
      const { data } = await supabase
        .from('anuncios')
        .select('id, titulo, contenido, enlace, activo, created_at, created_by')
        .eq('activo', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!vivo || !data || leidoLocal(uid, data.id)) return

      const { data: leido } = await supabase
        .from('anuncios_leidos')
        .select('anuncio_id')
        .eq('usuario_id', uid)
        .eq('anuncio_id', data.id)
        .maybeSingle()

      if (!vivo) return
      if (leido) { guardarLocal(uid, data.id); return }
      setAnuncio(data as Anuncio)
    }

    cargar()
    // Nuevos anuncios en tiempo real
    const quitar = onBroadcast('anuncios', 'cambio', () => { cargar() })
    return () => { vivo = false; quitar() }
  }, [usuario])

  function cerrar(destino?: string) {
    if (!anuncio || !usuario) return
    guardarLocal(usuario.id, anuncio.id)
    // upsert: si ya existía (otra pestaña), no falla
    supabase.from('anuncios_leidos')
      .upsert({ anuncio_id: anuncio.id, usuario_id: usuario.id }, { onConflict: 'usuario_id,anuncio_id', ignoreDuplicates: true })
      .then(() => {})
    setCerrando(true)
    setTimeout(() => {
      setAnuncio(null)
      setCerrando(false)
      if (destino) navigate(destino)
    }, 220)
  }

  if (!anuncio) return null

  return (
    <AnuncioDialogo
      anuncio={anuncio}
      cerrando={cerrando}
      onLeido={() => cerrar()}
      onAbrir={anuncio.enlace ? () => cerrar(anuncio.enlace!) : undefined}
    />
  )
}
