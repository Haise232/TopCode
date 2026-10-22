// Genera el catálogo del gacha (api/_juegos/gacha-catalogo.json): memes de España que conoce la gente joven:
// streamers, youtubers, tele, fútbol y series. La lista y la rareza de cada uno están a mano en MEMES. La foto de los
// streamers es el avatar de su canal de Twitch o YouTube; la del resto sale de su artículo en la Wikipedia en español
// y, si allí no tiene (los personajes de ficción suelen tener solo imagen no libre), de la inglesa o de Wikidata.
// Se ejecuta a mano cuando se quiera renovar el catálogo (si alguien cambia de avatar, su enlace se rompe y la carta
// enseña sus iniciales hasta volver a ejecutarlo):
//   node scripts/gacha/importar.mjs
// Las imágenes no se descargan: se enlazan (la página del gacha cita la fuente).
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const UA = 'TopCode-gacha/1.0 (https://github.com/Haise232/TopCode; proyecto de clase sin fines comerciales)'

// [nombre en la carta, de dónde sale, rareza, fuente de la foto]. La fuente es «twitch:usuario», «yt:canal», «url:página»
// (solo con la imagen fijada) o el artículo de la Wikipedia en español; los personajes de series sin artículo propio
// usan el de su actor. Un quinto elemento fija la imagen cuando la del artículo o el canal no es la del meme. El orden dentro de cada rareza es el de fama: el
// primero vale más.
const MEMES = [
  // Mítica: solo una
  ['El Xokas', 'Codificando…', 'unica', 'twitch:elxokas', 'https://i.ytimg.com/vi/E3hVCGug0yo/frame0.jpg'],
  // Legendarias
  ['Ibai Llanos', 'La Velada del Año', 'mitica', 'Ibai Llanos', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS2yDyywg49FO0nk5D3IEdrFJ0Xe_qk3CdZ-lGIF7lfhR5x6Y19YoBb13g&s=10'],
  ['Zona Gemelos', 'La casa de los gemelos', 'mitica', 'twitch:zonagemelos', 'https://cdn-pro.elsalvador.com/wp-content/uploads/2023/12/dandy-barcelona.jpg'],
  ['El Dandy de Barcelona', 'Ocho infartos', 'mitica', 'url:https://www.youtube.com/watch?v=T76OKMcz8Pg', 'https://i.ytimg.com/vi/T76OKMcz8Pg/hqdefault.jpg'],
  ['Fernando Alonso', 'El 33', 'mitica', 'Fernando Alonso', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTfmbma4YZFUO0MS1y-CtDNSLU0y5DPIN5nYXGKWUTGCToMd9mlVOVu2fA&s=10'],
  ['Torrente', 'El brazo tonto de la ley', 'mitica', 'José Luis Torrente'],
  ['El Fary', 'El Toro Guapo', 'mitica', 'El Fary', 'https://imagenes.elpais.com/resizer/v2/BSF3ZXW5SNMBPO3XYRHGJZP3D4.jpg?auth=edaeeb35fe7fc73e944710890add7aa93520c519b741b3d6763c3575fa5d07e1&width=414'],
  // Épicas
  ['Antonio Recio', 'Mayorista, no limpio pescado', 'epica', 'Jordi Sánchez (actor)'],
  ['El Risitas', 'Las paelleras', 'epica', 'El Risitas'],
  ['Julio Iglesias', 'Y lo sabes', 'epica', 'Julio Iglesias'],
  ['IlloJuan', 'El de Málaga', 'epica', 'twitch:illojuan'],
  ['AuronPlay', 'Las bromas telefónicas', 'epica', 'yt:auronplay'],
  ['El Rubius', 'El rey de YouTube', 'epica', 'yt:ElRubiusOMG', 'https://i.pinimg.com/736x/4e/bf/36/4ebf36e70670e2605c5e0a9ed4f008e3.jpg'],
  ['David Broncano', '¿Cuánto dinero tienes?', 'epica', 'David Broncano'],
  ['Josep Pedrerol', '¡Jijantes!', 'epica', 'Josep Pedrerol'],
  ['TheGrefg', 'Su skin de Fortnite', 'epica', 'yt:TheGrefg'],
  ['Jordi Wild', 'The Wild Project', 'epica', 'twitch:jordiwild'],
  ['Amador Rivas', '¡Merengue, merengue!', 'epica', 'Pablo Chiapella'],
  ['Chiquito de la Calzada', '¡Fistro pecadorl!', 'epica', 'Chiquito de la Calzada'],
  [
    'Ecce Homo de Borja',
    'La restauración',
    'epica',
    'Ecce Homo (Elías García Martínez)',
    'https://upload.wikimedia.org/wikipedia/en/6/61/Attempted_restoration_of_Ecce_Homo.jpg',
  ],
  ['Paquita Salas', 'Lo que no puede ser no puede ser', 'epica', 'Brays Efe'],
  ['Aitana', 'Pop', 'epica', 'Aitana (cantante)'],
  ['Kiko Rivera', 'Paquirrín', 'epica', 'Kiko Rivera'],
  // Raras
  ['Mangel', 'El colega de Rubius', 'rara', 'yt:mangelrogel'],
  ['Lolito Fernández', 'Streamer', 'rara', 'yt:LolitoFernandez', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQYcoJpeuHrMS-eVm0NM7q1T8ZMT77dT96zCUBUmz8nNLo7pScTlzV9plzB&s=10'],
  ['Alexby11', 'Streamer', 'rara', 'twitch:alexby11'],
  ['DjMaRiiO', 'El del FIFA', 'rara', 'yt:DjMaRiiO'],
  ['Cristinini', 'Streamer', 'rara', 'yt:cristinini'],
  ['Knekro', 'Streamer', 'rara', 'yt:knekro'],
  ['Perxitaa', 'Streamer', 'rara', 'yt:Perxitaa'],
  ['Dalas Review', 'Polémicas de YouTube', 'rara', 'yt:DalasReview'],
  ['Wismichu', 'Bromas y Bollywood', 'rara', 'yt:wismichu'],
  ['Mikecrack', 'Los Compas', 'rara', 'yt:mikecrack'],
  ['Willyrex', 'Minecraft', 'rara', 'yt:willyrex'],
  ['Vegetta777', 'Minecraft', 'rara', 'yt:vegetta777'],
  ['Gerard Piqué', 'Kings League', 'rara', 'Gerard Piqué'],
  ['Luis Rubiales', 'No voy a dimitir', 'rara', 'Luis Rubiales'],
  ['Omar Montes', 'Alocao', 'rara', 'Omar Montes'],
  ['Quevedo', 'Quédate', 'rara', 'Quevedo (cantante)'],
  ['Frank Cuesta', 'Frank de la Jungla', 'rara', 'Frank Cuesta'],
  ['Isabel Pantoja', 'Dientes, dientes', 'rara', 'Isabel Pantoja'],
  ['Leticia Sabater', 'Toma pepinazo', 'rara', 'Leticia Sabater'],
  ['Jordi Hurtado', 'Saber y ganar desde siempre', 'rara', 'Jordi Hurtado'],
  ['Iker Jiménez', 'Cuarto milenio', 'rara', 'Iker Jiménez'],
  ['Alberto Chicote', 'Pesadilla en la cocina', 'rara', 'Alberto Chicote'],
  ['Mauricio Colmenero', 'Aída', 'rara', 'Mariano Peña'],
  ['Ignatius Farray', 'Comedia a gritos', 'rara', 'Ignatius Farray'],
  ['Juan Cuesta', 'Aquí no hay quien viva', 'rara', 'José Luis Gil'],
  // Comunes
  ['Plex', 'YouTube', 'comun', 'yt:Plex'],
  ['Carreraaa', 'Streamer', 'comun', 'yt:carreraaa'],
  ['Gerard Romero', 'Jijantes FC', 'comun', 'twitch:gerardromero'],
  ['Nil Ojeda', 'Streamer', 'comun', 'yt:NilOjeda'],
  ['Zorman', 'Streamer', 'comun', 'twitch:zormanworld'],
  ['ByViruZz', 'YouTube', 'comun', 'yt:ByViruZz'],
  ['Outconsumer', 'YouTube', 'comun', 'yt:Outconsumer'],
  ['Spursito', 'Streamer', 'comun', 'yt:spursito'],
  ['Kidd Keo', 'Trap', 'comun', 'yt:kiddkeo'],
  ['C. Tangana', 'El Madrileño', 'comun', 'C. Tangana'],
  ['Chanel', 'SloMo', 'comun', 'Chanel (cantante)'],
  ['Bad Gyal', 'Trap', 'comun', 'Bad Gyal'],
  ['Rosalía', 'Motomami', 'comun', 'Rosalía'],
  ['Lalachus', 'La vaquilla de las campanadas', 'comun', 'Lalachus'],
  ['Grison', 'La Revuelta', 'comun', 'Grison'],
  ['Jorge Ponce', 'La Revuelta', 'comun', 'Jorge Ponce'],
  ['Pablo Motos', 'El Hormiguero', 'comun', 'Pablo Motos'],
  ['Tamara Falcó', 'El Hormiguero', 'comun', 'Tamara Falcó'],
  ['Tomás Roncero', 'El Chiringuito', 'comun', 'Tomás Roncero'],
  ['Joaquín Sánchez', 'El del Betis', 'comun', 'Joaquín Sánchez Rodríguez'],
  ['Sergio Ramos', 'El 4', 'comun', 'Sergio Ramos'],
  ['Roberto Brasero', 'El tiempo', 'comun', 'Roberto Brasero'],
  ['Matías Prats', 'Las noticias', 'comun', 'Matías Prats Luque'],
  ['Joaquín Reyes', 'Muchachada Nui', 'comun', 'Joaquín Reyes'],
  ['Ernesto Sevilla', 'Muchachada Nui', 'comun', 'Ernesto Sevilla'],
  ['Carlos Areces', 'Muchachada Nui', 'comun', 'Carlos Areces'],
  ['Raúl Cimas', 'Muchachada Nui', 'comun', 'Raúl Cimas'],
  ['Miguel Noguera', 'Ultrashow', 'comun', 'Miguel Noguera'],
  ['Berto Romero', 'Mira lo que has hecho', 'comun', 'Berto Romero'],
  ['Karlos Arguiñano', 'Rico, rico', 'comun', 'Karlos Arguiñano'],
  ['Ana Obregón', 'Ana y los siete', 'comun', 'Ana Obregón'],
  ['Emilio Delgado', 'Aquí no hay quien viva', 'comun', 'Fernando Tejero'],
  ['Coque', 'La que se avecina', 'comun', 'Nacho Guerreros'],
  ['Machupichu', 'Aída', 'comun', 'Óscar Reyes'],
  ['Manolo el del Bombo', 'La Selección', 'comun', 'Manolo el del Bombo'],
  ['Rodolfo Chikilicuatre', 'Chiki chiki', 'comun', 'Rodolfo Chikilicuatre'],
  ['Ramón García', 'La capa de las campanadas', 'comun', 'Ramón García'],
  ['Antonio Lobato', 'La voz de la Fórmula 1', 'comun', 'Antonio Lobato', 'https://hips.hearstapps.com/hmg-prod/images/alobatof1-366822811-18370561588044921-7669787835052649178-n-64f9aaa3dc330.jpg?crop=1.00xw:1.00xh;0,0&resize=1120:*'],
]

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const here = (path) => new URL(path, import.meta.url)

// Wikimedia limita las peticiones por minuto: ante un 429 se espera lo que digan (Retry-After) y se repite.
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
const slug = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

// Imagen principal (también las no libres) y elemento de Wikidata de cada artículo de una Wikipedia. Devuelve un Map
// título pedido → { title, img, qid }.
async function pages(lang, titles) {
  const found = new Map()
  for (const group of chunks(titles, 40)) {
    const url =
      `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=pageimages|pageprops` +
      `&piprop=thumbnail&pithumbsize=400&pilicense=any&ppprop=wikibase_item&titles=${encodeURIComponent(group.join('|'))}`
    const body = await json(url)
    const back = new Map()
    for (const n of [...(body.query.normalized ?? []), ...(body.query.redirects ?? [])]) back.set(n.to, back.get(n.from) ?? n.from)
    for (const p of Object.values(body.query.pages)) {
      if (p.missing !== undefined) continue
      found.set(back.get(p.title) ?? p.title, {
        title: p.title,
        img: p.thumbnail?.source?.replace(/\?.*$/, '') ?? null,
        qid: p.pageprops?.wikibase_item ?? null,
      })
    }
    await sleep(1000)
  }
  return found
}

// Artículo en la Wikipedia inglesa, foto (P18) y cuántas Wikipedias tienen artículo (popularidad) de cada elemento de Wikidata.
async function wikidata(ids) {
  const found = new Map()
  for (const group of chunks(ids, 50)) {
    const body = await json(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=sitelinks|claims&ids=${group.join('|')}`)
    for (const [id, e] of Object.entries(body.entities ?? {})) {
      if (e.missing !== undefined) continue
      found.set(id, {
        links: Object.keys(e.sitelinks ?? {}).filter((k) => k.endsWith('wiki') && k !== 'commonswiki').length,
        enwiki: e.sitelinks?.enwiki?.title ?? null,
        file: e.claims?.P18?.[0]?.mainsnak?.datavalue?.value ?? null,
      })
    }
    await sleep(1000)
  }
  return found
}

// Avatar de un canal de Twitch (con decapi.me) o de YouTube (la imagen og:image de su página), a 300-400 px.
async function avatar(source) {
  const [kind, user] = source.split(':')
  if (kind === 'twitch') {
    const res = await fetch(`https://decapi.me/twitch/avatar/${user}`, { headers: { 'user-agent': UA } })
    const url = (await res.text()).trim()
    return { img: url.startsWith('https://') ? url : null, src: `https://www.twitch.tv/${user}` }
  }
  const res = await fetch(`https://www.youtube.com/@${user}`, { headers: { 'user-agent': 'Mozilla/5.0', 'accept-language': 'es' } })
  const og = (await res.text()).match(/<meta property="og:image" content="([^"]+)"/)?.[1]
  return { img: og ? og.replace(/=s\d+-/, '=s400-') : null, src: `https://www.youtube.com/@${user}` }
}

async function memes() {
  const channel = ([, , , source]) => /^(twitch|yt|url):/.test(source)
  const es = await pages('es', MEMES.filter((m) => !channel(m)).map(([, , , title]) => title))
  const wd = await wikidata([...new Set([...es.values()].map((p) => p.qid).filter(Boolean))])
  const enTitles = [...es.values()].filter((p) => !p.img && p.qid && wd.get(p.qid)?.enwiki).map((p) => wd.get(p.qid).enwiki)
  const en = await pages('en', enTitles)
  const out = []
  for (const meme of MEMES) {
    const [name, series, rarity, source, fixed] = meme
    let img
    let src
    let pop = 0
    if (channel(meme)) {
      if (fixed) {
        img = fixed
        const [kind, user] = source.split(/:(.*)/)
        src = kind === 'url' ? user : kind === 'twitch' ? `https://www.twitch.tv/${user}` : `https://www.youtube.com/@${user}`
      } else {
        ;({ img, src } = await avatar(source))
        await sleep(500)
      }
    } else {
      const page = es.get(source)
      if (!page) {
        console.log(`sin artículo: ${source}`)
        continue
      }
      const info = wd.get(page.qid)
      img =
        fixed ??
        page.img ??
        (info?.enwiki ? en.get(info.enwiki)?.img : null) ??
        (info?.file ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(info.file)}?width=400` : null)
      src = `https://es.wikipedia.org/wiki/${encodeURIComponent(page.title.replaceAll(' ', '_'))}`
      pop = info?.links ?? 0
    }
    if (!img) {
      console.log(`sin imagen: ${name}`)
      continue
    }
    out.push({ id: `meme:${slug(name)}`, name, series, rarity, img, pop, src })
  }
  console.log(`memes: ${out.length} de ${MEMES.length}`)
  return out
}

// Valor base de cada rareza. Dentro de su rareza, el primero de la lista vale un 60 % más que el último.
const BASE = { unica: 2500, mitica: 600, epica: 200, rara: 80, comun: 30 }
const ORDER = ['unica', 'mitica', 'epica', 'rara', 'comun']

function rank(cat, list) {
  const out = []
  for (const rarity of ORDER) {
    const group = list.filter((c) => c.rarity === rarity)
    group.forEach((c, i) => {
      const pct = (i + 1) / group.length
      out.push({ ...c, cat, rank: out.length + 1, value: Math.round(BASE[rarity] * (1.6 - pct * 0.6)) })
    })
  }
  return out
}

const catalogo = rank('meme', await cached('memes', memes))
const resumen = {}
for (const c of catalogo) resumen[c.rarity] = (resumen[c.rarity] ?? 0) + 1
console.log(resumen)
await writeFile(here('../../api/_juegos/gacha-catalogo.json'), JSON.stringify({ generado: new Date().toISOString(), cartas: catalogo }))
console.log(`api/_juegos/gacha-catalogo.json: ${catalogo.length} cartas`)
