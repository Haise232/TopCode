import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import AlertModal from '../components/AlertModal'
import { RegisterView } from '../components/acceso/Vistas'
import { CLASE_UNICA } from '@topcode/shared'

function traducirError(msg: string, code?: string): string {
  const m = msg.toLowerCase()
  if (m.includes('already registered') || m.includes('user already exists'))
    return 'Ya existe una cuenta con ese email.'
  if (m.includes('password') && m.includes('characters'))
    return 'La contraseña debe tener al menos 6 caracteres.'
  if (m.includes('invalid email'))
    return 'El formato del email no es válido.'
  // Supabase: "For security purposes, you can only request this after N seconds."
  const segundos = m.match(/after (\d+) seconds?/)?.[1]
  if (segundos)
    return `Ya se envió un correo a este email hace poco. Espera ${segundos} s y revisa tu bandeja (y spam) antes de reintentar.`
  if (code === 'over_email_send_rate_limit' || m.includes('email rate limit'))
    return 'El servidor ha alcanzado el límite de correos de verificación. Inténtalo más tarde o avisa a un administrador.'
  if (m.includes('too many requests') || m.includes('rate limit'))
    return 'Demasiados intentos. Espera unos minutos.'
  if (m.includes('network') || m.includes('fetch'))
    return 'Sin conexión. Comprueba tu internet.'
  return msg
}

export default function Register() {
  const [nombre, setNombre]     = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [modal, setModal]       = useState<{
    type: 'error' | 'success'
    title: string
    message: string
  } | null>(null)
  const navigate = useNavigate()

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim() || !email || !password) {
      setModal({ type: 'error', title: 'Campos vacíos', message: 'Completa todos los campos.' })
      return
    }
    if (password.length < 6) {
      setModal({ type: 'error', title: 'Contraseña corta', message: 'La contraseña debe tener al menos 6 caracteres.' })
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nombre: nombre.trim(), clase: CLASE_UNICA.id },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    })
    setLoading(false)
    if (error) {
      setModal({ type: 'error', title: 'Error al registrarse', message: traducirError(error.message, error.code) })
    } else {
      setModal({
        type: 'success',
        title: '¡Revisa tu correo!',
        message: `Hemos enviado un enlace de confirmación a ${email}. Verifica tu correo antes de iniciar sesión.`,
      })
    }
  }

  return (
    <>
      <RegisterView
        nombre={nombre} setNombre={setNombre} email={email} setEmail={setEmail}
        password={password} setPassword={setPassword} loading={loading} onSubmit={handleRegister}
      />
      <AlertModal
        visible={modal !== null}
        type={modal?.type}
        title={modal?.title ?? ''}
        message={modal?.message}
        onClose={() => {
          if (modal?.type === 'success') navigate('/login')
          setModal(null)
        }}
      />
    </>
  )
}
