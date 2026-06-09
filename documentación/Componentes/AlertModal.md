# AlertModal

**Ruta real:** `src/components/AlertModal.tsx`

## Qué es / qué hace

Modal genérico de alerta y confirmación, reutilizado en toda la app para sustituir a `window.alert`/`window.confirm`. Se renderiza con `createPortal` directamente sobre `document.body`. Soporta 4 tipos visuales (`error`, `success`, `info`, `warning`), cada uno con su icono y paleta de color (objeto `CONFIG`). Se cierra con la tecla `Escape`, con el botón de cierre o haciendo click en el backdrop.

Si recibe `onConfirm`, muestra dos botones (Cancelar / Confirmar); si no, muestra un único botón "Aceptar". `confirmDestructive` cambia el estilo del botón de confirmación a rojo (para acciones irreversibles como borrar).

## Exporta

- `export default function AlertModal(props: AlertModalProps)`

### Props (`AlertModalProps`)
- `visible: boolean`
- `type?: 'error' | 'success' | 'info' | 'warning'`
- `title: string`
- `message?: string`
- `onClose: () => void`
- `onConfirm?: () => void`
- `confirmLabel?: string`
- `confirmDestructive?: boolean`

## Depende de

- `react-dom` (`createPortal`)
- `lucide-react` (iconos `X`, `AlertCircle`, `CheckCircle`, `Info`, `AlertTriangle`)
- Variables CSS del tema (`--color-surface`, `--color-modal-backdrop`, `--overlay-*`, etc.)

## Lo usan

Prácticamente todas las páginas que necesitan confirmar acciones o mostrar errores: [[../Paginas/Login|Login]], [[../Paginas/Register|Register]], [[../Paginas/Profile|Profile]], [[../Paginas/Actividades|Actividades]], [[../Paginas/Admin|Admin]], [[../Paginas/Calendar|Calendar]], [[../Paginas/Apuntes|Apuntes]], [[../Paginas/News|News]], etc.

## Notas

- Componente puramente de presentación — no contiene lógica de negocio ni llamadas a Supabase.
- El patrón habitual en las páginas es guardar el estado del modal en un `alert`/`modal` de tipo `AlertState | null` y pasar sus campos como props.

#componente #ui
