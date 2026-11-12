import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { markDocsVisited } from '../hooks/useUnreadCounts'
import { useDocColecciones, createColeccion, buscarDocs, type DocBusqueda, type ColeccionInput } from '../hooks/useDocs'
import ColeccionModal from '../components/docs/ColeccionModal'
import ImportModal from '../components/docs/ImportModal'
import BibliotecaView from '../components/docs/BibliotecaView'

export default function Docs() {
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const { colecciones, loading, error } = useDocColecciones()
  const [params, setParams] = useSearchParams()
  const asignatura = params.get('asignatura')
  const abrirAsignatura = useCallback((a: string | null) => setParams(a ? { asignatura: a } : {}), [setParams])
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<DocBusqueda[] | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [showNueva, setShowNueva] = useState(false)
  const [showImport, setShowImport] = useState(false)

  useEffect(() => {
    if (usuario) markDocsVisited(usuario.id)
  }, [usuario])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResultados(null); return }
    let cancelled = false
    setBuscando(true)
    const id = setTimeout(async () => {
      const { resultados: r } = await buscarDocs(q)
      if (cancelled) return
      setResultados(r)
      setBuscando(false)
    }, 300)
    return () => { cancelled = true; clearTimeout(id) }
  }, [query])

  async function handleCrear(input: ColeccionInput) {
    const { id, error: e } = await createColeccion(input)
    if (e || !id) return e ?? 'No se pudo crear la colección.'
    setShowNueva(false)
    navigate(`/docs/${id}`)
    return null
  }

  return (
    <>
      <BibliotecaView
        colecciones={colecciones}
        loading={loading}
        error={error}
        asignatura={asignatura}
        onAsignatura={abrirAsignatura}
        query={query}
        onQuery={setQuery}
        resultados={resultados}
        buscando={buscando}
        onAbrirColeccion={id => navigate(`/docs/${id}`)}
        onAbrirPagina={(coleccionId, id) => navigate(`/docs/${coleccionId}/${id}`)}
        onNueva={() => setShowNueva(true)}
        onImportar={() => setShowImport(true)}
      />
      <ColeccionModal
        open={showNueva}
        defaults={asignatura ? { materia: asignatura } : undefined}
        title="Nueva colección"
        submitLabel="Crear"
        onClose={() => setShowNueva(false)}
        onSubmit={handleCrear}
      />
      <ImportModal
        open={showImport}
        colecciones={colecciones}
        materiaInicial={asignatura ?? undefined}
        onClose={() => setShowImport(false)}
        onDone={id => { setShowImport(false); navigate(`/docs/${id}`) }}
      />
    </>
  )
}
