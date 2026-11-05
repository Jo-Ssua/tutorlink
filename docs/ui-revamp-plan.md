# Plan de rediseño de la interfaz — TutorLink

Objetivo: una sola interfaz coherente, mobile-first y con navegación por rol,
construida sobre HeroUI v3 y alineada con los wireframes de
`front/wireframes/low_fidelity/`.

---

## 1. Diagnóstico

### 1.1 El login revela información que no debería

`front/src/components/LoginCard.tsx` publica, antes de autenticar:

- las cuentas semilla con su nombre y su rol
  (`María · sesiones ya calificadas`, `Ana · tutora`, `Administrador`);
- la frase «La contraseña de estas cuentas está en el README»;
- la URL de la API (`API: http://localhost:3000/api/v1`).

Está detrás de `import.meta.env.DEV`, pero la lista de correos reales vive en el
código fuente y aparece en cualquier build de desarrollo o de preview que se
comparta. Es enumeración de usuarios servida en bandeja.

El backend, en cambio, ya está bien: `back/src/auth/auth.service.ts` compara
contra un hash señuelo cuando el usuario no existe, responde
`INVALID_CREDENTIALS` tanto para correo inexistente como para contraseña mala o
cuenta bloqueada, y solo distingue `EMAIL_NOT_VERIFIED` / `ACCOUNT_SUSPENDED`
después de validar la contraseña. **No hay que tocarlo.**

### 1.2 El rol se le anuncia al usuario

`RoleRoute` (`front/src/auth/ProtectedRoute.tsx`) redirige y pasa
`state.deniedRoles`; `AppLayout` lo convierte en una alerta roja:

> «Esa sección está disponible solo para tutores. Te llevamos a tu inicio.»

Eso le describe al usuario un mapa de roles y secciones que no le corresponde
conocer. Además la alerta se queda pegada: aparece en pantallas de estudiante
donde no hubo ningún intento de acceso (se ve en `/app/calificaciones` y en
`/app/reservar`). El acceso denegado debe ser silencioso y las rutas de otros
roles no deben existir para quien no las puede usar.

### 1.3 Hay dos sistemas de diseño conviviendo

| | `front/src/styles.css` | `front/src/reservas/reservas.css` |
|---|---|---|
| Primario | `#5b3df5` (morado) | `#3b8beb` (azul) |
| Tipografía | Avenir Next | Inter |
| Radio | 10 / 16 / 24 px | 14 px |
| Alcance | app | `.rsv` |

1 224 + 800 líneas de CSS a mano, con tokens distintos y sin relación. Por eso
el botón «Continuar» de reservas es azul y el de «Ingresar» morado.

### 1.4 No es responsive

- Solo hay media queries `max-width` (900 / 560 / 640 px): diseño
  desktop-first con parches hacia abajo.
- `reservas.css` encierra todo el flujo en un marco fijo de 430 px centrado,
  así que en escritorio se ve un teléfono flotando en medio de la página.
- `min-height: calc(100vh - 150px)` en vez de `dvh` → corte en móvil.
- No existe navegación móvil: la `TopBar` es una fila horizontal que se apretuja.

### 1.5 Los wireframes piden otra cosa

Los 12 wireframes son mobile-first con **barra inferior de 4 ítems distinta por
rol**:

| Rol | Ítems |
|---|---|
| Estudiante | Buscar · Reservas · Pagos · Perfil |
| Tutor | Agenda · Solicitudes · Ingresos · Perfil |
| Admin | Tutores · Usuarios · Pagos · Reportes |

Hoy la app solo implementa 4 pantallas (login/registro/verificación,
calificaciones, reserva, home de tutor y de admin). **Este plan re-construye lo
que existe y deja el armazón de navegación listo para las HU que faltan; no
construye las 12 HU.**

---

## 2. Decisiones técnicas

- **HeroUI v3** (`@heroui/react` + `@heroui/styles`), sobre **Tailwind CSS v4**
  y React Aria. Sin provider, componentes compuestos, animaciones en CSS.
  Compatible con React 19 y Vite 7, que ya están en el proyecto.
- **Tema**: se conserva el morado de marca como primario, alineado al token
  `#7C3AED`, con verde `#16A34A` para confirmaciones de pago/reserva. Tokens en
  `oklch` dentro de `@theme`, un único archivo.
- **Tipografía**: Inter en todo (ya se usa en reservas; reemplaza Avenir Next).
- **Navegación adaptativa**: barra inferior `<1024 px`, barra lateral / superior
  `≥1024 px`, ambas generadas desde un mismo mapa de rol.
- **Breakpoints**: 375 / 768 / 1024 / 1440.
- Las skills de HeroUI quedaron en `.agents/skills/` y `skills-lock.json`;
  `.agents/` va al `.gitignore`, `skills-lock.json` se versiona.

---

## 3. Fases y commits

Un commit por fase, Conventional Commits, sin coautoría.

### Fase 0 — Base ✅
Instalar Tailwind v4, `@heroui/react`, `@heroui/styles`; `vite.config.ts` con el
plugin de Tailwind; `.gitignore` para `.agents/`.

`chore(front): add tailwind v4 and heroui v3`

### Fase 1 — Tema ✅
`front/src/theme.css`: tokens de color, tipografía Inter, escala de espaciado
4/8, radios, sombras, focus ring. Modo claro y oscuro declarados juntos.

`feat(front): define the heroui theme tokens`

### Fase 2 — Login sin filtraciones ✅
Eliminar `DEMO_EMAILS`, la nota del README y la línea de la API de
`LoginCard.tsx`. Las credenciales de prueba pasan a `front/README.md`. Mantener
el mensaje uniforme de `INVALID_CREDENTIALS`.

`fix(front): stop exposing demo accounts and the api url on login`

### Fase 3 — Acceso por rol silencioso ✅
Quitar `state.deniedRoles` de `RoleRoute` y la alerta de `AppLayout`. El rol sin
permiso se redirige a su propio inicio sin mensaje. La navegación solo lista
rutas alcanzables; nada de ítems deshabilitados.

`fix(front): redirect unauthorized roles without disclosing them`

### Fase 4 — Armazón adaptativo ✅
`BottomNav` (bajo 1024 px) y los mismos destinos en la `TopBar` desde ahí, los
dos desde `navItemsFor(role)`. Áreas táctiles ≥44 px, estado activo con
`aria-current`, `dvh` y hueco para la barra de gestos.

**Cambio sobre lo planeado:** no hay barra lateral en escritorio. Con uno o dos
destinos por rol una barra lateral queda vacía y roba ancho al contenido; los
ítems van en línea en la barra superior. Cuando un rol llegue a cuatro
destinos, como piden los wireframes, vuelve a evaluarse.

`feat(front): add role-based adaptive navigation`

### Fase 5 — Pantallas de autenticación ✅
Login, registro y verificación con `Form`, `TextField`, `Button`, `Alert` de
HeroUI. Errores debajo del campo con `aria-describedby`, resumen enfocable tras
un envío fallido, validación al salir del campo.

`refactor(front): rebuild the auth screens with heroui`

### Fase 6 — Calificaciones ✅
`RatingsScreen`, `SessionCard`, `ReviewForm`, `StarRating` sobre HeroUI.
`StarRating` navegable por teclado con `role="radiogroup"`. Contador de
caracteres y estado vacío como en HU-04.

**Cambio sobre lo planeado.** El contador va a 2000, no a 500: el backend
valida `@MaxLength(2000)` en `reviews.dto.ts`, y un tope visual más bajo
rechazaría comentarios que la API sí acepta. El 0/500 del wireframe es un
marcador de baja fidelidad.

`refactor(front): rebuild the ratings screens with heroui`

### Fase 7 — Reserva ✅
Disolver el marco de 430 px: el flujo de `front/src/reservas/` entra en el
armazón común. `reservas/components/ui.tsx` y `reservas.css` se reemplazan por
componentes de HeroUI. Calendario accesible por teclado; pasos con progreso y
vuelta atrás.

**Cambios sobre lo planeado.**
- El calendario propio se reemplaza por el de HeroUI (React Aria) en vez de
  añadirle teclado a mano: trae la rejilla completa (flechas, RePág/AvPág,
  Inicio/Fin) y nombra cada celda con su fecha y su estado. Lo nuestro queda
  en qué días se pueden elegir y el punto de «hay horarios».
- La `BottomBar` fija pasa a ser una `ActionBar` al final del contenido. En
  móvil el borde inferior ya lo ocupan las pestañas de navegación del armazón
  y dos barras fijas se tapan entre sí.

`refactor(front): fold the booking flow into the shared shell`

### Fase 8 — Limpieza ✅
Borrar `styles.css` y `reservas.css`. Actualizar los tests que consultan clases
viejas.

**Ampliación de alcance.** `AdminHome` y `TutorHome` siguen apoyados en las
clases de `styles.css` (`session-card`, `pill--*`, `stat__*`). Hay que pasarlas
a HeroUI dentro de esta fase; si no, borrar la hoja las deja sin estilos.

**Hecho.** Ambas pantallas migradas, más la pantalla de espera de sesión
(`SessionCheck`). Las piezas que se repetían en tres pantallas salieron a
`components/StatTile.tsx` y `components/LoadError.tsx`. De paso, `routes.tsx`
envolvía el flujo de reserva en un `<main>` propio: con el `<main>` nuevo de
`ReservasApp` quedaban dos anidados, y se quitó el de la ruta.

`chore(front): drop the legacy stylesheets`

### Fase 9 — Verificación ✅
Revisión en 375 / 768 / 1024 / 1440, contraste 4.5:1 en claro y oscuro, foco
visible, `prefers-reduced-motion`, sin scroll horizontal, `npm run typecheck` y
`npm test` en verde.

**Hecho.** Pantallas medidas en los cuatro anchos y en los dos modos: login
(con error de credenciales), registro, verificación, calificaciones, tutores,
perfil del tutor, horarios (con el calendario y el desplegable abierto) y
detalles (con el formulario en error). Sin scroll horizontal, sin texto por
debajo de 4.5:1 y sin objetivos táctiles por debajo de 44 px.

**El modo oscuro no se aplicaba.** Nada ponía `data-theme` en el `<html>` y
HeroUI no mira `prefers-color-scheme`: los tokens oscuros nunca entraban.
`src/theme.ts` sincroniza el modo con el del sistema y escucha los cambios. No
se añade un interruptor en la interfaz porque no se pidió.

**Arreglos de contraste en modo claro.** El rojo de campo inválido (`--danger`,
L 65%) daba 3,27:1 sobre el fondo de página; bajado a L 52% da 5,6:1 y el
blanco encima sigue en 6,1:1. Antes, en la misma línea, el ámbar de las
estrellas y el gris de texto secundario.

**Arreglos de objetivo táctil.** En `pointer: coarse` nada baja de 44 px:
botones, disparador de `Select`, campos de texto, opciones del desplegable,
celdas y flechas del calendario (HeroUI las dibuja a 36 y 24 px, medidas de
ratón) y la etiqueta de radios y casillas. Con ratón esa etiqueta se queda en
los 24 px que pide la WCAG 2.2, y el resto conserva la densidad original.

**Lo que se revisó y se dejó como está.**
- Los 41 días apagados del calendario (2,1:1 y 3,3:1) son celdas
  `aria-disabled`: la 1.4.3 exime los controles inactivos, y subirles el color
  les quitaría la única señal de que no se pueden elegir.
- «Regístrate con tu correo institucional», «Verifica tu cuenta» e «Inicia
  sesión» miden menos de 44 px de alto, pero son enlaces dentro de una frase y
  la 2.5.8 los exime.
- Los `input` nativos de 13 px y los `select` escondidos son el andamio de
  React Aria; el blanco real es la etiqueta que los tapa.
- La pantalla de confirmación (`DoneScreen`) es la única que no se midió en
  vivo: llegar a ella exige crear una reserva de verdad en la base de datos de
  desarrollo. Se apoya en los mismos componentes y tokens ya medidos.

**Dos trampas al medir, por si se repite.** `getComputedStyle` devuelve colores
en `oklab()`/`oklch()`, que `fillStyle` de canvas interpreta mal: hay que
convertir a mano. Y HeroUI anima el cambio de color, así que medir justo
después de cambiar de modo devuelve valores a medio camino —con el panel
oculto la animación ni avanza—: hay que desactivar las transiciones antes.

`fix(front): close the accessibility and responsive gaps`

---

## 4. Fuera de alcance

- Las HU sin pantalla construida (pagos, disponibilidad, solicitudes, ingresos,
  perfil profesional, aprobación de tutores, gestión de usuarios, comisiones,
  reportes). Quedan los ítems de navegación y el armazón; las pantallas son
  trabajo aparte.
- Cambios en el backend: el login ya responde de forma uniforme.
