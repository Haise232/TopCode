import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Megaphone, CheckCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Anuncio } from '../lib/types'

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
        .single()

      if (!data) return
      if (leyoAnuncio(usuario!.id, data.id)) return
      setAnuncio(data)
      setVisible(true)
    }

    cargar()

    // Escuchar nuevos anuncios en tiempo real
    const channel = supabase
      .channel('anuncios-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'anuncios' }, () => {
        cargar()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
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

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ animation: cerrando ? 'fade-out 0.2s ease-in forwards' : 'fade-in 0.2s ease-out' }}
    >
      {/* Backdrop — no se puede cerrar haciendo click fuera */}
      <div
        className="absolute inset-0"
        style={{ background: 'var(--color-modal-backdrop)', backdropFilter: 'blur(8px)' }}
      />

      {/* Card */}
      <div
        className="relative w-full max-w-md rounded-2xl shadow-modal"
        style={{
          background: 'var(--gradient-card)',
          border: '1px solid rgba(85,239,196,0.25)',
          boxShadow: '0 0 0 1px rgba(85,239,196,0.1), 0 24px 64px var(--color-modal-backdrop)',
          animation: cerrando ? 'scale-out 0.2s ease-in forwards' : 'scale-in-modal 0.25s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Glow superior */}
        <div
          className="absolute inset-x-0 top-0 h-px rounded-t-2xl"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(85,239,196,0.6), transparent)' }}
        />

        <div className="p-6">
          {/* Icono + título */}
          <div className="flex items-start gap-4 mb-4">
            <div
              className="w-11 h-11 flex items-center justify-center rounded-xl shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgba(85,239,196,0.2), rgba(0,206,201,0.15))',
                border: '1px solid rgba(85,239,196,0.3)',
                boxShadow: '0 2px 12px rgba(85,239,196,0.2)',
              }}
            >
              <Megaphone size={20} style={{ color: '#8ff5d6' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#55efc4' }}>
                Comunicado
              </p>
              <h2 className="font-extrabold text-lg leading-snug" style={{ color: 'var(--color-text)' }}>
                {anuncio.titulo}
              </h2>
            </div>
          </div>

          {/* Contenido */}
          <div
            className="rounded-xl p-4 mb-5 text-sm leading-relaxed whitespace-pre-wrap"
            style={{
              background: 'var(--overlay-03)',
              border: '1px solid var(--overlay-06)',
              color: '#cbd5e1',
            }}
          >
            {anuncio.contenido}
          </div>

          {/* Fecha */}
          <p className="text-xs mb-5" style={{ color: '#4b5563' }}>
            {new Date(anuncio.created_at).toLocaleDateString('es', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })}
          </p>

          {/* Botón — único modo de cerrar */}
          <button
            onClick={handleLeer}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all duration-150 active:scale-[0.97]"
            style={{
              background: 'linear-gradient(135deg, #55efc4, #00cec9)',
              color: 'white',
              boxShadow: '0 4px 16px rgba(85,239,196,0.35)',
            }}
          >
            <CheckCheck size={16} />
            He leído el mensaje
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fade-out  { to { opacity: 0 } }
        @keyframes scale-out { to { opacity: 0; transform: scale(0.95) } }
      `}</style>
    </div>,
    document.body,
  )
}
