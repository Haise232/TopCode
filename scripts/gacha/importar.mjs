// Genera el catálogo del gacha (api/_juegos/gacha-catalogo.json) con tres categorías:
//   anime     los personajes con más favoritos de AniList
//   cine      la lista curada de scripts/gacha/cine.txt, con foto y popularidad de Wikipedia/Wikidata
//   politica  políticos españoles con cargo en la democracia (Wikidata), con foto de Wikimedia Commons
// La rareza sale de la popularidad dentro de cada categoría. Se ejecuta a mano cuando se quiera renovar el catálogo:
//   node scripts/gacha/importar.mjs
// Las imágenes no se descargan: se enlazan a AniList y Wikimedia (la página del gacha cita las fuentes).
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const ANIME_COUNT = 1500
const UA = 'TopCode-gacha/1.0 (https://github.com/Haise232/TopCode; proyecto de clase sin fines comerciales)'
// Franquistas puros que el filtro de Wikidata deja pasar por un escaño o cargo después de 1977, y escritores que
// fueron senadores o diputados pero a los que se conoce por sus libros.
const POLITICA_FUERA = ['Carlos Arias Navarro', 'Blas Piñar', 'Camilo José Cela', 'Rafael Alberti']
// Cargos: presidente del Gobierno, diputado, senador, presidente de la Comunidad de Madrid, alcalde de Madrid y Barcelona.
const CARGOS = ['Q844587', 'Q18171345', 'Q19323171', 'Q3133837', 'Q17078548', 'Q12155639']
// Película, película de animación, largometraje de animación, película de anime, saga, serie de películas, película en
// 3D, franquicia.
const FILMS = new Set(['Q11424', 'Q202866', 'Q29168811', 'Q20650540', 'Q24856', 'Q1257444', 'Q229390', 'Q1667921'])

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

// --- anime ---

async function anime() {
  const query = `query ($page: Int) { Page(page: $page, perPage: 50) { characters(sort: FAVOURITES_DESC) {
    id name { full } image { large } favourites
    media(perPage: 1, sort: POPULARITY_DESC) { nodes { title { romaji english } } } } } }`
  const out = []
  for (let page = 1; out.length < ANIME_COUNT; page++) {
    const body = await json('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables: { page } }),
    })
    const list = body.data.Page.characters
    if (list.length === 0) break
    for (const c of list) {
      const media = c.media.nodes[0]?.title
      if (!c.image?.large || c.image.large.includes('default')) continue
      out.push({
        id: `anime:${c.id}`,
        name: c.name.full,
        series: media?.english || media?.romaji || '',
        img: c.image.large,
        pop: c.favourites,
        src: `https://anilist.co/character/${c.id}`,
      })
    }
    process.stdout.write(`\ranime: ${out.length}`)
    await sleep(2200) // AniList permite unas 30 peticiones por minuto
  }
  console.log()
  return out.slice(0, ANIME_COUNT)
}

// --- Wikidata: cuántas Wikipedias tienen artículo (popularidad) y nombre en español ---

async function wikidata(ids) {
  const found = new Map()
  for (const group of chunks(ids, 50)) {
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=sitelinks|labels|claims&languages=es|en&ids=${group.join('|')}`
    const body = await json(url)
    for (const [id, e] of Object.entries(body.entities ?? {})) {
      if (e.missing !== undefined) continue
      found.set(id, {
        links: Object.keys(e.sitelinks ?? {}).filter((k) => k.endsWith('wiki') && k !== 'commonswiki').length,
        label: e.labels?.es?.value ?? e.labels?.en?.value ?? null,
        eswiki: e.sitelinks?.eswiki?.title ?? null,
        types: (e.claims?.P31 ?? []).map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean),
      })
    }
    await sleep(1500)
  }
  return found
}

// --- cine ---

async function cine() {
  const lines = (await readFile(here('./cine.txt'), 'utf8'))
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split('|').map((s) => s.trim()))
  const byTitle = new Map() // título del artículo -> { qid, img, title }
  const forward = new Map() // título pedido -> título normalizado o destino de la redirección
  for (const group of chunks(lines, 50)) {
    const titles = group.map(([t]) => t).join('|')
    const base = `https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=pageimages|pageprops&ppprop=wikibase_item&piprop=thumbnail&pithumbsize=400&pilicense=any&pilimit=50&titles=${encodeURIComponent(titles)}`
    // La respuesta llega por partes («continue»): hay que pedir las siguientes hasta tener la foto de todas.
    let extra = ''
    do {
      const body = await json(base + extra)
      for (const r of [...(body.query.normalized ?? []), ...(body.query.redirects ?? [])]) forward.set(r.from, r.to)
      for (const p of Object.values(body.query.pages)) {
        if (p.missing !== undefined) continue
        const prev = byTitle.get(p.title) ?? {}
        byTitle.set(p.title, { qid: p.pageprops?.wikibase_item ?? prev.qid, img: p.thumbnail?.source ?? prev.img, title: p.title })
      }
      extra = body.continue ? `&${new URLSearchParams(body.continue)}` : ''
      await sleep(1500)
    } while (extra)
  }
  const resolve = (title) => {
    let t = title
    for (let i = 0; i < 5 && forward.has(t); i++) t = forward.get(t)
    return t
  }
  const pages = new Map(lines.map(([t]) => [t, byTitle.get(resolve(t))]))
  const missing = lines.filter(([t]) => !pages.get(t)?.img).map(([t]) => t)
  if (missing.length) console.log(`cine sin artículo o sin foto (${missing.length}): ${missing.join(', ')}`)
  const ok = lines.filter(([t]) => pages.get(t)?.img && pages.get(t)?.qid)
  const wd = await wikidata([...new Set(ok.map(([t]) => pages.get(t).qid))])
  const seen = new Set()
  const out = []
  const notCharacters = []
  for (const [title, series] of ok) {
    const page = pages.get(title)
    if (seen.has(page.qid)) continue
    seen.add(page.qid)
    const info = wd.get(page.qid)
    // Algunos personajes redirigen al artículo de la película (Jack Dawson → Titanic): eso no es una carta.
    if (info?.types.some((t) => FILMS.has(t))) {
      notCharacters.push(`${title} → ${page.title}`)
      continue
    }
    out.push({
      id: `cine:${page.qid}`,
      name: info?.label ?? page.title.replace(/\s*\(.*\)$/, ''),
      series,
      img: page.img,
      pop: info?.links ?? 0,
      src: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replaceAll(' ', '_'))}`,
    })
  }
  if (notCharacters.length) console.log(`cine que en realidad son películas (${notCharacters.length}): ${notCharacters.join(', ')}`)
  console.log(`cine: ${out.length}`)
  return out
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
    ?p wikibase:sitelinks ?links. FILTER(?links >= 13)
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
    return { ...c, cat, rank: i + 1, rarity, value: Math.round(base * (1.6 - pct * 0.6)) }
  })
}

const catalogo = [
  ...rank('anime', await cached('anime', anime)),
  ...rank('cine', await cached('cine', cine)),
  ...rank('politica', await cached('politica', politica)),
]
const resumen = {}
for (const c of catalogo) resumen[`${c.cat}/${c.rarity}`] = (resumen[`${c.cat}/${c.rarity}`] ?? 0) + 1
console.log(resumen)
await writeFile(here('../../api/_juegos/gacha-catalogo.json'), JSON.stringify({ generado: new Date().toISOString(), cartas: catalogo }))
console.log(`api/_juegos/gacha-catalogo.json: ${catalogo.length} cartas`)
