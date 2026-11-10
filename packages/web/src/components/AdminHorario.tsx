import { useState, useEffect, useCallback } from 'react'
import { useHorario, type HorarioClase, MATERIAS } from '@topcode/shared'
import HorarioPanel from './admin/HorarioPanel'
import FormularioClase from './admin/FormularioClase'
import { DIAS_SEMANA } from './admin/dias'
import AlertModal from './AlertModal'
import { useAuth } from '../hooks/useAuth'

type FormState = {
  dia_semana: number
  hora_inicio: string
  hora_fin: string
  codigo: string
}

const EMPTY_FORM: FormState = {
  dia_semana: 1,
  hora_inicio: '',
  hora_fin: '',
  codigo: MATERIAS[0].codigo,
}

type AlertState = {
  type?: 'error' | 'success' | 'info' | 'warning'
  title: string
  message?: string
  onConfirm?: () => void
  confirmLabel?: string
  confirmDestructive?: boolean
} | null

export default function AdminHorario() {
  const { usuario } = useAuth()
  const claseSeleccionada = usuario?.clase ?? null
  const { porDia, loading, init, createClase, updateClase, deleteClase } = useHorario(claseSeleccionada)

  const [modalVisible, setModalVisible] = useState(false)
  const [editando, setEditando] = useState<HorarioClase | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState<AlertState>(null)

  useEffect(() => { init() }, [init])

  const abrirNuevo = useCallback(() => {
    setEditando(null)
    setForm(EMPTY_FORM)
    setModalVisible(true)
  }, [])

  function abrirEditar(c: HorarioClase) {
    setEditando(c)
    setForm({
      dia_semana: c.dia_semana,
      hora_inicio: c.hora_inicio,
      hora_fin: c.hora_fin,
      codigo: c.codigo,
    })
    setModalVisible(true)
  }

  function cerrarModal() {
    setModalVisible(false)
    setEditando(null)
  }

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.hora_inicio || !form.hora_fin) {
      setAlert({ type: 'error', title: 'Error', message: 'La hora de inicio y fin son obligatorias.' })
      return
    }
    if (form.hora_fin <= form.hora_inicio) {
      setAlert({ type: 'error', title: 'Error', message: 'La hora de fin debe ser posterior a la de inicio.' })
      return
    }

    const materiaInfo = MATERIAS.find(m => m.codigo === form.codigo)
    const payload = {
      dia_semana: form.dia_semana,
      hora_inicio: form.hora_inicio,
      hora_fin: form.hora_fin,
      materia: materiaInfo?.nombreCorto ?? form.codigo,
      codigo: form.codigo,
    }

    setSaving(true)
    let error: string | null
    try {
      ({ error } = editando
        ? await updateClase(editando.id, payload)
        : await createClase(payload))
    } catch {
      error = 'Error de conexión. Inténtalo de nuevo.'
    } finally {
      setSaving(false)
    }

    if (error) {
      setAlert({ type: 'error', title: 'Error', message: 'No se pudo guardar: ' + error })
      return
    }
    cerrarModal()
  }

  function handleEliminar(c: HorarioClase) {
    setAlert({
      title: 'Eliminar clase',
      message: `¿Eliminar "${c.materia}" del ${DIAS_SEMANA[c.dia_semana].toLowerCase()} (${c.hora_inicio}-${c.hora_fin})?`,
      confirmLabel: 'Eliminar',
      confirmDestructive: true,
      onConfirm: async () => {
        const { error } = await deleteClase(c.id)
        if (error) setAlert({ type: 'error', title: 'Error', message: 'No se pudo eliminar la clase.' })
      },
    })
  }

  return (
    <>
      <HorarioPanel
        clase={claseSeleccionada}
        loading={loading}
        porDia={porDia}
        onNueva={abrirNuevo}
        onEditar={abrirEditar}
        onEliminar={handleEliminar}
      />

      {modalVisible && claseSeleccionada !== null && (
        <FormularioClase
          editando={editando !== null}
          clase={claseSeleccionada}
          form={form}
          setForm={setForm}
          saving={saving}
          onSubmit={handleGuardar}
          onClose={cerrarModal}
        />
      )}

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
