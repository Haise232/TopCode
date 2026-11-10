import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useNotas, type Nota, type UsuarioPublico } from '@topcode/shared'
import AlertModal from '../components/AlertModal'
import { supabase } from '../lib/supabase'
import AddNotaModal from '../components/notas/AddNotaModal'
import NotasView from '../components/notas/NotasView'

type AlertState = {
  type?: 'error' | 'success' | 'info' | 'warning'
  title: string
  message?: string
  onConfirm?: () => void
  confirmLabel?: string
  confirmDestructive?: boolean
} | null

export default function Notas() {
  const { usuario } = useAuth()
  const isAdmin = usuario?.rol === 'admin'

  // Para admin: selector de alumno
  const [alumnos, setAlumnos] = useState<UsuarioPublico[]>([])
  const [selectedId, setSelectedId] = useState<string | undefined>(
    isAdmin ? undefined : usuario?.id
  )
  const targetId = isAdmin ? selectedId : usuario?.id

  const {
    notas, loading,
    init, refresh,
    addNotaOptimistic, deleteNotaOptimistic,
  } = useNotas({ usuarioId: targetId })

  const [refreshing, setRefreshing] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState<AlertState>(null)

  // Cargar alumnos si es admin
  useEffect(() => {
    if (!isAdmin) return
    supabase
      .from('usuarios')
      .select('id, nombre, avatar_url, rol')
      .order('nombre')
      .then(({ data }) => {
        if (data) setAlumnos(data as UsuarioPublico[])
      })
  }, [isAdmin])

  useEffect(() => { init() }, [init])

  async function handleRefresh() {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }

  async function handleAddNota(f: { materia: string; tema: string; teorica: number; practica: number; media: number }) {
    if (!targetId) return
    setSaving(true)
    const { error } = await addNotaOptimistic({ ...f, usuario_id: targetId })
    setSaving(false)
    setAddOpen(false)
    if (error) {
      setAlert({ type: 'error', title: 'Error al guardar', message: error })
    }
  }

  function handleDelete(nota: Nota) {
    setAlert({
      title: 'Eliminar nota',
      message: `¿Eliminar la nota de "${nota.tema}" (${nota.materia})?`,
      confirmLabel: 'Eliminar',
      confirmDestructive: true,
      onConfirm: async () => {
        const { error } = await deleteNotaOptimistic(nota.id)
        if (error) setAlert({ type: 'error', title: 'Error', message: 'No se pudo eliminar la nota.' })
      },
    })
  }

  const targetNombre = isAdmin
    ? alumnos.find(a => a.id === targetId)?.nombre
    : usuario?.nombre

  return (
    <>
      <NotasView
        isAdmin={isAdmin}
        targetId={targetId}
        targetNombre={targetNombre}
        alumnos={alumnos}
        selectedId={selectedId}
        onSelectAlumno={setSelectedId}
        notas={notas}
        loading={loading}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onAdd={() => setAddOpen(true)}
        onDelete={handleDelete}
      />

      <AddNotaModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAddNota}
        saving={saving}
        targetNombre={targetNombre}
      />

      <AlertModal
        visible={alert !== null}
        type={alert?.type}
        title={alert?.title ?? ''}
        message={alert?.message}
        onClose={() => setAlert(null)}
        onConfirm={alert?.onConfirm}
        confirmLabel={alert?.confirmLabel}
        confirmDestructive={alert?.confirmDestructive}
      />
    </>
  )
}
