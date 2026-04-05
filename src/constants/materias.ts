export interface Materia {
  codigo: string
  nombre: string
  nombreCorto: string
}

export const MATERIAS: Materia[] = [
  { codigo: 'BAE', nombre: 'Bases de datos',                                              nombreCorto: 'Bases de datos' },
  { codigo: 'DJK', nombre: 'Digitalización aplicada a los sectores productivos (GS)',     nombreCorto: 'Digitalización GS' },
  { codigo: 'ETS', nombre: 'Entornos de desarrollo',                                      nombreCorto: 'Entornos de desarrollo' },
  { codigo: 'IKL', nombre: 'Inglés profesional (GS)',                                     nombreCorto: 'Inglés profesional' },
  { codigo: 'ITK', nombre: 'Itinerario personal para la empleabilidad I',                 nombreCorto: 'Itinerario empleab. I' },
  { codigo: 'LND', nombre: 'Lenguajes de marcas y sistemas de gestión de información',    nombreCorto: 'Lenguajes de marcas' },
  { codigo: 'PRO', nombre: 'Programación',                                                nombreCorto: 'Programación' },
  { codigo: 'SSF', nombre: 'Sistemas informáticos',                                       nombreCorto: 'Sistemas informáticos' },
]
