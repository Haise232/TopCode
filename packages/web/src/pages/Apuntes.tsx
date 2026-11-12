import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useApuntes } from '../hooks/useApuntes'
import type { ApunteConAutor } from '../hooks/useApuntes'
import AlertModal from '../components/AlertModal'
import ApuntesView, { ApuntesEsqueleto, SIN_ASIGNATURA } from '../components/apuntes/ApuntesView'
import { ClasificarDialogo } from '../components/apuntes/Dialogos'
import { TIPO_CONFIG, tipoFromMime } from '../components/apuntes/tipos'

type AlertState = {
  type?: 'error' | 'success' | 'info' | 'warning'
  title: string
  message?: string
  onConfirm?: () => void
  confirmLabel?: string
  confirmDestructive?: boolean
} | null

export default function Apuntes() {
  const { usuario } = useAuth()
  const isAdmin = usuario?.rol === 'admin'
  const canManage = isAdmin && usuario?.clase != null

  const {
    apuntes,
    loading,
    subiendo,
    init,
    refresh,
    subirApunte,
    clasificarApunte,
    eliminarApunte,
  } = useApuntes(usuario?.clase)

  const [refreshing, setRefreshing] = useState(false)
  const [alert, setAlert] = useState<AlertState>(null)

  // Asignatura abierta en la URL (?asignatura=…) para que «atrás» y los enlaces funcionen.
  const [params, setParams] = useSearchParams()
  const asignatura = params.get('asignatura')
  const abrirAsignatura = useCallback((a: string | null) => {
    setParams(a ? { asignatura: a } : {})
  }, [setParams])

  // Diálogo de asignatura y UT: para un archivo nuevo o para mover uno existente.
  const [uploadPendingFile, setUploadPendingFile] = useState<File | null>(null)
  const [moviendo, setMoviendo] = useState<ApunteConAutor | null>(null)
  const [guardandoMover, setGuardandoMover] = useState(false)
  const [dlgMateria, setDlgMateria] = useState('')
  const [dlgUt, setDlgUt] = useState<number | null>(null)

  useEffect(() => { init() }, [init])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }, [refresh])

  // En vez de subir directamente, abre el modal de confirmación
  function prepararSubida(file: File) {
    if (file.size > 20 * 1024 * 1024) {
      setAlert({ type: 'error', title: 'Archivo muy grande', message: 'El archivo no puede superar los 20 MB.' })
      return
    }
    // Dentro de una asignatura, el archivo va a esa asignatura salvo que se cambie.
    setDlgMateria(asignatura && asignatura !== SIN_ASIGNATURA ? asignatura : '')
    setDlgUt(null)
    setUploadPendingFile(file)
  }

  function prepararMover(ap: ApunteConAutor) {
    setDlgMateria(ap.materia ?? '')
    setDlgUt(ap.ut)
    setMoviendo(ap)
  }

  async function handleConfirmUpload() {
    if (!uploadPendingFile || !usuario) return
    const { error } = await subirApunte(uploadPendingFile, usuario.id, tipoFromMime(uploadPendingFile.type), dlgMateria || null, dlgUt)
    setUploadPendingFile(null)
    if (error) {
      setAlert({ type: 'error', title: 'Error al subir', message: error })
    }
  }

  async function handleConfirmMover() {
    if (!moviendo) return
    setGuardandoMover(true)
    const { error } = await clasificarApunte(moviendo.id, dlgMateria || null, dlgUt)
    setGuardandoMover(false)
    setMoviendo(null)
    if (error) setAlert({ type: 'error', title: 'No se pudo mover', message: error })
  }

  function handleEliminar(ap: ApunteConAutor) {
    const esPropio = ap.usuario_id === usuario?.id
    if (!canManage || ap.clase !== usuario?.clase) return
    const autor = ap.usuarios?.nombre ?? 'este usuario'
    setAlert({
      title: 'Eliminar apunte',
      message: !esPropio
        ? `¿Eliminar "${ap.nombre}" subido por ${autor}?`
        : `¿Eliminar "${ap.nombre}"?`,
      confirmLabel: 'Eliminar',
      confirmDestructive: true,
      onConfirm: async () => {
        const { error } = await eliminarApunte(ap)
        if (error) setAlert({ type: 'error', title: 'Error', message: 'No se pudo eliminar el archivo.' })
      },
    })
  }

  if (loading) return <ApuntesEsqueleto />

  return (
    <>
      <ApuntesView
        usuarioId={usuario?.id}
        claseUsuario={usuario?.clase}
        canManage={canManage}
        apuntes={apuntes}
        subiendo={subiendo}
        refreshing={refreshing}
        asignatura={asignatura}
        onAsignatura={abrirAsignatura}
        onRefresh={handleRefresh}
        onArchivo={prepararSubida}
        onEliminar={handleEliminar}
        onMover={prepararMover}
      />

      {uploadPendingFile && (
        <ClasificarDialogo modo="subir"
          titulo={uploadPendingFile.name}
          subtitulo={`${(uploadPendingFile.size / 1024 / 1024).toFixed(1)} MB · ${TIPO_CONFIG[tipoFromMime(uploadPendingFile.type)].nombre}`}
          tipo={tipoFromMime(uploadPendingFile.type)}
          materia={dlgMateria} onMateria={setDlgMateria} ut={dlgUt} onUt={setDlgUt}
          guardando={subiendo} onConfirm={handleConfirmUpload} onClose={() => setUploadPendingFile(null)} />
      )}
      {moviendo && (
        <ClasificarDialogo modo="mover"
          titulo={moviendo.nombre}
          subtitulo="Elige la asignatura y la unidad de trabajo"
          tipo={moviendo.tipo}
          materia={dlgMateria} onMateria={setDlgMateria} ut={dlgUt} onUt={setDlgUt}
          guardando={guardandoMover} onConfirm={handleConfirmMover} onClose={() => setMoviendo(null)} />
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
