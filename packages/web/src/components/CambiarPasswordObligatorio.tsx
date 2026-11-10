import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { CambiarPasswordView } from './acceso/Vistas'

const MIN_LONGITUD = 6

function traducirError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('different from the old') || m.includes('same password'))
    return 'La contraseña nueva tiene que ser distinta de la temporal.'
  if (m.includes('password') && (m.includes('characters') || m.includes('weak')))
    return `La contraseña debe tener al menos ${MIN_LONGITUD} caracteres.`
  if (m.includes('session') || m.includes('jwt') || m.includes('expired'))
    return 'Tu sesión ha caducado. Cierra sesión y vuelve a entrar con la contraseña temporal.'
  if (m.includes('network') || m.includes('fetch') || m.includes('timeout') || m.includes('abort'))
    return 'Sin conexión. Comprueba tu internet e inténtalo de nuevo.'
  return msg
}

// Quien entra con una contraseña temporal (se la dio un administrador) no ve nada más hasta elegir la suya.
export default function CambiarPasswordObligatorio() {
  const { usuario, refreshUsuario } = useAuth()
  const [password, setPassword]   = useState('')
  const [repetida, setRepetida]   = useState('')
  const [visible, setVisible]     = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  // Si la contraseña se cambió pero no llegó a confirmarse (se cortó la conexión), al volver se confirma sola.
  useEffect(() => {
    supabase.rpc('tc_password_cambiada').then(({ data }) => {
      if (data === true) void refreshUsuario()
    })
  }, [refreshUsuario])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < MIN_LONGITUD) {
      setError(`La contraseña debe tener al menos ${MIN_LONGITUD} caracteres.`)
      return
    }
    if (password !== repetida) {
      setError('Las dos contraseñas no coinciden.')
      return
    }
    setGuardando(true)
    try {
      const { error: fallo } = await supabase.auth.updateUser({ password })
      if (fallo) {
        setError(traducirError(fallo.message))
        return
      }
      // El servidor solo quita la marca si la contraseña ya no es la temporal.
      const { data: listo, error: falloMarca } = await supabase.rpc('tc_password_cambiada')
      if (falloMarca || listo !== true) {
        setError('Tu contraseña se ha guardado, pero no hemos podido confirmarlo. Recarga la página.')
        return
      }
      await refreshUsuario()
    } catch (err) {
      setError(traducirError(err instanceof Error ? err.message : String(err)))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <CambiarPasswordView
      email={usuario?.email} password={password} setPassword={setPassword} repetida={repetida} setRepetida={setRepetida}
      visible={visible} setVisible={setVisible} guardando={guardando} error={error} minLongitud={MIN_LONGITUD}
      onSubmit={handleSubmit} onSalir={() => supabase.auth.signOut()}
    />
  )
}
