import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useForoPost } from '@topcode/shared'
import ForoPostView, { HiloCargando, HiloNoEncontrado } from '../components/foro/ForoPostView'

export default function ForoPost() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const { post, respuestas, loading, error, addRespuesta, markSolucion, markResuelto } = useForoPost(id)

  const [texto, setTexto] = useState('')
  const [sending, setSending] = useState(false)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (respuestas.length > 0) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [respuestas.length])

  const isPostAuthor = usuario?.id === post?.usuario_id
  const canResolve = isPostAuthor || usuario?.rol === 'admin'

  async function handleReply(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim() || !usuario) return
    setSending(true)
    await addRespuesta({ usuario_id: usuario.id, autor: usuario.nombre, cuerpo: texto.trim() })
    setTexto('')
    setSending(false)
  }

  async function handleMarkSolucion(respuestaId: string) {
    setMarkingId(respuestaId)
    await markSolucion(respuestaId)
    if (!post?.resuelto) await markResuelto()
    setMarkingId(null)
  }

  if (loading) return <HiloCargando />

  if (error || !post) return <HiloNoEncontrado onVolver={() => navigate('/foro')} />

  return (
    <ForoPostView
      post={post}
      respuestas={respuestas}
      nombreUsuario={usuario?.nombre ?? '?'}
      canResolve={canResolve}
      texto={texto}
      onTexto={setTexto}
      sending={sending}
      markingId={markingId}
      onVolver={() => navigate('/foro')}
      onMarcarResuelta={markResuelto}
      onSolucion={handleMarkSolucion}
      onEnviar={handleReply}
      endRef={endRef}
    />
  )
}
