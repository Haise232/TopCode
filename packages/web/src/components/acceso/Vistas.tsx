import { Link } from 'react-router-dom'
import { ArrowRight, BarChart3, Calendar, FolderOpen, KeyRound, Lock, MessageCircle, ShieldCheck, Users, Zap, AlertCircle } from 'lucide-react'

import { Spinner } from '../ui/Spinner'
import { cn } from '../ui/cn'
import { FOCO } from '../ui/estilos'
import {
  AccesoLayout, BOTON_PRINCIPAL, Campo, CampoPassword, CabeceraForm, MedidorFuerza, TarjetaForm, ETIQUETA, INPUT,
} from './Marca'
import { PantallaCentrada } from './Avisos'

const ENLACE = cn('font-semibold text-primary-light rounded-sm hover:underline underline-offset-4', FOCO)

function BotonEnviar({ cargando, textoCargando, children }: { cargando: boolean; textoCargando: string; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={cargando} className={cn(BOTON_PRINCIPAL, 'mt-1')}>
      {cargando ? (<><Spinner size="sm" />{textoCargando}</>) : children}
    </button>
  )
}

/* ───────────────────────── Login ───────────────────────── */

export function LoginView({ email, setEmail, password, setPassword, loading, onSubmit }: {
  email: string; setEmail: (v: string) => void
  password: string; setPassword: (v: string) => void
  loading: boolean
  onSubmit: (e: React.FormEvent) => void
}) {
  return (
    <AccesoLayout panel={{
      etiqueta: 'Intranet académica · Informática',
      titulo: 'Tu espacio', acento: 'académico',
      bajada: 'Gestiona tus notas, comparte apuntes y mantente al día con los eventos del curso.',
      puntos: [
        { Icon: BarChart3, texto: 'Seguimiento de calificaciones en tiempo real' },
        { Icon: MessageCircle, texto: 'Chat con tus compañeros de clase' },
        { Icon: FolderOpen, texto: 'Biblioteca compartida de apuntes' },
        { Icon: Calendar, texto: 'Calendario de eventos y exámenes' },
      ],
    }}>
      <CabeceraForm titulo="Bienvenido de vuelta" subtitulo="Inicia sesión para acceder a tu cuenta" />
      <TarjetaForm>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Campo id="login-email" type="email" label="Correo electrónico" value={email}
            onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" autoComplete="email" autoFocus />
          <CampoPassword id="login-password" label="Contraseña" value={password} onChange={setPassword} autoComplete="current-password" />
          <BotonEnviar cargando={loading} textoCargando="Verificando…">
            Iniciar sesión
            <ArrowRight size={15} aria-hidden="true" className="motion-safe:group-hover:translate-x-0.5 transition-transform" />
          </BotonEnviar>
        </form>
      </TarjetaForm>
      <div className="mt-6 text-center">
        <p className="text-sm text-text-muted">
          ¿No tienes cuenta? <Link to="/register" className={ENLACE}>Crear una cuenta</Link>
        </p>
        <p className="text-xs mt-3 text-text-muted [text-wrap:balance]">¿Olvidaste tu contraseña? Pide una temporal al administrador de tu clase.</p>
      </div>
    </AccesoLayout>
  )
}

/* ───────────────────────── Registro ───────────────────────── */

export function RegisterView({ nombre, setNombre, email, setEmail, password, setPassword, loading, onSubmit }: {
  nombre: string; setNombre: (v: string) => void
  email: string; setEmail: (v: string) => void
  password: string; setPassword: (v: string) => void
  loading: boolean
  onSubmit: (e: React.FormEvent) => void
}) {
  const fuerza = (password.length < 6 ? 1 : password.length < 10 ? 2 : 3) as 1 | 2 | 3
  return (
    <AccesoLayout panel={{
      etiqueta: 'Únete a Informática',
      titulo: 'Empieza tu', acento: 'aventura',
      bajada: 'Crea tu cuenta en segundos y accede a todas las herramientas académicas del curso.',
      puntos: [
        { Icon: Zap, texto: 'Registro rápido con verificación por correo' },
        { Icon: Lock, texto: 'Tu información siempre segura' },
        { Icon: Users, texto: 'Conecta con todos tus compañeros' },
        { Icon: ShieldCheck, texto: 'Acceso una vez que un administrador apruebe tu cuenta' },
      ],
    }}>
      <CabeceraForm titulo="Crear una cuenta" subtitulo="Rellena los datos para registrarte" />
      <TarjetaForm>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Campo id="register-nombre" type="text" label="Nombre completo" value={nombre}
            onChange={e => setNombre(e.target.value)} placeholder="Tu nombre" autoComplete="name" autoFocus />
          <Campo id="register-email" type="email" label="Correo electrónico" value={email}
            onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" autoComplete="email" />
          <div className="flex flex-col gap-2">
            <CampoPassword id="register-password" label="Contraseña" value={password} onChange={setPassword}
              placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
            {password.length > 0 && <MedidorFuerza nivel={fuerza} etiquetas={['Débil', 'Media', 'Fuerte']} />}
          </div>
          <BotonEnviar cargando={loading} textoCargando="Creando cuenta…">
            Crear cuenta
            <ArrowRight size={15} aria-hidden="true" className="motion-safe:group-hover:translate-x-0.5 transition-transform" />
          </BotonEnviar>
        </form>
      </TarjetaForm>
      <p className="mt-6 text-center text-sm text-text-muted">
        ¿Ya tienes cuenta? <Link to="/login" className={ENLACE}>Iniciar sesión</Link>
      </p>
    </AccesoLayout>
  )
}

/* ───────────────────── Contraseña obligatoria ───────────────────── */

export function CambiarPasswordView({ email, password, setPassword, repetida, setRepetida, visible, setVisible, guardando, error, minLongitud, onSubmit, onSalir }: {
  email?: string
  password: string; setPassword: (v: string) => void
  repetida: string; setRepetida: (v: string) => void
  visible: boolean; setVisible: (v: boolean) => void
  guardando: boolean
  error: string | null
  minLongitud: number
  onSubmit: (e: React.FormEvent) => void
  onSalir: () => void
}) {
  const fuerza = (password.length < minLongitud ? 1 : password.length < 10 ? 2 : 3) as 1 | 2 | 3
  const alternar = () => setVisible(!visible)
  const etiquetaToggle: [string, string] = ['Mostrar contraseñas', 'Ocultar contraseñas']
  return (
    <PantallaCentrada>
      <CabeceraForm
        titulo="Elige tu contraseña"
        subtitulo="Has entrado con una contraseña temporal. Antes de seguir, pon una que solo sepas tú."
      />
      {email && (
        <p className="-mt-3 mb-6 text-sm text-text-muted">
          Cuenta: <b className="font-semibold text-text-secondary break-all">{email}</b>
        </p>
      )}
      <TarjetaForm>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <CampoPassword id="nueva-password" label="Contraseña nueva" value={password} onChange={setPassword}
              autoComplete="new-password" autoFocus visible={visible} onToggle={alternar} etiquetaToggle={etiquetaToggle} />
            {password.length > 0 && <MedidorFuerza nivel={fuerza} etiquetas={['Muy corta', 'Aceptable', 'Buena']} />}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="repetir-password" className={ETIQUETA}>Repítela</label>
            <input
              id="repetir-password" type={visible ? 'text' : 'password'} value={repetida}
              onChange={e => setRepetida(e.target.value)} placeholder="Repite la contraseña" autoComplete="new-password"
              className={INPUT}
            />
          </div>

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-xl px-3.5 py-3 text-sm bg-rose-500/10 text-rose-600 dark:text-rose-300">
              <AlertCircle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
              {error}
            </p>
          )}

          <button type="submit" disabled={guardando} className={cn(BOTON_PRINCIPAL, 'mt-1')}>
            {guardando ? (<><Spinner size="sm" />Guardando…</>) : (<><KeyRound size={15} aria-hidden="true" />Guardar y entrar</>)}
          </button>
        </form>
      </TarjetaForm>
      <div className="mt-6 text-center">
        <button type="button" onClick={onSalir}
          className={cn('rounded-md px-2 py-1 text-sm font-semibold text-text-muted hover:text-text-primary transition-colors', FOCO)}>
          Cerrar sesión
        </button>
      </div>
    </PantallaCentrada>
  )
}

