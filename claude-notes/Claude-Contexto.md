# Contexto de trabajo con Claude

> Esta nota guía cómo Claude debe comportarse en este proyecto.

## Sobre el proyecto

TopCode es una intranet académica en producción, desplegada en Vercel con Supabase como backend. No es un proyecto de práctica — los cambios afectan a usuarios reales.

## Preferencias de trabajo

- Respuestas cortas y directas
- Priorizar la seguridad RLS en cualquier cambio que toque la base de datos
- No añadir abstracciones innecesarias — el código actual es intencional
- Antes de crear archivos nuevos, comprobar si se puede editar uno existente

## Contexto técnico importante

- Supabase RLS está activado en todas las tablas — cualquier nueva query debe respetarlo
- Los campos `email` y `es_superadmin` solo son accesibles via funciones SECURITY DEFINER
- El rol admin se detecta por `es_superadmin = true` en la tabla `usuarios`
- El routing es React Router v6 con rutas protegidas en `App.tsx`
- No hay tests automatizados — la verificación es manual en el navegador

## Flujo de deploy

```
git push → Vercel (auto-deploy desde main)
```

## Archivos críticos

| Archivo | Por qué es crítico |
|---------|-------------------|
| `src/contexts/AuthContext.tsx` | Estado global de sesión y rol |
| `src/lib/` | Clientes de Supabase |
| `vite.config.ts` | CSP y configuración de build |
| `vercel.json` | Routing SPA en producción |
| `supabase/` | Migraciones SQL y políticas RLS |

## Relacionado

- [[Arquitectura]]
- [[Seguridad]]
- [[Decisiones]]
