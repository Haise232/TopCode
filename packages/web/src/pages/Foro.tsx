import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useForoPosts } from '@topcode/shared'
import ForoView from '../components/foro/ForoView'
import FormularioPregunta from '../components/foro/FormularioPregunta'

const EMPTY_FORM = { titulo: '', cuerpo: '', materia: 'duda' }

export default function Foro() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const { posts, loading, error, createPost, refresh } = useForoPosts()

  const [filtroMateria, setFiltroMateria] = useState('todos')
  const [soloSinResolver, setSoloSinResolver] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const filtered = posts
    .filter(p => filtroMateria === 'todos' || p.materia === filtroMateria)
    .filter(p => !soloSinResolver || !p.resuelto)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.titulo.trim()) { setFormError('El título es obligatorio.'); return }
    if (!form.cuerpo.trim()) { setFormError('Describe tu duda.'); return }
    if (!usuario) return
    setSaving(true)
    setFormError(null)
    const { error, id } = await createPost({
      usuario_id: usuario.id,
      autor: usuario.nombre,
      titulo: form.titulo.trim(),
      cuerpo: form.cuerpo.trim(),
      materia: form.materia,
    })
    setSaving(false)
    if (error) { setFormError(error); return }
    setForm(EMPTY_FORM)
    setShowModal(false)
    if (id) navigate(`/foro/${id}`)
  }

  function closeModal() { setShowModal(false); setForm(EMPTY_FORM); setFormError(null) }

  return (
    <>
      <ForoView
        posts={posts}
        filtered={filtered}
        loading={loading}
        error={error}
        onRetry={refresh}
        filtroMateria={filtroMateria}
        onFiltro={setFiltroMateria}
        soloSinResolver={soloSinResolver}
        onToggleSinResolver={() => setSoloSinResolver(v => !v)}
        onNueva={() => setShowModal(true)}
        onAbrir={id => navigate(`/foro/${id}`)}
      />
      {showModal && (
        <FormularioPregunta
          form={form}
          setForm={setForm}
          saving={saving}
          error={formError}
          onSubmit={handleCreate}
          onClose={closeModal}
        />
      )}
    </>
  )
}
