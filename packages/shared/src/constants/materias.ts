export interface Materia {
  codigo: string
  nombre: string
  nombreCorto: string
}

export const MATERIAS: Materia[] = [
  { codigo: 'AED', nombre: 'Acceso a datos',                                              nombreCorto: 'Acceso a datos' },
  { codigo: 'DAD', nombre: 'Desarrollo de interfaces',                                    nombreCorto: 'Desarrollo interfaces' },
  { codigo: 'DPL', nombre: 'Despliegue de aplicaciones web',                              nombreCorto: 'Despliegue apps web' },
  { codigo: 'IPW', nombre: 'Itinerario personal para la empleabilidad II',                nombreCorto: 'Itinerario empleab. II' },
  { codigo: 'PGL', nombre: 'Programación multimedia y dispositivos móviles',              nombreCorto: 'Prog. multimedia' },
  { codigo: 'PGV', nombre: 'Programación de servicios y procesos',                        nombreCorto: 'Prog. servicios y procesos' },
  { codigo: 'PL9', nombre: 'Proyecto intermodular',                                       nombreCorto: 'Proyecto intermodular' },
  { codigo: 'SOJ', nombre: 'Sostenibilidad aplicada al sistema productivo',               nombreCorto: 'Sostenibilidad' },
  { codigo: 'SSG', nombre: 'Sistemas de gestión empresarial',                             nombreCorto: 'Sist. gestión empresarial' },
]
