import { useRef, useState, type KeyboardEvent } from 'react'
import { ArrowLeft, CalendarDays, Camera, Code, Github, Globe, Link2, LogOut, Save, TrendingUp, X as XIcon } from 'lucide-react'
import type { Usuario } from '@topcode/shared'
import { useTheme } from '../../contexts/ThemeContext'
import { tinta } from '../../lib/tinta'
import { Button, Spinner } from '../ui'
import { Copo } from '../Navidad'
import { cn } from '../ui/cn'
import { Seccion } from '../ui/Seccion'
import { FOCO } from '../ui/estilos'
import { Campo, ETIQUETA, INPUT, Panel } from './campos'
import Identidad from './Identidad'
import type { ReactNode } from 'react'

export type DatosPublicos = {
  bio: string; github_url: string; linkedin_url: string; portfolio_url: string; stack: string[]
}

function gradeLabel(n: number) {
  if (n >= 9) return 'Excelente'
  if (n >= 8) return 'Notable'
  if (n >= 6) return 'Bien'
  if (n >= 5) return 'Suficiente'
  return 'Insuficiente'
}

/** Color de texto legible de una nota: éxito en teal, aviso ámbar, suspenso rosa. */
function gradeClase(n: number) {
  if (n >= 8) return { className: 'text-teal-light' }
  if (n >= 6) return { style: { color: tinta('#f59e0b') } }
  return { style: { color: tinta('#f43f5e') } }
}

export function Cabecera({ titulo, onVolver, extra }: { titulo: string; onVolver: () => void; extra?: ReactNode }) {
  const { navidad } = useTheme()
  return (
    <header className="flex items-center gap-3">
      <button
        onClick={onVolver}
        aria-label="Volver"
        className={cn('w-10 h-10 shrink-0 flex items-center justify-center rounded-xl transition-colors hover:bg-ov/5 bg-ov/[0.03] text-text-secondary', FOCO)}
      >
        <ArrowLeft size={16} aria-hidden="true" />
      </button>
      <h1 className="font-extrabold text-3xl md:text-4xl tracking-tight text-text-primary">{titulo}</h1>
      {navidad && <Copo size={18} className="text-gold-light" />}
      {extra}
    </header>
  )
}

export interface PerfilViewProps {
  usuario: Pick<Usuario, 'nombre' | 'email' | 'rol' | 'es_superadmin' | 'clase' | 'avatar_url' | 'promedio' | 'created_at' | 'bio' | 'github_url' | 'linkedin_url' | 'portfolio_url' | 'stack'>
  avatarPreview: string | null
  uploading: boolean
  savingNombre: boolean
  savingPublico: boolean
  onVolver: () => void
  onAvatar: (file: File) => void
  onGuardarNombre: (nombre: string) => void
  onGuardarPublico: (datos: DatosPublicos) => void
  onLogout: () => void
  /** Sección de Telegram (solo admins con clase). */
  telegram?: ReactNode
}

/** Presentación del perfil propio: los datos y mutaciones viven en pages/Profile.tsx. */
export default function PerfilView(p: PerfilViewProps) {
  const u = p.usuario
  const fileRef = useRef<HTMLInputElement>(null)
  const [nombre, setNombre] = useState(u.nombre ?? '')
  const [bio, setBio] = useState(u.bio ?? '')
  const [githubUrl, setGithubUrl] = useState(u.github_url ?? '')
  const [linkedinUrl, setLinkedinUrl] = useState(u.linkedin_url ?? '')
  const [portfolioUrl, setPortfolioUrl] = useState(u.portfolio_url ?? '')
  const [stack, setStack] = useState<string[]>(u.stack ?? [])
  const [stackInput, setStackInput] = useState('')

  function addStackTag() {
    const tag = stackInput.trim().replace(/,/g, '')
    if (tag && !stack.includes(tag) && stack.length < 12) setStack(prev => [...prev, tag])
    setStackInput('')
  }

  function onStackKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addStackTag() }
    if (e.key === 'Backspace' && stackInput === '' && stack.length > 0) setStack(prev => prev.slice(0, -1))
  }

  const promedio = u.promedio ?? 0
  const grado = gradeClase(promedio)
  const avatarSrc = p.avatarPreview ?? u.avatar_url ?? null

  return (
    <div className="motion-safe:animate-fade-in h-full overflow-y-auto">
      <div className="max-w-[960px] mx-auto px-4 md:px-6 pt-6 pb-10 flex flex-col gap-6">
        <Cabecera titulo="Perfil" onVolver={p.onVolver} />

        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
          {/* ── Identidad ── */}
          <Identidad
            className="lg:sticky lg:top-6"
            nombre={u.nombre}
            rol={u.rol}
            esSuperadmin={u.es_superadmin}
            clase={u.clase}
            avatarUrl={avatarSrc}
            email={u.email}
            accionAvatar={
              <>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={p.uploading}
                  aria-label="Cambiar foto"
                  className={cn('absolute -bottom-2 -right-2 w-9 h-9 flex items-center justify-center rounded-xl bg-primary text-white shadow-card border-2 border-surface transition-opacity hover:opacity-90 disabled:opacity-60', FOCO)}
                >
                  {p.uploading ? <Spinner size="sm" className="text-white" /> : <Camera size={14} aria-hidden="true" />}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  aria-label="Seleccionar imagen de perfil"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (file) p.onAvatar(file)
                  }}
                />
              </>
            }
          >
            <dl className="grid grid-cols-2 gap-3 pt-5 border-t border-ov/[0.08]">
              <div className="min-w-0">
                <dt className="flex items-center gap-1 text-2xs font-bold uppercase tracking-wider text-text-muted">
                  <TrendingUp size={11} aria-hidden="true" />Promedio
                </dt>
                <dd className={cn('mt-1 text-2xl font-black tabular-nums leading-none', grado.className)} style={grado.style}>
                  {promedio.toFixed(2)}
                </dd>
                {promedio > 0 && <dd className="mt-1 text-xs font-semibold text-text-secondary">{gradeLabel(promedio)}</dd>}
              </div>
              <div className="min-w-0">
                <dt className="flex items-center gap-1 text-2xs font-bold uppercase tracking-wider text-text-muted">
                  <CalendarDays size={11} aria-hidden="true" />Miembro
                </dt>
                <dd className="mt-1 text-sm font-semibold text-text-primary first-letter:uppercase leading-snug">
                  {new Date(u.created_at ?? '').toLocaleDateString('es', { month: 'long', year: 'numeric' })}
                </dd>
              </div>
            </dl>
          </Identidad>

          {/* ── Ajustes ── */}
          <div className="flex flex-col gap-6 min-w-0">
            <Seccion titulo="Cuenta" subtitulo="Cómo te ven en TopCode">
              <Panel>
                <form onSubmit={e => { e.preventDefault(); p.onGuardarNombre(nombre) }} className="flex flex-col gap-4">
                  <Campo id="perfil-nombre" label="Nombre visible">
                    <input id="perfil-nombre" type="text" value={nombre} onChange={e => setNombre(e.target.value)}
                      placeholder="Tu nombre" className={INPUT} />
                  </Campo>
                  <Button type="submit" disabled={p.savingNombre || nombre.trim() === u.nombre} loading={p.savingNombre}
                    icon={<Save size={14} aria-hidden="true" />} className="w-full sm:w-fit sm:self-end">
                    {p.savingNombre ? 'Guardando...' : 'Guardar cambios'}
                  </Button>
                </form>
              </Panel>
            </Seccion>

            <Seccion titulo="Perfil público" subtitulo="Lo que ven tus compañeros cuando abren tu perfil">
              <Panel>
                <form
                  onSubmit={e => {
                    e.preventDefault()
                    p.onGuardarPublico({ bio, github_url: githubUrl, linkedin_url: linkedinUrl, portfolio_url: portfolioUrl, stack })
                  }}
                  className="flex flex-col gap-4"
                >
                  <Campo id="perfil-bio" label="Bio"
                    ayuda={<p className="text-2xs text-right tabular-nums text-text-muted" aria-live="off">{bio.length}/200</p>}>
                    <textarea id="perfil-bio" value={bio} onChange={e => setBio(e.target.value)} maxLength={200} rows={3}
                      placeholder="Cuéntanos algo de ti..." className={cn(INPUT, 'resize-none')} />
                  </Campo>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Campo id="perfil-github" label="GitHub" Icon={Github}>
                      <input id="perfil-github" type="url" value={githubUrl} onChange={e => setGithubUrl(e.target.value)}
                        placeholder="https://github.com/usuario" className={INPUT} />
                    </Campo>
                    <Campo id="perfil-linkedin" label="LinkedIn" Icon={Link2}>
                      <input id="perfil-linkedin" type="url" value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)}
                        placeholder="https://linkedin.com/in/usuario" className={INPUT} />
                    </Campo>
                  </div>
                  <Campo id="perfil-portfolio" label="Portfolio / Web" Icon={Globe}>
                    <input id="perfil-portfolio" type="url" value={portfolioUrl} onChange={e => setPortfolioUrl(e.target.value)}
                      placeholder="https://miportfolio.dev" className={INPUT} />
                  </Campo>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="perfil-stack" className={ETIQUETA}>
                      <Code size={12} aria-hidden="true" />Tecnologías
                      <span className="font-normal text-text-muted tabular-nums">({stack.length}/12)</span>
                    </label>
                    <div className="bg-input border border-ov/[0.08] rounded-xl px-3 py-2.5 flex flex-wrap gap-1.5 items-center min-h-[46px] transition-[border-color,box-shadow] duration-200 focus-within:border-primary/50 focus-within:shadow-[0_0_0_3px_rgb(var(--c-primary)/0.12)]">
                      {stack.map(tag => (
                        <span key={tag} className="flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg text-xs font-semibold bg-ov/[0.06] text-text-primary">
                          {tag}
                          <button type="button" aria-label={`Quitar ${tag}`}
                            onClick={() => setStack(prev => prev.filter(t => t !== tag))}
                            className={cn('w-5 h-5 flex items-center justify-center rounded-md text-text-muted hover:bg-ov/10 hover:text-text-primary', FOCO)}>
                            <XIcon size={11} aria-hidden="true" />
                          </button>
                        </span>
                      ))}
                      {stack.length < 12 && (
                        <input id="perfil-stack" value={stackInput} onChange={e => setStackInput(e.target.value)}
                          onKeyDown={onStackKeyDown} onBlur={addStackTag}
                          placeholder={stack.length === 0 ? 'React, Python, SQL... (Enter para añadir)' : ''}
                          className="flex-1 min-w-[120px] bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none" />
                      )}
                    </div>
                  </div>

                  <Button type="submit" disabled={p.savingPublico} loading={p.savingPublico}
                    icon={<Save size={14} aria-hidden="true" />} className="w-full sm:w-fit sm:self-end">
                    {p.savingPublico ? 'Guardando...' : 'Guardar perfil público'}
                  </Button>
                </form>
              </Panel>
            </Seccion>

            {p.telegram}

            <Seccion titulo="Sesión">
              <Panel className="flex items-center justify-between gap-4 flex-wrap">
                <p className="text-sm text-text-muted">Salir de TopCode en este dispositivo.</p>
                <button
                  onClick={p.onLogout}
                  className={cn('flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border border-rose-500/25 bg-rose-500/[0.06] text-rose-600 dark:text-rose-300 transition-colors hover:bg-rose-500/10 w-full sm:w-auto', FOCO)}
                >
                  <LogOut size={14} aria-hidden="true" />Cerrar sesión
                </button>
              </Panel>
            </Seccion>
          </div>
        </div>
      </div>
    </div>
  )
}
