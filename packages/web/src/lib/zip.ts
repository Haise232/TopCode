// Generador mínimo de .zip (sin compresión, método "store") para descargar
// colecciones de Markdown sin añadir dependencias.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(data: Uint8Array) {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function dosDateTime(d: Date) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  return { time, date }
}

export function crearZip(archivos: { nombre: string; contenido: string }[]): Blob {
  const enc = new TextEncoder()
  const { time, date } = dosDateTime(new Date())
  const partes: Uint8Array<ArrayBuffer>[] = []
  const central: Uint8Array<ArrayBuffer>[] = []
  let offset = 0

  for (const a of archivos) {
    const nombre = enc.encode(a.nombre)
    const datos = enc.encode(a.contenido)
    const crc = crc32(datos)

    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)
    local.setUint16(6, 0x0800, true) // nombres en UTF-8
    local.setUint16(8, 0, true)
    local.setUint16(10, time, true)
    local.setUint16(12, date, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, datos.length, true)
    local.setUint32(22, datos.length, true)
    local.setUint16(26, nombre.length, true)
    partes.push(new Uint8Array(local.buffer), nombre, datos)

    const cd = new DataView(new ArrayBuffer(46))
    cd.setUint32(0, 0x02014b50, true)
    cd.setUint16(4, (3 << 8) | 20, true) // "creado en Unix": evita que unzip reinterprete los nombres como CP437
    cd.setUint16(6, 20, true)
    cd.setUint16(8, 0x0800, true)
    cd.setUint16(10, 0, true)
    cd.setUint16(12, time, true)
    cd.setUint16(14, date, true)
    cd.setUint32(16, crc, true)
    cd.setUint32(20, datos.length, true)
    cd.setUint32(24, datos.length, true)
    cd.setUint16(28, nombre.length, true)
    cd.setUint32(38, 0o100644 << 16 >>> 0, true) // permisos rw-r--r--
    cd.setUint32(42, offset, true)
    central.push(new Uint8Array(cd.buffer), nombre)

    offset += 30 + nombre.length + datos.length
  }

  const tamCentral = central.reduce((s, p) => s + p.length, 0)
  const fin = new DataView(new ArrayBuffer(22))
  fin.setUint32(0, 0x06054b50, true)
  fin.setUint16(8, archivos.length, true)
  fin.setUint16(10, archivos.length, true)
  fin.setUint32(12, tamCentral, true)
  fin.setUint32(16, offset, true)

  return new Blob([...partes, ...central, new Uint8Array(fin.buffer)], { type: 'application/zip' })
}
