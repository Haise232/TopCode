# Bugs resueltos

#bug

## HTTP 500 en tabla `usuarios`
- **Commit:** `1c1fc57`
- **Síntoma:** Error 500 en todas las queries a la tabla usuarios
- **Causa raíz:** Políticas RLS que bloqueaban al usuario leer su propia fila
- **Fix:** Reescritura de políticas RLS para permitir `SELECT` de la propia fila
- **Estado:** ✅ Resuelto

---

## Perfiles perdidos al iniciar sesión
- **Commit:** `3d82cee`
- **Síntoma:** `fetchUsuario` devolvía vacío y la app quedaba en estado de carga
- **Causa raíz:** Race condition — el perfil no existía aún en la tabla al momento del fetch
- **Fix:** Lógica de reintento en `fetchUsuario`
- **Estado:** ✅ Resuelto

---

## Flash de "Estudiante" en Home
- **Commits:** `d61327c`, `20b622f`
- **Síntoma:** La home mostraba el rol "Estudiante" durante un instante aunque el usuario fuera admin
- **Causa raíz:** La Home renderizaba antes de que `AuthContext` tuviera el perfil cargado
- **Fix:** Skeleton de carga + esperar a que el contexto esté listo antes de renderizar roles
- **Estado:** ✅ Resuelto

---

## Build roto por export faltante
- **Commit:** `f7f6244`
- **Síntoma:** Error de build — `actualizarPromedio` no exportado
- **Fix:** Añadir export + eliminar variable `bg` no usada
- **Estado:** ✅ Resuelto

---

## Carga infinita en News
- **Commit:** `6411993`
- **Síntoma:** La sección de noticias quedaba en spinner infinito
- **Fix:** Corrección en la lógica de fetching del hook de noticias
- **Estado:** ✅ Resuelto

---

## modulePreload en posición incorrecta
- **Commit:** `98c5072`
- **Síntoma:** Warning/error de Vite en el build
- **Fix:** Mover `modulePreload` a la posición correcta en `vite.config.ts`
- **Estado:** ✅ Resuelto

---

## Carga infinita al eliminar Notes.tsx
- **Commit:** `001dbc6`
- **Síntoma:** Al eliminar la página de notas, la interfaz `Nota` también desapareció causando errores de tipo
- **Fix:** Restaurar la interfaz `Nota` en el lugar correcto
- **Estado:** ✅ Resuelto

## Relacionado

- [[Decisiones]]
- [[Seguridad]]
