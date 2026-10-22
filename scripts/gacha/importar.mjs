// Genera el catálogo del gacha (api/_juegos/gacha-catalogo.json): personajes de meme de España, reales y de ficción.
// La lista y la rareza de cada uno están a mano en MEMES; la foto sale de su artículo en la Wikipedia en español y, si
// allí no tiene (los personajes de ficción suelen tener solo imagen no libre), de la inglesa o de Wikidata.
// Se ejecuta a mano cuando se quiera renovar el catálogo:
//   node scripts/gacha/importar.mjs
// Las imágenes no se descargan: se enlazan a Wikimedia (la página del gacha cita la fuente).
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const UA = 'TopCode-gacha/1.0 (https://github.com/Haise232/TopCode; proyecto de clase sin fines comerciales)'

// [nombre en la carta, de dónde sale, rareza, artículo de la Wikipedia en español]. Los personajes de series sin
// artículo propio usan el de su actor (y su foto). Un quinto elemento fija la imagen cuando la del artículo no es
// la del meme. El orden dentro de cada rareza es el de fama: el primero vale más.
const MEMES = [
  // Legendarias
  ['El Risitas', 'Las paelleras', 'mitica', 'El Risitas'],
  ['Chiquito de la Calzada', '¡Fistro pecadorl!', 'mitica', 'Chiquito de la Calzada'],
  ['Julio Iglesias', 'Y lo sabes', 'mitica', 'Julio Iglesias'],
  ['Torrente', 'El brazo tonto de la ley', 'mitica', 'José Luis Torrente'],
  ['Belén Esteban', 'Yo por mi hija mato', 'mitica', 'Belén Esteban'],
  [
    'Ecce Homo de Borja',
    'La restauración',
    'mitica',
    'Ecce Homo (Elías García Martínez)',
    'https://upload.wikimedia.org/wikipedia/en/6/61/Attempted_restoration_of_Ecce_Homo.jpg',
  ],
  ['Lola Flores', 'Si me queréis, irse', 'mitica', 'Lola Flores'],
  // Épicas
  ['El Fary', 'Torito guapo', 'epica', 'El Fary'],
  ['Antonio Recio', 'La que se avecina', 'epica', 'Jordi Sánchez (actor)'],
  ['Amador Rivas', 'La que se avecina', 'epica', 'Pablo Chiapella'],
  ['Paquita Salas', 'Paquita Salas', 'epica', 'Brays Efe'],
  ['Manolo el del Bombo', 'La Selección', 'epica', 'Manolo el del Bombo'],
  ['Carlos Jesús', 'Raticulín', 'epica', 'Carlos Jesús'],
  ['Leticia Sabater', 'Toma pepinazo', 'epica', 'Leticia Sabater'],
  ['Rappel', 'El vidente', 'epica', 'Rappel (vidente)'],
  ['Jordi Hurtado', 'Saber y ganar desde siempre', 'epica', 'Jordi Hurtado'],
  ['Mauricio Colmenero', 'Aída', 'epica', 'Mariano Peña'],
  ['Rodolfo Chikilicuatre', 'Chiki chiki', 'epica', 'Rodolfo Chikilicuatre'],
  ['Isabel Pantoja', 'Dientes, dientes', 'epica', 'Isabel Pantoja'],
  ['Ruiz-Mateos', '¡Que te pego, leche!', 'epica', 'José María Ruiz-Mateos'],
  // Raras
  ['Carmen de Mairena', 'Crónicas marcianas', 'rara', 'Carmen de Mairena'],
  ['Leonardo Dantés', 'Crónicas marcianas', 'rara', 'Leonardo Dantés'],
  ['Tamara Seisdedos', 'No cambié', 'rara', 'Yurena'],
  ['John Cobra', '¡Fuera de aquí!', 'rara', 'John Cobra'],
  ['El Pequeño Nicolás', 'Asesor de todo el mundo', 'rara', 'Francisco Nicolás Gómez Iglesias'],
  ['Mario Vaquerizo', 'Nancys Rubias', 'rara', 'Mario Vaquerizo'],
  ['Jesulín de Ubrique', 'Im-presionante', 'rara', 'Jesulín de Ubrique'],
  ['Marujita Díaz', 'Cine y copla', 'rara', 'Marujita Díaz'],
  ['El Dioni', 'El furgón blindado', 'rara', 'Dionisio Rodríguez Martín'],
  ['Kiko Rivera', 'Paquirrín', 'rara', 'Kiko Rivera'],
  ['Karlos Arguiñano', 'Rico, rico', 'rara', 'Karlos Arguiñano'],
  ['Alberto Chicote', 'Pesadilla en la cocina', 'rara', 'Alberto Chicote'],
  ['Iker Jiménez', 'Cuarto milenio', 'rara', 'Iker Jiménez'],
  ['Ibai Llanos', 'Streamer', 'rara', 'Ibai Llanos'],
  ['El Rubius', 'Streamer', 'rara', 'ElRubius'],
  ['AuronPlay', 'Streamer', 'rara', 'AuronPlay'],
  ['Jordi Wild', 'The Wild Project', 'rara', 'Jordi Wild'],
  ['Enrique Pastor', 'La que se avecina', 'rara', 'José Luis Gil'],
  ['Juan Cuesta', 'Aquí no hay quien viva', 'rara', 'Juan Cuesta'],
  ['Emilio Delgado', 'Aquí no hay quien viva', 'rara', 'Fernando Tejero'],
  ['Espinete', 'Barrio Sésamo', 'rara', 'Espinete'],
  ['Makinavaja', 'El último choriso', 'rara', 'Makinavaja'],
  ['Melody', 'El baile del gorila', 'rara', 'Melody (cantante)'],
  ['Ramón García', 'La capa de las campanadas', 'rara', 'Ramón García'],
  // Comunes
  ['Los del Río', 'Macarena', 'comun', 'Los del Río'],
  ['Georgie Dann', 'El chiringuito', 'comun', 'Georgie Dann'],
  ['Chimo Bayo', 'Así me gusta a mí', 'comun', 'Chimo Bayo'],
  ['Camilo Sesto', 'Vivir así es morir de amor', 'comun', 'Camilo Sesto'],
  ['Raphael', 'Mi gran noche', 'comun', 'Raphael (cantante)'],
  ['Rocío Jurado', 'La más grande', 'comun', 'Rocío Jurado'],
  ['Bertín Osborne', 'Mi casa es la tuya', 'comun', 'Bertín Osborne'],
  ['Ana Obregón', 'Ana y los siete', 'comun', 'Ana Obregón'],
  ['Carmen Lomana', 'Socialité', 'comun', 'Carmen Lomana'],
  ['Kiko Matamoros', 'Sálvame', 'comun', 'Kiko Matamoros'],
  ['Jorge Javier Vázquez', 'Sálvame', 'comun', 'Jorge Javier Vázquez'],
  ['Karmele Marchante', 'Tómbola', 'comun', 'Karmele Marchante'],
  ['Pocholo', 'Mamma mía', 'comun', 'Pocholo Martínez-Bordiú'],
  ['Dinio', 'La noche me confundió', 'comun', 'Dinio García'],
  ['Yola Berrocal', 'Crónicas marcianas', 'comun', 'Yola Berrocal'],
  ['Boris Izaguirre', 'Crónicas marcianas', 'comun', 'Boris Izaguirre'],
  ['Javier Cárdenas', 'Crónicas marcianas', 'comun', 'Javier Cárdenas'],
  ['Jesús Quintero', 'El loco de la colina', 'comun', 'Jesús Quintero'],
  ['Miliki', 'Los Payasos de la Tele', 'comun', 'Miliki'],
  ['Fofito', 'Los Payasos de la Tele', 'comun', 'Fofito'],
  ['Martes y Trece', 'Encarna de noche', 'comun', 'Martes y Trece'],
  ['Cruz y Raya', '¡Mírala, mírala!', 'comun', 'Cruz y Raya'],
  ['José Mota', 'Las gallinas que entran', 'comun', 'José Mota'],
  ['Los Morancos', 'Omaíta', 'comun', 'Los Morancos'],
  ['Paco Martínez Soria', 'La ciudad no es para mí', 'comun', 'Paco Martínez Soria'],
  ['Alfredo Landa', 'Landismo', 'comun', 'Alfredo Landa'],
  ['Fernando Esteso', 'La Ramona', 'comun', 'Fernando Esteso'],
  ['Andrés Pajares', 'Comedia de los 80', 'comun', 'Andrés Pajares'],
  ['Lina Morgan', 'Agradecida y emocionada', 'comun', 'Lina Morgan'],
  ['Jesús Calleja', 'Desafío extremo', 'comun', 'Jesús Calleja'],
  ['Paco Lobatón', '¿Quién sabe dónde?', 'comun', 'Paco Lobatón'],
  ['Mariló Montero', 'La mañana', 'comun', 'Mariló Montero'],
  ['Anne Igartiburu', 'Las campanadas', 'comun', 'Anne Igartiburu'],
  ['Tomás Roncero', 'El chiringuito', 'comun', 'Tomás Roncero'],
  ['Josep Pedrerol', 'El chiringuito', 'comun', 'Josep Pedrerol'],
  ['Joaquín Sánchez', 'El del Betis', 'comun', 'Joaquín Sánchez Rodríguez'],
  ['Fernando Alonso', 'El 33', 'comun', 'Fernando Alonso'],
  ['TheGrefg', 'Streamer', 'comun', 'TheGrefg'],
  ['Willyrex', 'Streamer', 'comun', 'Willyrex'],
  ['Vegetta777', 'Streamer', 'comun', 'Vegetta777'],
  ['Juan Tamariz', 'Tararí que te vi', 'comun', 'Juan Tamariz'],
  ['Arturo Valls', '¡Ahora caigo!', 'comun', 'Arturo Valls'],
  ['Coque', 'La que se avecina', 'comun', 'Nacho Guerreros'],
  ['Mariano Delgado', 'Aquí no hay quien viva', 'comun', 'Eduardo Gómez'],
  ['Vicenta', 'Aquí no hay quien viva', 'comun', 'Gemma Cuervo'],
  ['Machupichu', 'Aída', 'comun', 'Óscar Reyes'],
  ['Carpanta', 'Tebeos de Bruguera', 'comun', 'Carpanta'],
  ['Pepe Gotera y Otilio', 'Chapuzas a domicilio', 'comun', 'Pepe Gotera y Otilio'],
  ['Zipi y Zape', 'Tebeos de Bruguera', 'comun', 'Zipi y Zape'],
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

async function memes() {
  const es = await pages('es', MEMES.map(([, , , title]) => title))
  const wd = await wikidata([...new Set([...es.values()].map((p) => p.qid).filter(Boolean))])
  const enTitles = [...es.values()].filter((p) => !p.img && p.qid && wd.get(p.qid)?.enwiki).map((p) => wd.get(p.qid).enwiki)
  const en = await pages('en', enTitles)
  const out = []
  for (const [name, series, rarity, title, fixed] of MEMES) {
    const page = es.get(title)
    if (!page) {
      console.log(`sin artículo: ${title}`)
      continue
    }
    const info = wd.get(page.qid)
    const img =
      fixed ??
      page.img ??
      (info?.enwiki ? en.get(info.enwiki)?.img : null) ??
      (info?.file ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(info.file)}?width=400` : null)
    if (!img) {
      console.log(`sin imagen: ${name}`)
      continue
    }
    out.push({
      id: `meme:${slug(name)}`,
      name,
      series,
      rarity,
      img,
      pop: info?.links ?? 0,
      src: `https://es.wikipedia.org/wiki/${encodeURIComponent(page.title.replaceAll(' ', '_'))}`,
    })
  }
  console.log(`memes: ${out.length} de ${MEMES.length}`)
  return out
}

// Valor base de cada rareza. Dentro de su rareza, el primero de la lista vale un 60 % más que el último.
const BASE = { mitica: 600, epica: 200, rara: 80, comun: 30 }
const ORDER = ['mitica', 'epica', 'rara', 'comun']

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
