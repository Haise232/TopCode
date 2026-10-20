// Genera el catálogo del gacha (api/_juegos/gacha-catalogo.json): políticos españoles con cargo en la democracia
// (Wikidata), con foto de Wikimedia Commons. La rareza sale de la popularidad (en cuántas Wikipedias aparece cada uno).
// Se ejecuta a mano cuando se quiera renovar el catálogo:
//   node scripts/gacha/importar.mjs
// Las imágenes no se descargan: se enlazan a Wikimedia (la página del gacha cita la fuente).
import { mkdir, readFile, writeFile } from 'node:fs/promises'

// Mínimo de Wikipedias con artículo propio: por debajo, casi nadie los conocería.
const MIN_LINKS = 9
// Partidos cuyos miembros entran aunque no hayan tenido uno de los CARGOS (eurodiputados, parlamentos autonómicos…),
// con su propio mínimo de Wikipedias: Vox y Se Acabó La Fiesta (Alvise Pérez).
// Legendarias y épicas aunque su popularidad no llegue (Santiago Abascal y Alvise Pérez; Vito Quiles).
const LEGENDARIAS = new Set(['Q11703587', 'Q121434583'])
const EPICAS = new Set(['Q134389895'])
const PARTIDOS = [
  ['Q15630787', 5],
  ['Q125882694', 1],
]
const UA = 'TopCode-gacha/1.0 (https://github.com/Haise232/TopCode; proyecto de clase sin fines comerciales)'
// Franquistas puros que el filtro de Wikidata deja pasar por un escaño o cargo después de 1977, y escritores que
// fueron senadores o diputados pero a los que se conoce por sus libros.
const POLITICA_FUERA = ['Carlos Arias Navarro', 'Blas Piñar', 'Camilo José Cela', 'Rafael Alberti']
// Cargos: presidente del Gobierno, diputado, senador, presidente de la Comunidad de Madrid, alcalde de Madrid y Barcelona.
const CARGOS = ['Q844587', 'Q18171345', 'Q19323171', 'Q3133837', 'Q17078548', 'Q12155639']

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const here = (path) => new URL(path, import.meta.url)

// Wikimedia y AniList limitan las peticiones por minuto: ante un 429 se espera lo que digan (Retry-After) y se repite.
async function json(url, init = {}, tries = 8) {
  for (let i = 1; ; i++) {
    const res = await fetch(url, { ...init, headers: { 'user-agent': UA, ...(init.headers ?? {}) } })
    if (res.ok) return res.json()
    if (i >= tries) throw new Error(`${res.status} ${url.slice(0, 120)}`)
    const wait = Number(res.headers.get('retry-after')) || 5 * i
    process.stdout.write(`\n(${res.status}, espero ${wait} s)\n`)
    await sleep(wait * 1000)
  }
}

// Cada fuente se guarda en scripts/gacha/.cache: si algo falla a medias, volver a ejecutar no repite lo ya descargado.
async function cached(name, fn) {
  const file = here(`./.cache/${name}.json`)
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch {
    const data = await fn()
    await mkdir(here('./.cache/'), { recursive: true })
    await writeFile(file, JSON.stringify(data))
    return data
  }
}

const chunks = (list, n) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n))

// --- Wikidata: cuántas Wikipedias tienen artículo (popularidad) y nombre en español ---

async function wikidata(ids) {
  const found = new Map()
  for (const group of chunks(ids, 50)) {
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=sitelinks|labels&languages=es|en&ids=${group.join('|')}`
    const body = await json(url)
    for (const [id, e] of Object.entries(body.entities ?? {})) {
      if (e.missing !== undefined) continue
      found.set(id, {
        links: Object.keys(e.sitelinks ?? {}).filter((k) => k.endsWith('wiki') && k !== 'commonswiki').length,
        label: e.labels?.es?.value ?? e.labels?.en?.value ?? null,
        eswiki: e.sitelinks?.eswiki?.title ?? null,
      })
    }
    await sleep(1500)
  }
  return found
}

// Miniatura de 400 px de cada archivo de Commons: el enlace final, sin pasar por la redirección de Special:FilePath.
async function commonsThumbs(files) {
  const found = new Map()
  for (const group of chunks([...new Set(files)], 50)) {
    const titles = group.map((f) => `File:${f}`).join('|')
    const body = await json(
      `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url&iiurlwidth=400&titles=${encodeURIComponent(titles)}`,
    )
    const back = new Map((body.query.normalized ?? []).map((n) => [n.to, n.from]))
    for (const p of Object.values(body.query.pages)) {
      const url = p.imageinfo?.[0]?.thumburl
      const asked = back.get(p.title) ?? p.title
      if (url) found.set(asked.replace(/^File:/, ''), url)
    }
    await sleep(1500)
  }
  return found
}

// --- política ---

async function politica() {
  const query = `SELECT ?p ?img ?partyLabel ?born ?died WHERE {
    { SELECT DISTINCT ?p WHERE { VALUES ?pos { ${CARGOS.map((q) => `wd:${q}`).join(' ')} } ?p wdt:P39 ?pos. } }
    ?p wikibase:sitelinks ?links. FILTER(?links >= ${MIN_LINKS})
    ?p wdt:P27 wd:Q29; wdt:P106 wd:Q82955; wdt:P18 ?img.
    OPTIONAL { ?p wdt:P569 ?born. } OPTIONAL { ?p wdt:P570 ?died. } OPTIONAL { ?p p:P102 ?ps. ?ps ps:P102 ?party. FILTER NOT EXISTS { ?ps pq:P582 ?end. } }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". } }`
  const body = await json(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`, {}, 6)
  const people = new Map()
  for (const r of body.results.bindings) {
    const qid = r.p.value.split('/').pop()
    const born = Number(r.born?.value.slice(0, 4) ?? 0)
    const died = r.died ? Number(r.died.value.slice(0, 4)) : null
    if (born < 1900 || (died !== null && died <= 1977)) continue
    if (!people.has(qid)) people.set(qid, { img: r.img.value, party: r.partyLabel?.value ?? '' })
  }
  const extra = `SELECT ?p ?img ?partyLabel WHERE {
    VALUES (?party ?min) { ${PARTIDOS.map(([q, min]) => `(wd:${q} ${min})`).join(' ')} }
    ?p wdt:P102 ?party; wdt:P18 ?img; wikibase:sitelinks ?links. FILTER(?links >= ?min)
    SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". } }`
  const extraBody = await json(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(extra)}`, {}, 6)
  for (const r of extraBody.results.bindings) {
    const qid = r.p.value.split('/').pop()
    if (!people.has(qid)) people.set(qid, { img: r.img.value, party: r.partyLabel?.value ?? '' })
  }
  const wd = await wikidata([...people.keys()])
  const thumbs = await commonsThumbs([...people.values()].map((p) => decodeURIComponent(p.img.split('/').pop())))
  const out = []
  for (const [qid, p] of people) {
    const info = wd.get(qid)
    const name = info?.label ?? info?.eswiki
    if (!name || /^Q\d+$/.test(name) || POLITICA_FUERA.includes(name)) continue
    const file = decodeURIComponent(p.img.split('/').pop())
    out.push({
      id: `politica:${qid}`,
      name,
      series: /^Q\d+$/.test(p.party) ? '' : p.party,
      img: thumbs.get(file) ?? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=400`,
      pop: info?.links ?? 0,
      src: info?.eswiki ? `https://es.wikipedia.org/wiki/${encodeURIComponent(info.eswiki.replaceAll(' ', '_'))}` : `https://www.wikidata.org/wiki/${qid}`,
    })
  }
  console.log(`politica: ${out.length}`)
  return out
}

// --- rareza y valor según la posición en popularidad dentro de su categoría ---

// [rareza, % de la categoría, mínimo de cartas, valor base]: en las categorías pequeñas (cine, política) el mínimo
// asegura variedad de míticas y épicas.
const RAREZAS = [
  ['mitica', 0.02, 6, 600],
  ['epica', 0.1, 26, 200],
  ['rara', 0.35, 0, 80],
  ['comun', 1, 0, 30],
]

function rank(cat, list) {
  const sorted = [...list].sort((a, b) => b.pop - a.pop)
  const limits = RAREZAS.map(([rarity, pct, min, base]) => [rarity, Math.max(Math.round(pct * sorted.length), min), base])
  return sorted.map((c, i) => {
    const pct = (i + 1) / sorted.length
    const [rarity, , base] = limits.find(([, upTo]) => i < upTo)
    if (LEGENDARIAS.has(c.id.split(':')[1])) return { ...c, cat, rank: i + 1, rarity: 'mitica', value: Math.round(RAREZAS[0][3] * 1.58) }
    if (EPICAS.has(c.id.split(':')[1])) return { ...c, cat, rank: i + 1, rarity: 'epica', value: Math.round(RAREZAS[1][3] * 1.3) }
    return { ...c, cat, rank: i + 1, rarity, value: Math.round(base * (1.6 - pct * 0.6)) }
  })
}

const catalogo = rank('politica', await cached('politica', politica))
const resumen = {}
for (const c of catalogo) resumen[`${c.cat}/${c.rarity}`] = (resumen[`${c.cat}/${c.rarity}`] ?? 0) + 1
console.log(resumen)
await writeFile(here('../../api/_juegos/gacha-catalogo.json'), JSON.stringify({ generado: new Date().toISOString(), cartas: catalogo }))
console.log(`api/_juegos/gacha-catalogo.json: ${catalogo.length} cartas`)
