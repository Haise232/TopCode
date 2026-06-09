# constants/materias

**Ruta real:** `src/constants/materias.ts`

## Qué es / qué hace

Catálogo estático (hardcodeado) de las **8 asignaturas** del ciclo formativo (DAW/DAM), cada una con código, nombre completo y nombre corto para mostrar en espacios reducidos (badges, chips).

```ts
interface Materia { codigo: string; nombre: string; nombreCorto: string }
export const MATERIAS: Materia[]
```

Asignaturas incluidas: Bases de datos (BAE), Digitalización GS (DJK), Entornos de desarrollo (ETS), Inglés profesional (IKL), Itinerario empleabilidad I (ITK), Lenguajes de marcas (LND), Programación (PRO), Sistemas informáticos (SSF).

## Exporta

- `export interface Materia`
- `export const MATERIAS: Materia[]`

## Depende de

- Nada — datos estáticos.

## Lo usan

- [[Calendar]], [[Actividades]] — para los selectores de "materia" en sus formularios de creación.
- Posiblemente otras páginas que muestran/filtran por asignatura (revisar `grep -rl MATERIAS src/`).

## Notas

- Si cambia el plan de estudios (nuevas asignaturas, códigos), este es el único fichero a editar — no hay tabla de base de datos equivalente, es contenido fijo del frontend.

#constantes #materias #catalogo
