import { useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { usePrompts } from '@topcode/shared'
import PromptsView from '../components/prompts/PromptsView'
import FormularioPrompt from '../components/prompts/FormularioPrompt'
import type { Prompt, PromptCategoria, PromptInput } from '@topcode/shared'

const EMPTY_FORM: PromptInput = { titulo: '', contenido: '', descripcion: '', categoria: 'general', modelo: 'cualquiera' }

export default function Prompts() {
  const { usuario } = useAuth()
  const { prompts, loading, error, addPrompt, updatePrompt, deletePrompt } = usePrompts()
  const [filtro, setFiltro] = useState<'todos' | PromptCategoria>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [editing, setEditing] = useState<Prompt | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<PromptInput>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const isAdmin = usuario?.rol === 'admin'

  const filtered = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return prompts.filter(p =>
      (filtro === 'todos' || p.categoria === filtro) &&
      (!q || p.titulo.toLowerCase().includes(q) || p.contenido.toLowerCase().includes(q) || (p.descripcion ?? '').toLowerCase().includes(q)),
    )
  }, [prompts, filtro, busqueda])

  function openNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setShowModal(true)
  }

  function openEdit(p: Prompt) {
    setEditing(p)
    setForm({ titulo: p.titulo, contenido: p.contenido, descripcion: p.descripcion ?? '', categoria: p.categoria, modelo: p.modelo })
    setFormError(null)
    setShowModal(true)
  }

  function closeModal() { setShowModal(false); setEditing(null); setForm(EMPTY_FORM); setFormError(null) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.titulo.trim() || !form.contenido.trim()) {
      setFormError('El título y el prompt son obligatorios.')
      return
    }
    if (!usuario) return
    setSaving(true)
    setFormError(null)
    const data: PromptInput = {
      titulo: form.titulo.trim(),
      contenido: form.contenido.trim(),
      descripcion: form.descripcion?.trim() || null,
      categoria: form.categoria,
      modelo: form.modelo,
    }
    const { error: err } = editing
      ? await updatePrompt(editing.id, data)
      : await addPrompt({ ...data, usuario_id: usuario.id, autor: usuario.nombre })
    setSaving(false)
    if (err) { setFormError(err); return }
    closeModal()
  }

  async function handleCopy(p: Prompt) {
    try {
      await navigator.clipboard.writeText(p.contenido)
      setCopiedId(p.id)
      setTimeout(() => setCopiedId(c => (c === p.id ? null : c)), 1500)
    } catch { /* el navegador bloqueó el portapapeles */ }
  }

  async function handleDelete(p: Prompt) {
    if (!confirm(`¿Eliminar el prompt "${p.titulo}"?`)) return
    await deletePrompt(p.id)
  }

  function toggleExpanded(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <>
      <PromptsView
        prompts={prompts}
        filtered={filtered}
        loading={loading}
        error={error}
        filtro={filtro}
        onFiltro={setFiltro}
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        usuarioId={usuario?.id}
        isAdmin={isAdmin}
        copiedId={copiedId}
        expanded={expanded}
        onNuevo={openNew}
        onEditar={openEdit}
        onEliminar={handleDelete}
        onCopiar={handleCopy}
        onToggle={toggleExpanded}
      />
      {showModal && (
        <FormularioPrompt
          editando={!!editing}
          form={form}
          setForm={setForm}
          saving={saving}
          error={formError}
          onSubmit={handleSave}
          onClose={closeModal}
        />
      )}
    </>
  )
}
