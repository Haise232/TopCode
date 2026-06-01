# Decisiones clave del proyecto

#decision

## Arquitectura

### Un hook por dominio
**Decisión:** Cada entidad de datos tiene su propio hook (`useNotas`, `useMensajes`, etc.)  
**Razón:** Mantener la lógica de fetching separada de las vistas, facilita el testing y el reuso.

### AuthContext global
**Decisión:** El estado de sesión y perfil de usuario vive en un Context, no en cada página.  
**Razón:** Múltiples páginas necesitan saber si el usuario es admin. Evita prop drilling.

### Skeleton en carga inicial
**Decisión:** Mostrar skeleton en Home mientras carga el perfil.  
**Razón:** Evitar el flash visual de "Estudiante" antes de que llegue el rol real del servidor.  
**Commit:** `d61327c`, `20b622f`

---

## Base de datos

### SECURITY DEFINER para campos sensibles
**Decisión:** Usar funciones `SECURITY DEFINER` para acceder a `email` y `es_superadmin`.  
**Razón:** RLS normal no era suficientemente granular; las funciones actúan como un proxy seguro.  
**Commit:** `ff7ad65`

### Vista pública sin campos sensibles
**Decisión:** Crear una vista SQL con solo los campos no sensibles para listados.  
**Razón:** Separar lo que cualquier usuario puede ver de lo que es privado.  
**Commit:** `aa9581f`

---

## Frontend

### Eliminar Notes.tsx
**Decisión:** La página de notas standalone fue eliminada.  
**Razón:** Consolidación de funcionalidad, reduce duplicación.  
**Commit:** `001dbc6`

### Renombrar sección a "News"
**Decisión:** La sección de anuncios pasó a llamarse "News".  
**Razón:** Nomenclatura más clara e internacional.  
**Commit:** `6411993`

### Quitar notas de Home
**Decisión:** El widget de notas se eliminó del dashboard.  
**Razón:** Reducir carga de queries en la página principal y simplificar la vista.  
**Commit:** `191c6a3`

---

## Despliegue

### Vercel como hosting
**Decisión:** Vercel en lugar de GitHub Pages para producción.  
**Razón:** Soporte nativo para SPA routing, deploys automáticos desde `main`, edge network.  
**Config:** `vercel.json` en raíz del proyecto.

## Relacionado

- [[Arquitectura]]
- [[Bugs]]
- [[Seguridad]]
