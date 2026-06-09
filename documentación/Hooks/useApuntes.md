# useApuntes

**Ruta real:** `src/hooks/useApuntes.ts`

## Qué es / qué hace

Hook de datos para la **biblioteca de apuntes compartidos**. Gestiona:

- Carga de apuntes con datos del autor (`select('*, usuarios(nombre, avatar_url)')`), con caché TTL de 30 s.
- **Subida** (`subirApunte`): valida tamaño máx. 20 MB, sube el fichero al bucket `apuntes` de Supabase Storage (vía `subirArchivo` de [[lib-supabase]]), normaliza el nombre del fichero a UTF-8/NFC (`normalizarNombre`, corrige problemas de encoding de navegadores), inserta el registro en la tabla `apuntes` de forma optimista.
- **Borrado** (`eliminarApunte`): borra primero del registro local (optimista), intenta borrar el objeto del Storage (extrayendo el `path` de la URL pública) y finalmente borra la fila de la tabla; revierte si falla.

## Exporta

- `export type ApunteConAutor` — apunte + relación `usuarios: { nombre, avatar_url } | null`
- `export function useApuntes(): UseApuntesReturn`

### Devuelve (`UseApuntesReturn`)
- `apuntes: ApunteConAutor[]`
- `loading`, `error`, `subiendo`
- `init()`, `refresh()`
- `subirApunte(file, usuarioId, tipo)`, `eliminarApunte(ap)`

## Depende de

- [[lib-supabase]] (`supabase`, `subirArchivo`, `eliminarArchivoStorage`)

## Lo usan

- [[Apuntes]] (página principal — único consumidor)

## Notas

- `normalizarNombre` reinterpreta el string como bytes Latin-1 → UTF-8: corrige nombres de fichero mal codificados que llegan del navegador (acentos, ñ, etc.).
- Tabla relacionada: `apuntes`; bucket de Storage: `apuntes` (políticas en [[../Base-de-datos/supabase-setup|supabase-setup]]).

#hook #datos #apuntes #storage #optimistic-updates #cache
