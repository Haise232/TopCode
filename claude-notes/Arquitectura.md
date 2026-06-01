# Arquitectura

## Estructura de carpetas

```
src/
├── App.tsx               # Rutas principales (React Router v6)
├── main.tsx
├── index.css
├── components/           # Componentes reutilizables
│   ├── AlertModal.tsx
│   ├── AnuncioModal.tsx
│   ├── ErrorBoundary.tsx
│   ├── Layout.tsx        # Shell con nav lateral
│   ├── Loading.tsx
│   ├── PrivateMessageToast.tsx
│   └── Skeleton.tsx
├── contexts/
│   └── AuthContext.tsx   # Estado global de autenticación
├── hooks/                # Un hook por dominio (data fetching)
│   ├── useAuth.ts
│   ├── useActividades.ts
│   ├── useApuntes.ts
│   ├── useDataInit.ts
│   ├── useEventos.ts
│   ├── useHomeDatos.ts
│   ├── useMensajes.ts
│   ├── useNotas.ts
│   └── useNotifications.ts
├── lib/                  # Clientes y utilidades
├── pages/                # Una página por ruta
│   ├── Actividades.tsx
│   ├── Admin.tsx
│   ├── Apuntes.tsx
│   ├── Calendar.tsx
│   ├── Chat.tsx
│   ├── Home.tsx
│   ├── Login.tsx
│   ├── News.tsx
│   ├── Profile.tsx
│   └── Register.tsx
└── constants/
```

## Flujo de datos

```
Supabase (PostgreSQL + Auth + Realtime + Storage)
        ↓
  hooks/ (useX.ts)  ←→  AuthContext
        ↓
   pages/ (vistas)
        ↓
  components/ (UI)
```

## Rutas protegidas

- Todas las rutas excepto `/login` y `/register` requieren sesión activa.
- El rol `es_superadmin = true` desbloquea el Panel Admin.
- El acceso al campo `email` de otros usuarios está restringido por RLS.

## Relacionado

- [[Stack]]
- [[Seguridad]]
