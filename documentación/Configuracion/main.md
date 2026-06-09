# main

**Ruta real:** `src/main.tsx`

## Qué es / qué hace

Punto de entrada de la aplicación. Monta React en `#root` envuelto en:

```
<ErrorBoundary>
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <App />
  </BrowserRouter>
</ErrorBoundary>
```

**Deliberadamente fuera de `React.StrictMode`**: el doble montaje de StrictMode en desarrollo provocaba que Supabase intentara adquirir el lock de auth en paralelo → timeout de 5s → carga infinita. Se documenta explícitamente en un comentario del fichero.

## Exporta

Nada (fichero de arranque, `ReactDOM.createRoot(...).render(...)`).

## Depende de

- [[../Componentes/ErrorBoundary|ErrorBoundary]]
- [[App]]
- `react-dom/client`, `react-router-dom` (`BrowserRouter`)
- `./index.css`

## Lo usan

- Es el script cargado por [[index-html]] (`<script type="module" src="/src/main.tsx">`).

## Notas

- Si alguna vez se reactiva `StrictMode`, hay que revisar primero el bypass de `navigator.locks` en [[../Lib-y-Contexts/lib-supabase|lib-supabase]] (relacionado con el mismo problema de doble montaje).

#configuracion #entrada #critico
