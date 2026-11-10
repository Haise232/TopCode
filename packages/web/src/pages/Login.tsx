import { useState } from 'react'
import { supabase } from '../lib/supabase'
import AlertModal from '../components/AlertModal'
import { LoginView } from '../components/acceso/Vistas'

function traducirError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials') || m.includes('invalid email or password'))
    return 'El email o la contraseña son incorrectos.'
  if (m.includes('email not confirmed'))
    return 'Debes confirmar tu email antes de entrar. Revisa tu bandeja de entrada.'
  if (m.includes('too many requests') || m.includes('rate limit') || m.includes('email rate'))
    return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'
  if (m.includes('user not found'))
    return 'No existe ninguna cuenta con ese email.'
  if (m.includes('network') || m.includes('fetch'))
    return 'Sin conexión. Comprueba tu internet e inténtalo de nuevo.'
  return msg
}

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [modal, setModal]       = useState<{ title: string; message: string } | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) {
      setModal({ title: 'Campos vacíos', message: 'Completa el email y la contraseña.' })
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    // Si entra bien no hace falta navegar: PublicRoute ve la sesión y vuelve a la página de la que venía (o al inicio).
    if (error) setModal({ title: 'Error al entrar', message: traducirError(error.message) })
  }

  return (
    <>
      <LoginView
        email={email} setEmail={setEmail} password={password} setPassword={setPassword}
        loading={loading} onSubmit={handleLogin}
      />
      <AlertModal
        visible={modal !== null}
        type="error"
        title={modal?.title ?? ''}
        message={modal?.message}
        onClose={() => setModal(null)}
      />
    </>
  )
}
