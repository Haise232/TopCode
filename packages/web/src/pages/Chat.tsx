import { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Hash, Lock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { usePublicMensajes, usePrivateMensajes, type Usuario, type UsuarioPublico } from '@topcode/shared'
import { markChatVisited } from '../hooks/useUnreadCounts'
import { useTheme } from '../contexts/ThemeContext'
import { Copo } from '../components/Navidad'
import { Avatar } from '../components/chat/Avatar'
import Hilo, { CabeceraHilo, SinConversacion, VacioCanal, VacioPrivado } from '../components/chat/Hilo'
import { ListaUsuarios, PanelConversaciones } from '../components/chat/Conversaciones'
import type { ItemMensaje } from '../components/chat/tipos'
import { cn } from '../components/ui/cn'

type SubTab = 'publico' | 'privado'

const CANAL_GENERAL = { id: 'general', label: 'General', desc: 'Todos los alumnos' }

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(ts: string) {
  const d = new Date(ts)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const msgDay = new Date(d); msgDay.setHours(0, 0, 0, 0)
  if (msgDay.getTime() === today.getTime()) return 'Hoy'
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
  if (msgDay.getTime() === yesterday.getTime()) return 'Ayer'
  return d.toLocaleDateString('es', { day: 'numeric', month: 'long' })
}

// ── Public chat ──────────────────────────────────────────────────────────────
function PublicChat({ usuario, onVolver }: { usuario: Usuario; onVolver: () => void }) {
  const { navidad } = useTheme()
  const navigate = useNavigate()
  const canalActivo = CANAL_GENERAL.id

  const {
    mensajes, avatares, loading,
    typingUsers,
    enviar: enviarMensaje,
    editarMensaje,
    eliminarMensaje,
    emitirTyping,
  } = usePublicMensajes(canalActivo)
  const [texto, setTexto] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounce typing: emitir máximo una vez cada 2s mientras escribe
  const typingDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleTyping = useCallback(() => {
    if (typingDebounce.current) return
    emitirTyping(usuario.nombre)
    typingDebounce.current = setTimeout(() => { typingDebounce.current = null }, 2000)
  }, [emitirTyping, usuario.nombre])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return
    const t = texto.trim()
    setTexto('')
    const { error } = await enviarMensaje(t, usuario.id, usuario.nombre)
    // Si no se envió, devolver el texto al input para no perderlo
    if (error) setTexto(prev => prev || t)
    inputRef.current?.focus()
  }

  const todayCount = useMemo(() => {
    const todayStr = new Date().toDateString()
    return mensajes.filter(m => new Date(m.created_at).toDateString() === todayStr).length
  }, [mensajes])

  // Usuarios escribiendo que NO soy yo
  const othersTyping = typingUsers.filter(n => n !== usuario.nombre)

  const items: ItemMensaje[] = useMemo(() => mensajes.map(m => ({
    id: m.id,
    autorId: m.usuario_id,
    autor: m.autor,
    avatarUrl: avatares[m.usuario_id],
    texto: m.texto,
    hora: formatTime(m.created_at),
    dia: formatDate(m.created_at),
    editado: m.editado,
    eliminado: m.eliminado,
    mio: m.usuario_id === usuario.id,
  })), [mensajes, avatares, usuario.id])

  return (
    <Hilo
      cabecera={
        <CabeceraHilo
          onVolver={onVolver}
          icono={
            <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-primary/10 text-primary-light">
              <Hash size={18} aria-hidden="true" />
            </span>
          }
          titulo={
            <>
              {CANAL_GENERAL.label}
              {navidad && <Copo size={13} className="inline-block ml-1.5 -mt-0.5 text-gold-light" />}
            </>
          }
          subtitulo={
            <span className="truncate">
              {loading ? 'Cargando...' : `${todayCount} mensaje${todayCount !== 1 ? 's' : ''} hoy · ${CANAL_GENERAL.desc}`}
            </span>
          }
          derecha={
            <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full shrink-0 bg-teal/10 text-teal-light text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-teal motion-safe:animate-pulse" aria-hidden="true" />
              En vivo
            </span>
          }
        />
      }
      items={items}
      loading={loading}
      vacio={<VacioCanal />}
      mostrarAutores
      escribiendo={othersTyping}
      onPerfil={id => navigate(`/profile/${id}`)}
      editandoId={editandoId}
      onEmpezarEditar={setEditandoId}
      onCancelarEditar={() => setEditandoId(null)}
      onConfirmarEditar={async (id, text) => {
        setEditandoId(null)
        await editarMensaje(id, text)
      }}
      onEliminar={id => eliminarMensaje(id)}
      valor={texto}
      onCambiar={setTexto}
      onEnviar={enviar}
      onEscribiendo={handleTyping}
      placeholder="Escribe algo en #general..."
      inputRef={inputRef}
    />
  )
}

// ── Private chat ─────────────────────────────────────────────────────────────
function PrivateChat({ usuario, peer, onVolver }: { usuario: Usuario; peer: UsuarioPublico; onVolver: () => void }) {
  const navigate = useNavigate()
  const { mensajes, loading, enviar: enviarMensaje } = usePrivateMensajes({ meId: usuario.id, peerId: peer.id })
  const [texto, setTexto] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return
    const t = texto.trim()
    setTexto('')
    const { error } = await enviarMensaje(t, usuario.nombre)
    if (error) setTexto(prev => prev || t)
    inputRef.current?.focus()
  }

  const items: ItemMensaje[] = useMemo(() => mensajes.map(m => ({
    id: m.id,
    autorId: m.de_id,
    autor: m.de_nombre,
    texto: m.texto,
    hora: formatTime(m.created_at),
    dia: formatDate(m.created_at),
    mio: m.de_id === usuario.id,
  })), [mensajes, usuario.id])

  return (
    <Hilo
      cabecera={
        <CabeceraHilo
          onVolver={onVolver}
          icono={
            <button
              type="button"
              onClick={() => navigate(`/profile/${peer.id}`)}
              aria-label={`Ver perfil de ${peer.nombre}`}
              className="rounded-full shrink-0 transition-opacity hover:opacity-80 outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <Avatar nombre={peer.nombre} url={peer.avatar_url} size={40} />
            </button>
          }
          titulo={
            <button type="button" onClick={() => navigate(`/profile/${peer.id}`)} className="hover:underline underline-offset-2 max-w-full truncate rounded outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
              {peer.nombre}
            </button>
          }
          subtitulo={
            <>
              <Lock size={11} className="shrink-0 text-teal-light" aria-hidden="true" />
              <span className="truncate">Conversación privada</span>
            </>
          }
          derecha={
            <span className={cn(
              'text-xs font-semibold px-2.5 py-1 rounded-full shrink-0',
              peer.rol === 'admin' ? 'bg-gold/15 text-gold-light' : 'bg-ov/[0.07] text-text-secondary',
            )}>
              {peer.rol === 'admin' ? 'Admin' : 'Alumno'}
            </span>
          }
        />
      }
      items={items}
      loading={loading}
      vacio={<VacioPrivado nombre={peer.nombre} avatarUrl={peer.avatar_url} />}
      mostrarAutores={false}
      onPerfil={id => navigate(`/profile/${id}`)}
      valor={texto}
      onCambiar={setTexto}
      onEnviar={enviar}
      placeholder={`Mensaje a ${peer.nombre}...`}
      inputRef={inputRef}
    />
  )
}

// ── Lista de usuarios (datos + búsqueda) ──────────────────────────────────────
function UserList({
  usuario,
  onSelect,
  selectedId,
}: {
  usuario: Usuario
  onSelect: (u: UsuarioPublico) => void
  selectedId?: string | null
}) {
  const [users, setUsers] = useState<UsuarioPublico[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(false)
    Promise.resolve(
      supabase
        .from('usuarios_publicos')
        .select('id, nombre, avatar_url')
        .neq('id', usuario.id)
        .order('nombre')
    )
      .then(({ data, error: queryError }) => {
        if (!active) return
        if (queryError) setError(true)
        if (data) setUsers(data as UsuarioPublico[])
      })
      .catch(() => { if (active) setError(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [usuario.id])

  const filtered = useMemo(() => {
    if (!query.trim()) return users
    const q = query.toLowerCase()
    return users.filter(u =>
      u.nombre.toLowerCase().includes(q)
    )
  }, [users, query])

  return (
    <ListaUsuarios
      usuarios={filtered}
      loading={loading}
      error={error}
      query={query}
      onQuery={setQuery}
      selectedId={selectedId}
      onSelect={u => onSelect(users.find(x => x.id === u.id) ?? (u as UsuarioPublico))}
    />
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Chat() {
  const { usuario } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [subTab, setSubTab] = useState<SubTab>('publico')
  const [selectedUser, setSelectedUser] = useState<UsuarioPublico | null>(null)

  // Marcar visita y limpiar contadores de DM no leídos
  useEffect(() => {
    if (!usuario) return
    markChatVisited(usuario.id)
  }, [usuario?.id])

  // Deep-link: ?dm=userId&from=nombre → abrir DM directo
  useEffect(() => {
    const dmId = searchParams.get('dm')
    const fromName = searchParams.get('from') ?? ''
    if (!dmId || !usuario) return

    supabase
      .from('usuarios_publicos')
      .select('id, nombre, avatar_url, rol')
      .eq('id', dmId)
      .single()
      .then(({ data }) => {
        const peer: UsuarioPublico = data
          ? (data as UsuarioPublico)
          : { id: dmId, nombre: decodeURIComponent(fromName), avatar_url: null, rol: 'alumno' }
        setSelectedUser(peer)
        setSubTab('privado')
      })
    // Limpiar params de la URL para que no persistan
    setSearchParams({}, { replace: true })
  }, []) // solo en el primer montaje

  if (!usuario) return null

  function handleSetSubTab(tab: SubTab) {
    setSubTab(tab)
    if (tab === 'publico') setSelectedUser(null)
  }

  // Móvil: dos pantallas. La lista de conversaciones se ve con «privado» sin usuario elegido;
  // el hilo (canal o mensaje directo) ocupa toda la pantalla y su flecha vuelve a la lista.
  const enLista = subTab === 'privado' && !selectedUser

  return (
    <div className="h-full md:p-6">
      <div className="h-full max-w-[1200px] mx-auto flex overflow-hidden bg-surface md:rounded-2xl md:border md:border-ov/[0.07] md:shadow-card">
        <PanelConversaciones
          className={enLista ? 'flex' : 'hidden md:flex'}
          generalActivo={subTab === 'publico'}
          onGeneral={() => handleSetSubTab('publico')}
        >
          <UserList
            usuario={usuario}
            onSelect={u => { setSubTab('privado'); setSelectedUser(u) }}
            selectedId={selectedUser?.id}
          />
        </PanelConversaciones>

        <section className={cn('flex-1 min-w-0 min-h-0 flex-col', enLista ? 'hidden md:flex' : 'flex')}>
          {subTab === 'publico' ? (
            <PublicChat usuario={usuario} onVolver={() => handleSetSubTab('privado')} />
          ) : selectedUser ? (
            <PrivateChat usuario={usuario} peer={selectedUser} onVolver={() => setSelectedUser(null)} />
          ) : (
            <SinConversacion />
          )}
        </section>
      </div>
    </div>
  )
}
