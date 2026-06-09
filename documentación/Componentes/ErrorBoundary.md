# ErrorBoundary

**Ruta real:** `src/components/ErrorBoundary.tsx`

## Qué es / qué hace

Error boundary de React (componente de clase) que envuelve toda la aplicación. Si cualquier componente hijo lanza una excepción durante el render, muestra una pantalla de "Algo salió mal" con el mensaje de error y un botón "Recargar" que ejecuta `window.location.reload()`.

## Exporta

- `export class ErrorBoundary extends Component<Props, State>`
  - `Props: { children: ReactNode }`
  - `State: { hasError: boolean; error: Error | null }`
  - `static getDerivedStateFromError(error: Error): State`

## Depende de

- `react` (`Component`, `ReactNode`)
- Clases utilitarias de Tailwind del tema (`bg-bg`, `bg-card`, `border-border`, `text-text-muted`, `gradient-primary`)

## Lo usan

- [[main]] — envuelve el árbol completo de la app (`<ErrorBoundary><BrowserRouter><App /></BrowserRouter></ErrorBoundary>`), justo en el punto de montaje de React.

## Notas

- Es el único "cortafuegos" global de errores de render: si algo revienta en cualquier página, esta es la última red de seguridad antes de una pantalla en blanco.

#componente #errores
