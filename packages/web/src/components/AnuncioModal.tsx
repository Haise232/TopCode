import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Anuncio, onBroadcast } from '@topcode/shared'
import { AnuncioDialogo } from './acceso/AnuncioDialogo'

// Clave localStorage: topcode-anuncio-leido-{userId}-{anuncioId}
// Así cada usuario tiene su propio estado de lectura por anuncio.
function leyoAnuncio(userId: string, anuncioId: string): boolean {
  return localStorage.getItem(`topcode-anuncio-leido-${userId}-${anuncioId}`) === '1'
}

function marcarLeido(userId: string, anuncioId: string) {
  localStorage.setItem(`topcode-anuncio-leido-${userId}-${anuncioId}`, '1')
}

export default function AnuncioModal() {
  const { usuario } = useAuth()
  const [anuncio, setAnuncio] = useState<Anuncio | null>(null)
  const [visible, setVisible] = useState(false)
  const [cerrando, setCerrando] = useState(false)

  useEffect(() => {
    if (!usuario) return

    async function cargar() {
      const { data } = await supabase
        .from('anuncios')
        .select('id, titulo, contenido, activo, created_at, created_by')
        .eq('activo', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!data) return
      if (leyoAnuncio(usuario!.id, data.id)) return
      setAnuncio(data)
      setVisible(true)
    }

    cargar()

    // Escuchar nuevos anuncios en tiempo real
    return onBroadcast('anuncios', 'cambio', () => { cargar() })
  }, [usuario])

  function handleLeer() {
    if (!anuncio || !usuario) return
    setCerrando(true)
    marcarLeido(usuario.id, anuncio.id)
    setTimeout(() => {
      setVisible(false)
      setCerrando(false)
      setAnuncio(null)
    }, 220)
  }

  if (!visible || !anuncio) return null

  return <AnuncioDialogo anuncio={anuncio} cerrando={cerrando} onLeido={handleLeer} />
}
