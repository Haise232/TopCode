import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useApuntes } from '../hooks/useApuntes'
import type { ApunteConAutor } from '../hooks/useApuntes'
import AlertModal from '../components/AlertModal'
import ApuntesView, { ApuntesEsqueleto } from '../components/apuntes/ApuntesView'
import { tipoFromMime, type TipoApunte } from '../components/apuntes/tipos'

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
    eliminarApunte,
  } = useApuntes(usuario?.clase)

  const [refreshing, setRefreshing] = useState(false)
  const [alert, setAlert] = useState<AlertState>(null)

  // Modal de subida con selección de materia
  const [uploadPendingFile, setUploadPendingFile] = useState<File | null>(null)
  const [uploadTipo, setUploadTipo] = useState<TipoApunte>('otro')
  const [uploadMateria, setUploadMateria] = useState<string>('')

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
    setUploadTipo(tipoFromMime(file.type))
    setUploadMateria('')
    setUploadPendingFile(file)
  }

  async function handleConfirmUpload() {
    if (!uploadPendingFile || !usuario) return
    const { error } = await subirApunte(uploadPendingFile, usuario.id, uploadTipo, uploadMateria || null)
    setUploadPendingFile(null)
    if (error) {
      setAlert({ type: 'error', title: 'Error al subir', message: error })
    }
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
        onRefresh={handleRefresh}
        onArchivo={prepararSubida}
        onEliminar={handleEliminar}
        archivoPendiente={uploadPendingFile}
        tipoPendiente={uploadTipo}
        materiaPendiente={uploadMateria}
        onMateriaPendiente={setUploadMateria}
        onConfirmarSubida={handleConfirmUpload}
        onCancelarSubida={() => setUploadPendingFile(null)}
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
