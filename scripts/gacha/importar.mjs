// Genera el catálogo del gacha (api/_juegos/gacha-catalogo.json): personajes de videojuegos. La lista y la rareza de
// cada uno están a mano en PERSONAJES. La foto es la imagen principal de su artículo en la Wikipedia inglesa (el arte
// oficial, que allí es imagen no libre) salvo que se fije a mano.
// Se ejecuta a mano cuando se quiera renovar el catálogo (si una imagen cambia de nombre en la Wikipedia, su enlace se
// rompe y la carta enseña sus iniciales hasta volver a ejecutarlo):
//   node scripts/gacha/importar.mjs
// Las imágenes no se descargan: se enlazan (la página del gacha cita la fuente).
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const UA = 'TopCode-gacha/1.0 (https://github.com/Haise232/TopCode; proyecto de clase sin fines comerciales)'

// [id, nombre en la carta, serie, rareza, artículo de la Wikipedia inglesa, imagen fijada (opcional)]. El orden dentro
// de cada rareza es el de fama: el primero vale más.
// El id es el de la carta de memes que había antes en ese puesto: los poderes salen del id (gacha.mjs, powersFor) y las
// bibliotecas de los jugadores lo guardan, así que al cambiar de temática cada carta conserva dueño, rareza, valor y
// poderes y solo cambian el nombre y la foto. Una carta nueva puede llevar cualquier id que no exista.
const PERSONAJES = [
  ['meme:el-xokas', 'Mario', 'Super Mario', 'unica', 'Mario'], // antes El Xokas
  ['meme:ibai-llanos', 'Link', 'The Legend of Zelda', 'mitica', 'Link (The Legend of Zelda)'], // antes Ibai Llanos
  ['meme:zona-gemelos', 'Pikachu', 'Pokémon', 'mitica', 'Pikachu'], // antes Zona Gemelos
  ['meme:el-dandy-de-barcelona', 'Sonic', 'Sonic the Hedgehog', 'mitica', 'Sonic the Hedgehog (character)'], // antes El Dandy de Barcelona
  ['meme:fernando-alonso', 'Master Chief', 'Halo', 'mitica', 'Master Chief (Halo)'], // antes Fernando Alonso
  ['meme:torrente', 'Kratos', 'God of War', 'mitica', 'Kratos (God of War)'], // antes Torrente
  ['meme:el-fary', 'Lara Croft', 'Tomb Raider', 'mitica', 'Lara Croft'], // antes El Fary
  ['meme:pimpamlacasitos', 'Pac-Man', 'Pac-Man', 'mitica', 'Pac-Man (character)'], // antes PimPamLacasitos
  ['meme:antonio-recio', 'Samus Aran', 'Metroid', 'epica', 'Samus Aran'], // antes Antonio Recio
  ['meme:el-risitas', 'Donkey Kong', 'Donkey Kong', 'epica', 'Donkey Kong (character)'], // antes El Risitas
  ['meme:julio-iglesias', 'Kirby', 'Kirby', 'epica', 'Kirby (character)'], // antes Julio Iglesias
  ['meme:illojuan', 'Steve', 'Minecraft', 'epica', 'Steve (Minecraft)'], // antes IlloJuan
  ['meme:auronplay', 'Cloud Strife', 'Final Fantasy VII', 'epica', 'Cloud Strife'], // antes AuronPlay
  ['meme:el-rubius', 'Solid Snake', 'Metal Gear', 'epica', 'Solid Snake'], // antes El Rubius
  ['meme:david-broncano', 'Geralt de Rivia', 'The Witcher', 'epica', 'Geralt of Rivia'], // antes David Broncano
  ['meme:josep-pedrerol', 'Ezio Auditore', 'Assassin\'s Creed', 'epica', 'Ezio Auditore da Firenze'], // antes Josep Pedrerol
  ['meme:thegrefg', 'Crash Bandicoot', 'Crash Bandicoot', 'epica', 'Crash Bandicoot (character)'], // antes TheGrefg
  ['meme:jordi-wild', 'Bowser', 'Super Mario', 'epica', 'Bowser (character)'], // antes Jordi Wild
  ['meme:amador-rivas', 'Princesa Zelda', 'The Legend of Zelda', 'epica', 'Princess Zelda'], // antes Amador Rivas
  ['meme:chiquito-de-la-calzada', 'Princesa Peach', 'Super Mario', 'epica', 'Princess Peach'], // antes Chiquito de la Calzada
  ['meme:ecce-homo-de-borja', 'Charizard', 'Pokémon', 'epica', 'Charizard'], // antes Ecce Homo de Borja
  ['meme:paquita-salas', 'Yoshi', 'Super Mario', 'epica', 'Yoshi'], // antes Paquita Salas
  ['meme:aitana', 'Mega Man', 'Mega Man', 'epica', 'Mega Man (character)'], // antes Aitana
  ['meme:kiko-rivera', 'Sephiroth', 'Final Fantasy VII', 'epica', 'Sephiroth (Final Fantasy)'], // antes Kiko Rivera
  ['meme:mente-fria', 'Arthur Morgan', 'Red Dead Redemption 2', 'epica', 'Arthur Morgan', 'https://upload.wikimedia.org/wikipedia/en/a/ac/Arthur_Morgan_-_Red_Dead_Redemption_2.png'], // antes Mente Fría
  ['meme:simon', 'Joel', 'The Last of Us', 'epica', 'Joel Miller (The Last of Us)'], // antes Simón
  ['meme:cubarsi', 'Ellie', 'The Last of Us', 'epica', 'Ellie (The Last of Us)'], // antes Cubarsí
  ['meme:jordi-enp', 'Doomguy', 'Doom', 'epica', 'Doomguy'], // antes Jordi ENP
  ['meme:cucurella', 'Ryu', 'Street Fighter', 'epica', 'Ryu (Street Fighter)'], // antes Cucurella
  ['meme:el-paellas', 'CJ', 'GTA: San Andreas', 'epica', 'Carl Johnson (Grand Theft Auto)'], // antes El Paellas
  ['meme:mangel', 'Spyro', 'Spyro', 'rara', 'Spyro (character)'], // antes Mangel
  ['meme:lolito-fernandez', 'Nathan Drake', 'Uncharted', 'rara', 'Nathan Drake'], // antes Lolito Fernández
  ['meme:alexby11', 'Ganondorf', 'The Legend of Zelda', 'rara', 'Ganon'], // antes Alexby11
  ['meme:djmariio', 'GLaDOS', 'Portal', 'rara', 'GLaDOS'], // antes DjMaRiiO
  ['meme:cristinini', 'Scorpion', 'Mortal Kombat', 'rara', 'Scorpion (Mortal Kombat)'], // antes Cristinini
  ['meme:knekro', 'Sub-Zero', 'Mortal Kombat', 'rara', 'Sub-Zero (Mortal Kombat)'], // antes Knekro
  ['meme:perxitaa', 'Chun-Li', 'Street Fighter', 'rara', 'Chun-Li', 'https://upload.wikimedia.org/wikipedia/en/5/53/Chun-Li.png'], // antes Perxitaa
  ['meme:dalas-review', 'Leon S. Kennedy', 'Resident Evil', 'rara', 'Leon S. Kennedy', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/Resident_Evil_4_Remake_-_Leon_S._Kennedy.jpg/500px-Resident_Evil_4_Remake_-_Leon_S._Kennedy.jpg'], // antes Dalas Review
  ['meme:wismichu', 'Jill Valentine', 'Resident Evil', 'rara', 'Jill Valentine', 'https://upload.wikimedia.org/wikipedia/en/3/34/JillValentineRemake.png'], // antes Wismichu
  ['meme:mikecrack', 'Dante', 'Devil May Cry', 'rara', 'Dante (Devil May Cry)'], // antes Mikecrack
  ['meme:willyrex', 'Bayonetta', 'Bayonetta', 'rara', 'Bayonetta (character)'], // antes Willyrex
  ['meme:vegetta777', 'Marcus Fenix', 'Gears of War', 'rara', 'Marcus Fenix'], // antes Vegetta777
  ['meme:gerard-pique', 'Gordon Freeman', 'Half-Life', 'rara', 'Gordon Freeman'], // antes Gerard Piqué
  ['meme:luis-rubiales', 'Agente 47', 'Hitman', 'rara', 'Agent 47'], // antes Luis Rubiales
  ['meme:omar-montes', 'Aloy', 'Horizon', 'rara', 'Aloy', 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Aloy_from_The_Frozen_Wilds_trailer.jpg/500px-Aloy_from_The_Frozen_Wilds_trailer.jpg'], // antes Omar Montes
  ['meme:quevedo', 'Trevor Philips', 'GTA V', 'rara', 'Trevor Philips'], // antes Quevedo
  ['meme:frank-cuesta', 'Hollow Knight', 'Hollow Knight', 'rara', 'The Knight (Hollow Knight)'], // antes Frank Cuesta
  ['meme:isabel-pantoja', 'Sans', 'Undertale', 'rara', 'Sans (Undertale)'], // antes Isabel Pantoja
  ['meme:leticia-sabater', 'Mewtwo', 'Pokémon', 'rara', 'Mewtwo'], // antes Leticia Sabater
  ['meme:jordi-hurtado', 'Shadow', 'Sonic the Hedgehog', 'rara', 'Shadow the Hedgehog'], // antes Jordi Hurtado
  ['meme:iker-jimenez', 'Tails', 'Sonic the Hedgehog', 'rara', 'Tails (Sonic the Hedgehog)', 'https://upload.wikimedia.org/wikipedia/en/1/1a/Miles_%22Tails%22_Prower_Sonic_and_All-Stars_Racing_Transformed.png'], // antes Iker Jiménez
  ['meme:alberto-chicote', 'Fox McCloud', 'Star Fox', 'rara', 'Fox McCloud'], // antes Alberto Chicote
  ['meme:mauricio-colmenero', 'Wario', 'Super Mario', 'rara', 'Wario'], // antes Mauricio Colmenero
  ['meme:ignatius-farray', 'Rayman', 'Rayman', 'rara', 'Rayman (character)'], // antes Ignatius Farray
  ['meme:juan-cuesta', 'Ratchet y Clank', 'Ratchet & Clank', 'rara', 'Ratchet (Ratchet & Clank)'], // antes Juan Cuesta
  ['meme:plex', 'Knuckles', 'Sonic the Hedgehog', 'comun', 'Knuckles the Echidna'], // antes Plex
  ['meme:carreraaa', 'Dr. Eggman', 'Sonic the Hedgehog', 'comun', 'Doctor Eggman'], // antes Carreraaa
  ['meme:gerard-romero', 'Toad', 'Super Mario', 'comun', 'Toad (Nintendo)'], // antes Gerard Romero
  ['meme:nil-ojeda', 'Diddy Kong', 'Donkey Kong', 'comun', 'Diddy Kong'], // antes Nil Ojeda
  ['meme:zorman', 'Jigglypuff', 'Pokémon', 'comun', 'Jigglypuff'], // antes Zorman
  ['meme:byviruzz', 'Canela', 'Animal Crossing', 'comun', 'Isabelle (Animal Crossing)'], // antes ByViruZz
  ['meme:outconsumer', 'Tom Nook', 'Animal Crossing', 'comun', 'Tom Nook'], // antes Outconsumer
  ['meme:spursito', 'Eevee', 'Pokémon', 'comun', 'Eevee'], // antes Spursito
  ['meme:kidd-keo', 'Gengar', 'Pokémon', 'comun', 'Gengar'], // antes Kidd Keo
  ['meme:c-tangana', 'Isaac Clarke', 'Dead Space', 'comun', 'Isaac Clarke'], // antes C. Tangana
  ['meme:chanel', 'Ness', 'EarthBound', 'comun', 'Ness (EarthBound)'], // antes Chanel
  ['meme:bad-gyal', 'Sora', 'Kingdom Hearts', 'comun', 'Sora (Kingdom Hearts)'], // antes Bad Gyal
  ['meme:grison', 'Tifa Lockhart', 'Final Fantasy VII', 'comun', 'Tifa Lockhart'], // antes Grison
  ['meme:jorge-ponce', 'Aerith', 'Final Fantasy VII', 'comun', 'Aerith Gainsborough'], // antes Jorge Ponce
  ['meme:pablo-motos', 'Lightning', 'Final Fantasy XIII', 'comun', 'Lightning (Final Fantasy)'], // antes Pablo Motos
  ['meme:tamara-falco', 'Noctis', 'Final Fantasy XV', 'comun', 'Noctis Lucis Caelum'], // antes Tamara Falcó
  ['meme:tomas-roncero', 'Claptrap', 'Borderlands', 'comun', 'Claptrap'], // antes Tomás Roncero
  ['meme:joaquin-sanchez', 'Max Payne', 'Max Payne', 'comun', 'Max Payne (character)'], // antes Joaquín Sánchez
  ['meme:sergio-ramos', 'Lucario', 'Pokémon', 'comun', 'Lucario'], // antes Sergio Ramos
  ['meme:roberto-brasero', 'Kazuya Mishima', 'Tekken', 'comun', 'Kazuya Mishima'], // antes Roberto Brasero
  ['meme:matias-prats', 'Ken Masters', 'Street Fighter', 'comun', 'Ken Masters'], // antes Matías Prats
  ['meme:joaquin-reyes', 'Guile', 'Street Fighter', 'comun', 'Guile (Street Fighter)', 'https://upload.wikimedia.org/wikipedia/en/b/bc/Guile_%28SSFII%29.png'], // antes Joaquín Reyes
  ['meme:ernesto-sevilla', 'M. Bison', 'Street Fighter', 'comun', 'M. Bison'], // antes Ernesto Sevilla
  ['meme:carlos-areces', 'Liu Kang', 'Mortal Kombat', 'comun', 'Liu Kang'], // antes Carlos Areces
  ['meme:raul-cimas', 'Raiden', 'Mortal Kombat', 'comun', 'Raiden (Mortal Kombat)'], // antes Raúl Cimas
  ['meme:miguel-noguera', 'Sly Cooper', 'Sly Cooper', 'comun', 'Sly Cooper (character)', 'https://upload.wikimedia.org/wikipedia/en/6/67/Sly_Cooper_Thieves_in_Time.png'], // antes Miguel Noguera
  ['meme:berto-romero', 'Comandante Shepard', 'Mass Effect', 'comun', 'Commander Shepard'], // antes Berto Romero
  ['meme:karlos-arguinano', 'Banjo y Kazooie', 'Banjo-Kazooie', 'comun', 'Banjo and Kazooie'], // antes Karlos Arguiñano
  ['meme:ana-obregon', 'Sackboy', 'LittleBigPlanet', 'comun', 'Sackboy'], // antes Ana Obregón
  ['meme:emilio-delgado', 'Pyramid Head', 'Silent Hill', 'comun', 'Pyramid Head'], // antes Emilio Delgado
  ['meme:coque', 'Némesis', 'Resident Evil', 'comun', 'Nemesis (Resident Evil)'], // antes Coque
  ['meme:machupichu', 'Albert Wesker', 'Resident Evil', 'comun', 'Albert Wesker', 'https://upload.wikimedia.org/wikipedia/en/5/51/Albert_Wesker.png'], // antes Machupichu
  ['meme:manolo-el-del-bombo', 'Niko Bellic', 'GTA IV', 'comun', 'Niko Bellic'], // antes Manolo el del Bombo
  ['meme:rodolfo-chikilicuatre', 'Creeper', 'Minecraft', 'comun', 'Creeper (Minecraft)'], // antes Rodolfo Chikilicuatre
  ['meme:ramon-garcia', 'Cuphead', 'Cuphead', 'comun', 'Cuphead'], // antes Ramón García
  ['meme:antonio-lobato', 'Shovel Knight', 'Shovel Knight', 'comun', 'Shovel Knight'], // antes Antonio Lobato
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

// Imagen principal (también las no libres) y número de idiomas de cada artículo de la Wikipedia inglesa. Devuelve un
// Map título pedido → { title, img, langs }.
async function pages(titles) {
  const found = new Map()
  for (const group of chunks(titles, 40)) {
    const url =
      'https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=pageimages|langlinks&lllimit=500' +
      `&piprop=thumbnail&pithumbsize=400&pilicense=any&titles=${encodeURIComponent(group.join('|'))}`
    const body = await json(url)
    const back = new Map()
    for (const n of [...(body.query.normalized ?? []), ...(body.query.redirects ?? [])]) back.set(n.to, back.get(n.from) ?? n.from)
    for (const p of Object.values(body.query.pages)) {
      if (p.missing !== undefined) continue
      found.set(back.get(p.title) ?? p.title, {
        title: p.title,
        img: p.thumbnail?.source?.replace(/\?.*$/, '') ?? null,
        langs: (p.langlinks?.length ?? 0) + 1,
      })
    }
    await sleep(1000)
  }
  return found
}

async function personajes() {
  const en = await pages(PERSONAJES.map(([, , , , title]) => title))
  const out = []
  for (const [id, name, series, rarity, title, fixed] of PERSONAJES) {
    const page = en.get(title)
    if (!page) {
      console.log(`sin artículo: ${title}`)
      continue
    }
    const img = fixed ?? page.img
    if (!img) {
      console.log(`sin imagen: ${name}`)
      continue
    }
    const src = `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replaceAll(' ', '_'))}`
    out.push({ id, name, series, rarity, img, pop: page.langs, src })
  }
  console.log(`personajes: ${out.length} de ${PERSONAJES.length}`)
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

const catalogo = rank('videojuego', await cached('personajes', personajes))
const resumen = {}
for (const c of catalogo) resumen[c.rarity] = (resumen[c.rarity] ?? 0) + 1
console.log(resumen)
await writeFile(here('../../api/_juegos/gacha-catalogo.json'), JSON.stringify({ generado: new Date().toISOString(), cartas: catalogo }))
console.log(`api/_juegos/gacha-catalogo.json: ${catalogo.length} cartas`)
