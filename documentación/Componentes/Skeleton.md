# Skeleton

**Ruta real:** `src/components/Skeleton.tsx`

## Qué es / qué hace

Familia de componentes de "esqueleto de carga" (shimmer) usados para evitar el parpadeo de contenido vacío mientras se cargan datos. Todos comparten la clase CSS `shimmer` (definida en `index.css`/Tailwind) que produce el efecto de brillo animado.

## Exporta

| Componente | Uso |
|---|---|
| `SkeletonBox` | Bloque rectangular genérico (`className`, `style`) |
| `SkeletonCard` | Tarjeta contenedora con fondo/borde de superficie |
| `SkeletonLine` | Línea/barra genérica |
| `SkeletonCircle` | Círculo (avatares), con `size` configurable |
| `SkeletonSchedule` | Esqueleto específico del widget de horario diario en Home (filas con hora, dot, materia, badge) |
| `SkeletonQuickActions` | Esqueleto de la cuadrícula de accesos rápidos en Home |

## Depende de

- Solo de variables CSS del tema (`--color-surface`, `--gradient-card`, `--overlay-*`) y la clase `shimmer`.

## Lo usan

- [[Home]] (`SkeletonSchedule`, `SkeletonQuickActions`, `SkeletonBox`, `SkeletonCard`)
- [[Actividades]], [[Admin]], [[Calendar]], [[Apuntes]] (`SkeletonBox`, `SkeletonCard` en sus respectivos `*Skeleton` internos)

## Notas

- Cada página define su propio componente `*Skeleton` (p. ej. `ActividadesSkeleton`, `AdminSkeleton`, `CalendarSkeleton`, `NewsSkeleton`, `ApuntesSkeleton`) componiendo estas piezas básicas.

#componente #ui #carga
