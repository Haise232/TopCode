import { useEffect, useState } from 'react'
import { Eye, EyeOff, GraduationCap, KeyRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Button, Card } from './ui'

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

function CampoPassword({ id, label, value, onChange, visible, autoFocus }: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  visible: boolean
  autoFocus?: boolean
}) {
  return (
    <label className="flex flex-col gap-1.5" htmlFor={id}>
      <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">{label}</span>
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="••••••••"
        autoComplete="new-password"
        autoFocus={autoFocus}
        className="bg-input border border-border rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted transition-all duration-200 w-full outline-none focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(61,159,137,0.12)]"
      />
    </label>
  )
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

  const fuerza = password.length === 0 ? 0 : password.length < MIN_LONGITUD ? 1 : password.length < 10 ? 2 : 3

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-bg relative">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,rgba(61,159,137,0.08),transparent_60%)]" />
      <div className="w-full max-w-[400px] relative animate-fade-in">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-primary bg-gradient-to-br from-primary to-primary-dark">
            <GraduationCap size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-text-primary">TopCode</h1>
        </div>

        <div className="mb-6">
          <h2 className="text-2xl font-extrabold tracking-tight text-text-primary">Elige tu contraseña</h2>
          <p className="text-sm mt-1.5 leading-relaxed text-text-muted">
            Has entrado con una contraseña temporal. Antes de seguir, pon una que solo sepas tú
            {usuario?.email && <> para <b className="text-text-secondary break-all">{usuario.email}</b></>}.
          </p>
        </div>

        <Card padding="md">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <div className="relative">
                <CampoPassword id="nueva-password" label="Contraseña nueva" value={password} onChange={setPassword} visible={visible} autoFocus />
                <button
                  type="button"
                  onClick={() => setVisible(v => !v)}
                  className="absolute right-3.5 bottom-3 transition-colors duration-150 hover:text-text-secondary text-text-muted"
                  aria-label={visible ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
                >
                  {visible ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="flex items-center gap-2" aria-hidden="true">
                  <div className="flex gap-1 flex-1">
                    {[1, 2, 3].map(n => (
                      <span
                        key={n}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          fuerza >= n ? (fuerza === 1 ? 'bg-rose-500' : fuerza === 2 ? 'bg-amber-400' : 'bg-primary') : 'bg-white/10'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-text-muted">{fuerza === 1 ? 'Muy corta' : fuerza === 2 ? 'Aceptable' : 'Buena'}</span>
                </div>
              )}
            </div>

            <CampoPassword id="repetir-password" label="Repítela" value={repetida} onChange={setRepetida} visible={visible} />

            {error && (
              <p role="alert" className="text-sm text-rose-400">
                {error}
              </p>
            )}

            <Button type="submit" loading={guardando} icon={<KeyRound size={15} />} className="py-3 text-sm font-semibold">
              {guardando ? 'Guardando...' : 'Guardar y entrar'}
            </Button>
          </form>
        </Card>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="text-sm font-semibold text-text-muted hover:text-text-primary transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </main>
  )
}
