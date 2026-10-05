import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1'
import { parseEvento, TEXTO_MAX, TITULO_MAX } from './parser.ts'

// Lunes 2026-10-05 10:00 en Madrid (CEST, UTC+2).
const AHORA = new Date('2026-10-05T08:00:00Z')

type Ok = Extract<ReturnType<typeof parseEvento>, { ok: true }>

function ok(texto: string, ahora = AHORA): Ok {
  const r = parseEvento(texto, ahora)
  if (!r.ok) throw new Error(`Se esperaba ok:true para «${texto}» pero fue error: ${r.error}`)
  return r
}
function err(texto: string, ahora = AHORA): string {
  const r = parseEvento(texto, ahora)
  if (r.ok) throw new Error(`Se esperaba ok:false para «${texto}» pero dio ${JSON.stringify(r)}`)
  return r.error
}

Deno.test('ejemplo: examen jueves 22 AED', () => {
  const r = ok('examen jueves 22 AED')
  assertEquals(r.fecha, '2026-10-22')
  assertEquals(r.materia, 'Acceso a datos')
  assertEquals(r.hora, null)
  assertEquals(r.titulo, 'Examen Acceso a datos')
})

Deno.test('ejemplo: entrega sabado 7/11 DPL 23:59', () => {
  const r = ok('entrega sabado 7/11 DPL 23:59')
  assertEquals(r.fecha, '2026-11-07')
  assertEquals(r.hora, '23:59')
  assertEquals(r.materia, 'Despliegue apps web')
  assertEquals(r.titulo, 'Entrega Despliegue apps web')
})

Deno.test('relativas: hoy, mañana, pasado mañana', () => {
  assertEquals(ok('clase hoy').fecha, '2026-10-05')
  assertEquals(ok('tutoría mañana a las 10').fecha, '2026-10-06')
  assertEquals(ok('tutoría mañana a las 10').hora, '10:00')
  assertEquals(ok('tutoría mañana a las 10').titulo, 'Tutoría')
  assertEquals(ok('revisión pasado mañana').fecha, '2026-10-07')
  assertEquals(ok('Mañana examen').titulo, 'Examen')
})

Deno.test('"de la mañana" no se confunde con la fecha mañana', () => {
  const r = ok('examen viernes a las 9 de la mañana')
  assertEquals(r.fecha, '2026-10-09')
  assertEquals(r.hora, '09:00')
  const r2 = ok('tutoría mañana a las 10 de la mañana')
  assertEquals(r2.fecha, '2026-10-06')
  assertEquals(r2.hora, '10:00')
})

Deno.test('dia de la semana solo', () => {
  assertEquals(ok('examen viernes').fecha, '2026-10-09')
  assertEquals(ok('examen domingo').fecha, '2026-10-11')
  assertEquals(ok('examen miércoles').fecha, '2026-10-07')
  assertEquals(ok('examen miercoles').fecha, '2026-10-07')
})

Deno.test('siendo lunes: "lunes" es hoy, "lunes que viene" es dentro de 7 dias', () => {
  assertEquals(ok('examen lunes').fecha, '2026-10-05')
  assertEquals(ok('examen lunes que viene').fecha, '2026-10-12')
  assertEquals(ok('examen próximo lunes').fecha, '2026-10-12')
  assertEquals(ok('examen el lunes próximo').fecha, '2026-10-12')
  assertEquals(ok('examen martes que viene').fecha, '2026-10-06')
})

Deno.test('numero solo: este mes, o mes siguiente si ya paso', () => {
  assertEquals(ok('reunión 20').fecha, '2026-10-20')
  const hoy = ok('reunión 5')
  assertEquals(hoy.fecha, '2026-10-05')
  assertEquals(hoy.avisos.length, 0)
  const r = ok('reunión 3')
  assertEquals(r.fecha, '2026-11-03')
  assertEquals(r.avisos.length, 1)
  assertStringIncludes(r.avisos[0], '03/11/2026')
})

Deno.test('numero solo que no existe en el mes siguiente salta al que si', () => {
  // 2026-10-05: el 31 existe en octubre
  assertEquals(ok('reunión 31').fecha, '2026-10-31')
  // 2026-11-10: el 31 no existe en noviembre -> 2026-12-31
  assertEquals(ok('reunión 31', new Date('2026-11-10T09:00:00Z')).fecha, '2026-12-31')
  // 2026-10-31 + dia 30 -> noviembre 30
  assertEquals(ok('reunión 30', new Date('2026-10-31T12:00:00Z')).fecha, '2026-11-30')
})

Deno.test('numero que acompaña a una palabra de titulo no es el dia', () => {
  const r = ok('práctica 2 mañana')
  assertEquals(r.titulo, 'Práctica 2')
  assertEquals(r.fecha, '2026-10-06')
})

Deno.test('fechas con mes escrito', () => {
  assertEquals(ok('examen 22 de octubre').fecha, '2026-10-22')
  assertEquals(ok('examen 22 octubre').fecha, '2026-10-22')
  assertEquals(ok('examen 22 oct').fecha, '2026-10-22')
  assertEquals(ok('examen jueves 22 de octubre').fecha, '2026-10-22')
  assertEquals(ok('examen el 22 de octubre de 2027').fecha, '2027-10-22')
  assertEquals(ok('examen el 22 de octubre').titulo, 'Examen')
  assertEquals(ok('examen 3 de septiembre').fecha, '2027-09-03')
  assertEquals(ok('examen 3 de septiembre').avisos.length, 1)
})

Deno.test('fechas numericas d/m, d-m, d/m/aa, d/m/aaaa e ISO', () => {
  assertEquals(ok('examen 7/11').fecha, '2026-11-07')
  assertEquals(ok('examen 7-11').fecha, '2026-11-07')
  assertEquals(ok('examen 7/11/27').fecha, '2027-11-07')
  assertEquals(ok('examen 7/11/2027').fecha, '2027-11-07')
  assertEquals(ok('examen 2026-10-22').fecha, '2026-10-22')
  // d/m ya pasado -> año siguiente con aviso
  const r = ok('examen 1/10')
  assertEquals(r.fecha, '2027-10-01')
  assertEquals(r.avisos.length, 1)
})

Deno.test('fechas inexistentes o pasadas', () => {
  assertStringIncludes(err('examen 31/02'), 'no existe')
  assertStringIncludes(err('examen 32/10/2026'), 'no existe')
  assertStringIncludes(err('examen 29/02/2027'), 'no existe')
  assertStringIncludes(err('examen 1/10/2026'), 'ya ha pasado')
  assertEquals(ok('examen 29/02/2028').fecha, '2028-02-29')
})

Deno.test('formatos de hora', () => {
  const h = (t: string) => ok(`examen mañana ${t}`).hora
  assertEquals(h('10:30'), '10:30')
  assertEquals(h('9:05'), '09:05')
  assertEquals(h('23:59'), '23:59')
  assertEquals(h('0:00'), '00:00')
  assertEquals(h('10h'), '10:00')
  assertEquals(h('10h30'), '10:30')
  assertEquals(h('10 h'), '10:00')
  assertEquals(h('10 horas'), '10:00')
  assertEquals(h('a las 9'), '09:00')
  assertEquals(h('a las 9 y media'), '09:30')
  assertEquals(h('a las 9 y cuarto'), '09:15')
  assertEquals(h('a las 10 menos cuarto'), '09:45')
  assertEquals(h('a las 10 en punto'), '10:00')
  assertEquals(h('a la 1'), '01:00')
  assertEquals(h('a las 5 de la tarde'), '17:00')
  assertEquals(h('a las 5 pm'), '17:00')
  assertEquals(h('a las 12 pm'), '12:00')
  assertEquals(h('a las 12 am'), '00:00')
  assertEquals(h('a las 9 de la noche'), '21:00')
  assertEquals(h('a las 12 de la noche'), '23:59')
  assertEquals(h('a las 7 de la mañana'), '07:00')
})

Deno.test('hora no se mezcla con titulo ni fecha', () => {
  const r = ok('entrega 23:59 mañana DPL')
  assertEquals(r.hora, '23:59')
  assertEquals(r.fecha, '2026-10-06')
  assertEquals(r.titulo, 'Entrega Despliegue apps web')
})

Deno.test('hora invalida -> ok:false', () => {
  assertStringIncludes(err('examen mañana 24:00'), 'hora')
  assertStringIncludes(err('examen mañana 10:75'), 'hora')
  assertStringIncludes(err('examen mañana a las 25'), 'hora')
  assertStringIncludes(err('examen mañana 99h'), 'hora')
})

Deno.test('hoy con hora ya pasada -> aviso (no error)', () => {
  const r = ok('clase hoy 9:00')
  assertEquals(r.fecha, '2026-10-05')
  assertEquals(r.avisos.length, 1)
  assertEquals(ok('clase hoy 11:00').avisos.length, 0)
})

Deno.test('desajuste entre dia de la semana y numero -> ok:false', () => {
  const e = err('examen lunes 22')
  assertStringIncludes(e, 'No coinciden')
  assertStringIncludes(e, 'jueves')
  assertStringIncludes(err('examen viernes 7/11'), 'No coinciden')
  assertStringIncludes(err('examen lunes mañana'), 'No coinciden')
})

Deno.test('materia desconocida (BBDD): null y la palabra queda en el titulo', () => {
  const r = ok('examen jueves 22 BBDD')
  assertEquals(r.materia, null)
  assertEquals(r.titulo, 'Examen BBDD')
  assertEquals(r.fecha, '2026-10-22')
})

Deno.test('materia por nombre completo, nombre corto y minusculas/tildes', () => {
  assertEquals(ok('examen mañana acceso a datos').materia, 'Acceso a datos')
  // el nombre largo se queda en el titulo tal cual se escribio
  assertEquals(ok('examen mañana acceso a datos').titulo, 'Examen acceso a datos')
  assertEquals(ok('examen mañana aed').materia, 'Acceso a datos')
  assertEquals(ok('examen mañana Prog. multimedia').materia, 'Prog. multimedia')
  assertEquals(ok('examen mañana programación multimedia y dispositivos móviles').materia, 'Prog. multimedia')
})

Deno.test('varias materias -> aviso y se usa la primera', () => {
  const r = ok('examen mañana AED DPL')
  assertEquals(r.materia, 'Acceso a datos')
  assertEquals(r.avisos.length, 1)
})

Deno.test('titulo vacio y mensajes vacios', () => {
  assertStringIncludes(err('mañana'), 'Falta el título')
  assertStringIncludes(err('jueves 22 AED'), 'Falta el título')
  assertStringIncludes(err('el mañana a las 10'), 'Falta el título')
  assertStringIncludes(err(''), 'vacío')
  assertStringIncludes(err('   \n '), 'vacío')
})

Deno.test('sin fecha -> error con ayuda', () => {
  assertStringIncludes(err('examen de AED'), 'No he encontrado la fecha')
})

Deno.test('titulo demasiado largo y texto demasiado largo', () => {
  assertStringIncludes(err(`${'x'.repeat(TITULO_MAX + 1)} mañana`), 'demasiado largo')
  assertEquals(ok(`${'x'.repeat(TITULO_MAX)} mañana`).titulo.length, TITULO_MAX)
  assertStringIncludes(err('a'.repeat(TEXTO_MAX + 1)), 'demasiado largo')
})

Deno.test('dos fechas (relativa y concreta) -> ok:false', () => {
  assertStringIncludes(err('examen mañana 7/11'), 'más de una fecha')
})

Deno.test('entrada invalida: ahora no es una fecha valida', () => {
  assertStringIncludes(err('examen mañana', new Date('nope')), 'fecha actual')
})

Deno.test('DST: noche del cambio de hora (25/10/2026, 03:00 CEST -> 02:00 CET)', () => {
  // 2026-10-25 00:30 Madrid (aun CEST) = 22:30Z del 24
  const antes = new Date('2026-10-24T22:30:00Z')
  assertEquals(ok('clase hoy', antes).fecha, '2026-10-25')
  assertEquals(ok('clase mañana', antes).fecha, '2026-10-26')
  // 2026-10-25 02:30 CET (segunda pasada) = 01:30Z
  const durante = new Date('2026-10-25T01:30:00Z')
  assertEquals(ok('clase hoy', durante).fecha, '2026-10-25')
  // 2026-10-26 00:30 CET = 2026-10-25T23:30Z -> ya es lunes 26 en Madrid
  const despues = new Date('2026-10-25T23:30:00Z')
  assertEquals(ok('clase hoy', despues).fecha, '2026-10-26')
  assertEquals(ok('clase mañana', despues).fecha, '2026-10-27')
  // 2026-10-24 23:30Z = 01:30 del 25 Madrid
  assertEquals(ok('clase hoy', new Date('2026-10-24T23:30:00Z')).fecha, '2026-10-25')
})

Deno.test('DST: dia de la semana a traves del cambio de hora', () => {
  // Desde el lunes 19/10 el domingo es el 25 (dia del cambio de hora).
  assertEquals(ok('examen domingo', new Date('2026-10-19T08:00:00Z')).fecha, '2026-10-25')
  assertEquals(ok('examen lunes que viene', new Date('2026-10-23T10:00:00Z')).fecha, '2026-10-26')
  assertEquals(ok('examen 26/10', new Date('2026-10-25T23:30:00Z')).fecha, '2026-10-26')
  // Cambio de hora de primavera 29/03/2026 (02:00 CET -> 03:00 CEST)
  assertEquals(ok('clase mañana', new Date('2026-03-28T23:30:00Z')).fecha, '2026-03-30')
  assertEquals(ok('clase hoy', new Date('2026-03-28T23:30:00Z')).fecha, '2026-03-29')
})

Deno.test('hoy se calcula en Madrid, no en UTC', () => {
  // 2026-07-14 22:30Z = 00:30 del 15 en Madrid (CEST)
  assertEquals(ok('clase hoy', new Date('2026-07-14T22:30:00Z')).fecha, '2026-07-15')
  // 2026-01-14 23:30Z = 00:30 del 15 en Madrid (CET)
  assertEquals(ok('clase hoy', new Date('2026-01-14T23:30:00Z')).fecha, '2026-01-15')
  // 2026-07-14 21:30Z = 23:30 del 14 en Madrid
  assertEquals(ok('clase hoy', new Date('2026-07-14T21:30:00Z')).fecha, '2026-07-14')
})

Deno.test('fin de año', () => {
  const nochevieja = new Date('2026-12-31T11:00:00Z') // 12:00 Madrid
  assertEquals(ok('clase mañana', nochevieja).fecha, '2027-01-01')
  assertEquals(ok('clase pasado mañana', nochevieja).fecha, '2027-01-02')
  const r = ok('examen 7/1', nochevieja)
  assertEquals(r.fecha, '2027-01-07')
  assertEquals(r.avisos.length, 1)
  assertEquals(ok('reunión 3', nochevieja).fecha, '2027-01-03')
  assertEquals(ok('examen 31/12', nochevieja).fecha, '2026-12-31')
  // 2026-12-31 23:30Z = 2027-01-01 00:30 Madrid (viernes)
  const añoNuevo = new Date('2026-12-31T23:30:00Z')
  assertEquals(ok('clase hoy', añoNuevo).fecha, '2027-01-01')
  assertEquals(ok('examen viernes', añoNuevo).fecha, '2027-01-01')
  assertEquals(ok('examen viernes que viene', añoNuevo).fecha, '2027-01-08')
  // 31/12 ya pasó (ayer en Madrid): resuelve a 2027-12-31 sin aviso
  const ayer = ok('examen 31/12', añoNuevo)
  assertEquals(ayer.fecha, '2027-12-31')
  assertEquals(ayer.avisos.length, 0)
})

Deno.test('año bisiesto', () => {
  const feb = new Date('2027-02-10T10:00:00Z')
  const r = ok('examen 29/2', feb)
  assertEquals(r.fecha, '2028-02-29')
  assertEquals(ok('clase mañana', new Date('2028-02-28T10:00:00Z')).fecha, '2028-02-29')
  assertEquals(ok('clase mañana', new Date('2027-02-28T10:00:00Z')).fecha, '2027-03-01')
})

Deno.test('titulo: capitaliza, limpia puntuacion y rellenos de borde', () => {
  assertEquals(ok('examen, jueves 22 AED.').titulo, 'Examen Acceso a datos')
  assertEquals(ok('  EXAMEN   final   mañana  ').titulo, 'EXAMEN final')
  assertEquals(ok('para el examen de teoría el viernes').titulo, 'Examen de teoría')
})

Deno.test('no hay efectos de borde: la misma entrada da la misma salida', () => {
  assertEquals(parseEvento('examen jueves 22 AED', AHORA), parseEvento('examen jueves 22 AED', AHORA))
})

// ---------------------------------------------------------------------------
// Numero suelto como dia / cantidades / fechas relativas
// ---------------------------------------------------------------------------

Deno.test('numero suelto: prioridad al numero tras el/dia/del/para/hasta', () => {
  const r = ok('entrega 3 ejercicios el 22')
  assertEquals(r.fecha, '2026-10-22')
  assertEquals(r.titulo, 'Entrega 3 ejercicios')
  assertEquals(r.materia, null)
  assertEquals(ok('examen tema 3 y 4 el 22').fecha, '2026-10-22')
  assertEquals(ok('examen tema 3 y 4 el 22').titulo, 'Examen tema 3 y 4')
  assertEquals(ok('entrega para el 25 con 2 ejercicios').fecha, '2026-10-25')
  assertEquals(ok('entrega hasta 25').fecha, '2026-10-25')
  assertEquals(ok('entrega del 25').fecha, '2026-10-25')
})

Deno.test('un numero seguido de una unidad no es una fecha', () => {
  const r = ok('examen 2 parciales viernes')
  assertEquals(r.fecha, '2026-10-09')
  assertEquals(r.titulo, 'Examen 2 parciales')
  assertEquals(ok('examen 3 temas viernes').titulo, 'Examen 3 temas')
  assertStringIncludes(err('entrega 3 ejercicios'), 'No he encontrado la fecha')
})

Deno.test('varios numeros sueltos sin prioridad ni dia de la semana -> ok:false', () => {
  assertStringIncludes(err('examen 22 23'), 'más de una fecha')
  assertStringIncludes(err('examen el 22 y el 23'), 'más de una fecha')
})

Deno.test('fechas relativas no soportadas -> ok:false con ejemplos', () => {
  for (const t of ['examen en 3 días', 'examen en 2 semanas', 'examen dentro de 3 días', 'examen en una semana', 'examen la semana que viene']) {
    const e = err(t)
    assertStringIncludes(e, 'relativas')
    assertStringIncludes(e, 'examen el 22')
  }
})

Deno.test('minutos con "y N", "menos N" y punto', () => {
  const r = ok('examen viernes a las 10 y 15')
  assertEquals(r.fecha, '2026-10-09')
  assertEquals(r.hora, '10:15')
  assertEquals(r.titulo, 'Examen')
  const r2 = ok('examen 22 a las 9 y 30')
  assertEquals(r2.hora, '09:30')
  assertEquals(r2.titulo, 'Examen')
  assertEquals(ok('examen viernes 9.30').hora, '09:30')
  assertEquals(ok('examen viernes 9.30').titulo, 'Examen')
  assertEquals(ok('examen viernes a las 10 menos 5').hora, '09:55')
  assertEquals(ok('examen viernes a las 9 y 45 de la noche').hora, '21:45')
})

Deno.test('12 de la noche / mañana / mediodia', () => {
  const n = ok('entrega viernes a las 12 de la noche')
  assertEquals(n.fecha, '2026-10-09')
  assertEquals(n.hora, '23:59')
  assertEquals(ok('examen viernes a las 12 de la mañana').hora, '12:00')
  assertEquals(ok('examen viernes a las 12 de la mañana').fecha, '2026-10-09')
  assertEquals(ok('examen viernes a las 12 del mediodía').hora, '12:00')
  assertEquals(ok('examen viernes a las 12 del mediodía').titulo, 'Examen')
})

Deno.test('dos fechas distintas -> ok:false', () => {
  assertStringIncludes(err('examen mañana 22'), 'más de una fecha')
  assertStringIncludes(err('examen jueves 22 y viernes 23'), 'más de una fecha')
  assertStringIncludes(err('examen 7/11 y 8/11'), 'más de una fecha')
  assertStringIncludes(err('examen 7/11 el 22'), 'más de una fecha')
  assertStringIncludes(err('examen mañana 7/11'), 'más de una fecha')
  // mismo dia de la semana repetido no es un conflicto
  assertEquals(ok('examen viernes 9').fecha, '2026-10-09')
})

Deno.test('año fuera de rango', () => {
  assertStringIncludes(err('examen 1/1/9999'), 'demasiado lejos')
  assertStringIncludes(err('examen 7/11/2029'), 'demasiado lejos')
  assertEquals(ok('examen 7/11/2028').fecha, '2028-11-07')
  assertStringIncludes(err('examen 22 de octubre de 2030'), 'demasiado lejos')
})

Deno.test('abreviaturas de mes: 22-oct, 22 oct', () => {
  assertEquals(ok('examen 22-oct').fecha, '2026-10-22')
  assertEquals(ok('examen 22-oct').titulo, 'Examen')
  assertEquals(ok('examen 22/oct').fecha, '2026-10-22')
  assertEquals(ok('examen 22 oct').fecha, '2026-10-22')
  assertEquals(ok('examen 22-nov-2027').fecha, '2027-11-22')
  assertEquals(ok('examen 22 oct.').fecha, '2026-10-22')
})

Deno.test('materia solo en examenes y entregas (regla de inferirCategoria)', () => {
  // no es examen/entrega: materia null y el texto se queda en el titulo
  const c = ok('charla sobre sostenibilidad viernes')
  assertEquals(c.materia, null)
  assertEquals(c.titulo, 'Charla sobre sostenibilidad')
  const t = ok('tutoría mañana AED')
  assertEquals(t.materia, null)
  assertEquals(t.titulo, 'Tutoría AED')
  // examen/entrega por codigo: se quita el codigo y se anade nombreCorto
  const e = ok('examen jueves 22 AED')
  assertEquals(e.titulo, 'Examen Acceso a datos')
  assertEquals(e.materia, 'Acceso a datos')
  // nombre largo: se deja como se escribio, materia se conserva
  const n = ok('entrega viernes Sostenibilidad')
  assertEquals(n.titulo, 'Entrega Sostenibilidad')
  assertEquals(n.materia, 'Sostenibilidad')
  // palabras clave de la web: practica, tarea, proyecto, trabajo, quiz, parcial, final
  assertEquals(ok('práctica viernes DPL').materia, 'Despliegue apps web')
  assertEquals(ok('quiz viernes DPL').materia, 'Despliegue apps web')
  assertEquals(ok('tarea viernes DPL').titulo, 'Tarea Despliegue apps web')
  assertEquals(ok('clase viernes DPL').materia, null)
  // un titulo que solo es el codigo sigue siendo un error
  assertStringIncludes(err('jueves 22 AED'), 'Falta el título')
})

Deno.test('rango horario: solo se guarda la hora de inicio, con aviso', () => {
  const r = ok('examen viernes de 10 a 12')
  assertEquals(r.fecha, '2026-10-09')
  assertEquals(r.hora, '10:00')
  assertEquals(r.titulo, 'Examen')
  assertEquals(r.avisos.length, 1)
  assertStringIncludes(r.avisos[0], 'hora de inicio')
  assertEquals(ok('examen viernes de las 10:30 a las 12').hora, '10:30')
  assertEquals(ok('examen viernes de 4 a 6 de la tarde').hora, '16:00')
})

Deno.test('palabras como constructor no rompen el parser', () => {
  assertEquals(ok('constructor viernes').titulo, 'Constructor')
  assertEquals(ok('examen 22 toString').fecha, '2026-10-22')
})
