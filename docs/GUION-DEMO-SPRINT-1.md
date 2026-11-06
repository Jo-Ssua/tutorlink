# Guion de la demo del Sprint 1

Guion para probar las 12 historias de usuario en local y grabar un video de
~10 minutos para la presentación. Cada bloque dice qué hacer en pantalla, qué
decir y cuál criterio de aceptación queda demostrado.

- **Duración objetivo:** 9–11 min. Al final hay una [versión corta de 2 min](#4-versión-corta-2-minutos).
- **Datos:** todo sale del seed. Nada se escribe a mano salvo la cuenta nueva del registro.
- **Contraseña de todas las cuentas del seed:** `TutorLink123*`

---

## 1. Antes de grabar

### 1.1 Dejar el backend listo

```bash
cd back && docker compose up -d postgres
```

```bash
cd back && npx prisma migrate deploy && npm run prisma:seed
```

El seed califica las tres sesiones completadas, así que la pantalla de
calificaciones queda vacía. Este comando deja una sesión sin calificar para
poder grabar la HU 8:

```bash
cd back && npm run demo:pending-review
```

### 1.2 Activar el código de verificación en pantalla

En `back/.env`:

```
EXPOSE_DEV_CODES=true
```

Con eso el código de 6 dígitos aparece en la pantalla de verificación y no hay
que salir a buscarlo en el log. El cambio solo surte efecto al **reiniciar la
API**: `nest start --watch` no recarga el `.env`. **Devolverlo a `false` cuando
termines de grabar.**

### 1.3 Levantar la API y el front

Dos terminales separadas:

```bash
cd back && npm run start:dev
```

```bash
cd front && npm run dev
```

Esperar a que `http://localhost:3000/api/v1/health` responda antes de abrir el
front; si se entra demasiado pronto, el login muestra "No se pudo conectar con
el servidor".

### 1.4 Preparar la pantalla

- Ventana del navegador a 1920×1080, zoom en 100 % (`Ctrl+0`).
- Cerrar DevTools, ocultar la barra de marcadores, cerrar las demás pestañas.
- Usar una ventana nueva sin sesión guardada, o limpiar con `Ctrl+Shift+Supr`.
- Silenciar notificaciones de Windows: **Configuración → Sistema → Notificaciones → No molestar**.
- Tener este guion en un segundo monitor o impreso, no en pantalla.

### 1.5 Grabar

- **Xbox Game Bar:** `Win+Alt+R` empieza y detiene. Graba solo la ventana activa
  (no sirve para el Explorador de archivos; para el navegador va bien). El video
  queda en `Vídeos\Capturas`.
- **Alternativa con edición:** Clipchamp (viene con Windows 11) graba pantalla y
  permite cortar los tiempos muertos.
- Grabar cada historia en un clip aparte es más fácil de rehacer que un solo
  video largo; luego se unen o se insertan por separado en las diapositivas.

---

## 2. Datos del seed que se usan en el video

| Cuenta | Correo | Para qué |
| --- | --- | --- |
| Estudiante (María Fernanda López) | `estudiante@universidad.edu.co` | HU 1, 3–11 |
| Tutora (Ana María Torres) | `ana.tutor@universidad.edu.co` | HU 12 |
| Administrador | `admin@universidad.edu.co` | Opcional, aprobación de postulaciones |

| Tutor | Tarifa | Promedio | Materias verificadas | Modalidades |
| --- | --- | --- | --- | --- |
| Ana María Torres | 45.000 | 5,0 (1 reseña) | SIS201, SIS301, SIS401 | Virtual, Híbrida |
| Diego Alejandro Ríos | 60.000 | 4,0 (1 reseña) | SIS301, SIS401 | Presencial, Híbrida |
| Sofía Valentina Gómez | 50.000 | sin reseñas | SIS201, MAT101, IND201 | Virtual |

Catálogo: **Facultad de Ingeniería** (Ingeniería de Sistemas, Ingeniería
Industrial), **Facultad de Ciencias** (Matemáticas), **Facultad de Economía**
(Administración de Empresas). Profesores: Laura Méndez (SIS201), Carlos Rojas
(SIS301, SIS401), Patricia Gómez (MAT101), Andrés Silva (IND201, ADM101).

---

## 3. Guion por historia

### HU 2 · Registro con correo institucional · ~1:00

Empezar aquí y no por el login: así la primera cosa que se ve es una cuenta
naciendo.

1. Abrir `http://localhost:5173` → **Regístrate con tu correo institucional**.
2. Llenar nombre `Demo Sprint 1`, correo **`demo@gmail.com`**, contraseña
   `TutorLink123*` dos veces. Señalar el medidor **Seguridad: Fuerte**.
3. **Crear cuenta** → *"Usa tu correo institucional para registrarte. Formato
   aceptado: @universidad.edu.co o @estudiantes.universidad.edu.co"*. Decir que
   **ni siquiera se llamó a la API**: el front corta antes. **(criterio 3)**
4. Corregir el correo a `demo.sprint1@universidad.edu.co` y **Crear cuenta**
   → la app lleva a `/verificar` con el correo ya puesto, el contador
   **Vence en 14:5x** y, en modo desarrollo, el código en pantalla
   (*"Modo desarrollo: tu código es 019574"* — el tuyo será otro). **(criterio 1)**
5. Escribir `000000` y **Activar mi cuenta** → *"El código no es válido.
   Revísalo o solicita uno nuevo. Intentos restantes: 4"*.
6. Escribir el código correcto → vuelve al login con *"Tu cuenta quedó activa.
   Inicia sesión para continuar."* **(criterio 2)**

### HU 1 · Inicio y cierre de sesión · ~0:50

1. Entrar con `estudiante@universidad.edu.co` y la contraseña `Equivocada123*`
   → *"Correo o contraseña incorrectos. Revisa los datos e inténtalo de nuevo."*
   Repetir con un correo que no existe (`nadie@universidad.edu.co`): **el
   mensaje es exactamente el mismo**, así que la API no sirve para averiguar qué
   correos están registrados. **(criterio 2)**
2. Entrar con la contraseña correcta → cae en **Calificaciones**, la pantalla
   inicial del rol estudiante. **(criterio 1)**
3. **Cerrar sesión** y pulsar la flecha de **atrás** del navegador
   → vuelve al login, no a la sesión anterior. **(criterio 3)**
4. Volver a entrar como `estudiante@universidad.edu.co` y quedarse ahí para lo
   que sigue.

### HU 4 · Búsqueda contextual de tutores · ~1:10

1. Pestaña **Reservar**. Se ven los 3 tutores verificados. Pedro Ramírez no
   aparece: su postulación sigue pendiente.
2. Aplicar los filtros en orden y narrar cómo cada uno recorta el siguiente:
   - **Facultad:** Facultad de Ingeniería → el selector de programa queda en 2 opciones.
   - **Programa:** Ingeniería de Sistemas → materias SIS201, SIS301, SIS401.
   - **Materia:** SIS201 · Estructuras de Datos → profesor Laura Méndez.
   - **Profesor:** Laura Méndez.
3. **Aplicar filtros** → quedan **2 tutores**: Ana María Torres y Sofía Valentina
   Gómez. Los dos cumplen *todos* los filtros. **(criterios 1 y 2)**
4. Cambiar la facultad a **Facultad de Economía** y aplicar → ningún resultado y
   el aviso que manda la API: *no hay tutores compatibles, ajusta los filtros o
   usa StudyMatch para una búsqueda urgente*. **(criterio 3)**
5. Volver la facultad a **Facultad de Ingeniería**, dejar los demás selectores
   en "Todos" y aplicar: vuelven los 3 tutores. Ese filtro se queda puesto para
   la HU 11.

### HU 6 · Resultados comparables · ~0:30

Sin cambiar de pantalla, recorrer una tarjeta con el cursor:

1. Nombre, insignia **Verificado**, materias, **tarifa** ($ 45.000/h),
   **calificación promedio** y **disponibilidad** (viernes 6 de noviembre ·
   3:00 P.M.), todo sin abrir el perfil. **(criterio 1)**
2. Señalar la tarjeta de **Sofía Valentina Gómez**: dice **Sin calificaciones**
   en lugar de inventar un promedio. **(criterio 2)**
3. Mencionar que cuando un tutor no tiene franjas futuras la tarjeta muestra
   **Sin disponibilidad**; esto se ve en vivo en la HU 12. **(criterio 3)**

### HU 11 · Ordenamiento de resultados · ~0:40

1. Dejar puesto el filtro de **Facultad de Ingeniería** para que se vea que el
   orden no lo borra.
2. En **Ordenar resultados**, elegir **Mejor calificación** → Ana (5.0),
   Diego (4.0), Sofía (sin calificaciones). **(criterio 2)**
3. **Menor tarifa** → Ana ($ 45.000), Sofía ($ 50.000), Diego ($ 60.000).
4. **Disponibilidad más cercana** → Sofía (2:00 P.M.), Ana (3:00 P.M.),
   Diego (5:00 P.M.). **(criterio 3)**
5. Señalar que el filtro de facultad sigue aplicado después de los tres cambios. **(criterio 1)**

### HU 3 · Perfil público del tutor · ~0:40

1. Pulsar la tarjeta de **Ana María Torres** (la tarjeta completa es el botón
   *Ver el perfil de Ana María Torres*).
2. Recorrer: insignia **Verificado** junto al nombre, presentación, experiencia
   **4 años**, **$ 45.000 COP / hora** y, en *Modalidades ofrecidas*,
   **Virtual** y **Virtual o presencial**. **(criterio 1)**
3. Arriba, **5.0 (1 reseñas)**. **(criterio 2)**
4. En **Materias verificadas** aparecen solo SIS201, SIS301 y SIS401. Ana
   también tiene Cálculo I registrada, pero está **pendiente** y por eso no se
   publica. **(criterio 3)**

### HU 10 · Reseñas verificadas · ~0:30

En el mismo perfil, bajar a **Reseñas verificadas**:

1. La reseña viene de una sesión real y completada de **Estructuras de Datos**. **(criterio 1)**
2. Muestra **5 estrellas, la materia y el 3 de noviembre de 2026**, y ningún
   dato del estudiante: las reseñas se publican anónimas. **(criterio 2)**
3. Volver con **Tutores** y abrir el perfil de **Sofía Valentina Gómez**: dice
   "Perfil nuevo · sin reseñas aún" y **Sin calificación**, sin inventar
   métricas. **(criterio 3)**

### HU 5 · Consulta de disponibilidad · ~0:40

1. Volver al perfil de **Ana María Torres** y pulsar **Ver horarios
   disponibles** (*Paso 1 de 2*).
2. En el calendario de noviembre solo los días con franjas **futuras y libres**
   se pueden pulsar. La sesión de Ana del 30 de octubre y las franjas ya
   reservadas no aparecen. **(criterio 1)**
3. Señalar el pie: **"Actualizado a las …"** y el botón **Actualizar**. La lista
   se recarga sola cada 15 s, así que nunca se reserva sobre un horario que otra
   persona acaba de tomar.
4. Elegir la franja **3:00 P.M. - 4:00 P.M. · Virtual** y **Continuar**.
   Anunciar que al terminar la reserva esa franja desaparece — se comprueba al
   final de la HU 7. **(criterio 2)**
5. El tercer criterio (el tutor cambia su agenda) se demuestra en la HU 12. **(criterio 3)**

### HU 7 · Creación de una reserva · ~1:00

Se está en *Paso 2 de 2 · Detalles de tu reserva*.

1. Pulsar **Confirmar reserva · $ 49.500** sin llenar nada → sale el aviso
   **"Faltan datos por completar"** con la lista (materia, tema, aceptación de
   términos) y cada campo marcado con "Este campo es obligatorio". **(criterio 3)**
2. Llenar: materia **Bases de Datos**, tema
   `Preparación del parcial de normalización`, y en detalles
   `Quiero repasar formas normales y consultas con JOIN`. La fecha, la hora y la
   modalidad vienen de la franja — el recuadro dice *"Este horario solo está
   disponible en esta modalidad"*. **(criterio 1)**
3. Recorrer el **desglose del costo**: $ 45.000 de sesión, 10 % de comisión
   ($ 4.500) y total $ 49.500. Decir en voz alta que **el pago es simulado y no
   se piden datos bancarios**.
4. Marcar la aceptación de términos y **Confirmar reserva · $ 49.500**
   → "¡Solicitud enviada!" con el estado **Pendiente de respuesta**. **(criterio 2)**
5. **Volver al inicio** y abrir otra vez los horarios de Ana: **la franja de las
   3:00 P.M. ya no está**, solo queda la del 8 de noviembre. Esto cierra el
   criterio 2 de la HU 5.

### HU 8 · Calificación posterior a una sesión · ~0:50

1. Pestaña **Calificaciones**. Arriba: 1 por calificar, 1 calificada, 2 completadas.
2. En **Pendientes por calificar** está Cálculo I con Sofía Valentina Gómez. **(criterio 1)**
3. Pulsar **Calificar sesión** y enviar sin estrellas → la pantalla exige una
   calificación de 1 a 5.
4. Poner **5 estrellas**, comentario `Explicó los límites con ejemplos claros` y
   enviar → el mensaje confirma el **nuevo promedio de la tutora**. **(criterio 4)**
5. La sesión pasa a **Ya calificadas** y no admite una segunda reseña. **(criterio 3)**
6. Señalar que solo aparecen las sesiones **completadas** de esta estudiante: no
   hay forma de calificar a un tutor con el que no hubo sesión. **(criterio 2)**

### HU 9 · Postulación como tutor · ~0:50

Hacerlo después de la HU 8: la postulación cambia el estado de la cuenta.

1. Pestaña **Postularme**. El programa ya viene del perfil académico
   (SIS · Ingeniería de Sistemas) y la lista de materias usa ese pensum.
2. Llenar código de estudiante `20231001`, semestre `7`, presentación corta,
   años de experiencia `2`, tarifa `40000`, modalidad **Virtual**. **(criterio 1)**
3. En **Buscar en el catálogo** escribir `Redes neuronales` → la pantalla
   responde *«Redes neuronales» no pertenece al catálogo oficial. El sistema no
   permite su registro.* **(criterio 3)**
4. Borrar y escribir `SIS201`, **Agregar**, y pegar el enlace de evidencia
   `https://example.com/evidencias/demo-sis201.pdf`. Señalar que sin ese enlace
   (o sin la nota y el semestre) la materia no se puede registrar. **(criterio 2)**
5. **Enviar postulación** → queda pendiente de revisión del administrador.
6. *Opcional, +0:30:* cerrar sesión, entrar como `admin@universidad.edu.co` y
   mostrar la postulación en la lista de pendientes.

### HU 12 · Configuración del perfil de tutor · ~1:10

1. Cerrar sesión y entrar como `ana.tutor@universidad.edu.co`. Cae en
   **Mis sesiones**.
2. Pestaña **Mi oferta**. Se ve la insignia **Tutor verificado**.
3. Editar la **biografía**, subir la **tarifa** a `50000`, activar **Presencial**
   y **Guardar perfil**. **(criterio 1)**
4. Señalar las materias que ya tiene: SIS201, SIS301 y SIS401 **Verificadas** y
   Cálculo I **Pendiente** — esa última no se publica en su perfil.
5. En **Buscar en el catálogo oficial** escribir `IND201`, pulsar **Buscar
   materias**, pegar el enlace de evidencia y **Agregar** *Estadística
   Aplicada* → entra como **Pendiente**, no como verificada. Las materias que ya
   tiene salen con el botón **Agregar** deshabilitado. **(criterio 2)**
6. Antes de tocar la agenda, abrir una **ventana de incógnito** en
   `http://localhost:5173`, entrar como `estudiante@universidad.edu.co` y
   dejarla en **Reservar**. Hace falta otra ventana porque el navegador guarda
   una sola sesión por origen. Acomodar las dos ventanas lado a lado.
7. En la ventana de Ana, sección **Disponibilidad**, **Retirar** la franja del
   8 de noviembre: era la única libre que quedaba.
   → En la ventana de la estudiante, a los pocos segundos la tarjeta de Ana dice
   **Sin disponibilidad**. *Cierra el criterio 3 de la HU 6.*
8. Ahora **Agregar horario** para mañana en modalidad **Virtual**, a una hora
   que no choque con las que ya tiene (las de las 3:00 P.M. están ocupadas).
   → La tarjeta de Ana vuelve a mostrar disponibilidad y la franja nueva aparece
   en su calendario, sin recargar nada: la pantalla se refresca cada 15 s.
   *Cierra el criterio 3 de la HU 5.*
9. Abrir el perfil de Ana en la ventana de la estudiante: muestra la **tarifa y
   la biografía nuevas**. **(criterio 3)**

### Cierre · ~0:20

Mostrar los números de las pruebas, que respaldan lo que se acabó de ver:

```bash
cd back && npm test -- --runInBand && npm run test:e2e
```

```bash
cd front && npm test
```

46 pruebas unitarias y 14 e2e en el backend, 67 en el frontend.

---

## 4. Versión corta (2 minutos)

Para una diapositiva suelta, grabar solo esto en un clip continuo:

1. Login como estudiante. *(HU 1)*
2. Filtros facultad → programa → materia → profesor y resultado de 2 tutores. *(HU 4, HU 6)*
3. Orden por mejor calificación. *(HU 11)*
4. Perfil de Ana con insignia y reseña con fecha. *(HU 3, HU 10)*
5. Reservar una franja y confirmar. *(HU 5, HU 7)*
6. Calificar la sesión pendiente. *(HU 8)*

HU 2, 9 y 12 quedan en capturas de pantalla fijas.

---

## 5. Al terminar

En `back/.env`, volver a poner `EXPOSE_DEV_CODES=false`.

Para repetir la grabación conviene vaciar la base y volver a sembrarla. El
seed escribe encima de sus propios registros, pero **no borra** lo que se creó
durante la demo: la cuenta `demo.sprint1@universidad.edu.co` de la HU 2, la
reserva de la HU 7 y la postulación de la HU 9 se quedan ahí.

```bash
cd back && docker compose down -v && docker compose up -d postgres && npx prisma migrate deploy && npm run prisma:seed && npm run demo:pending-review
```

Si solo hace falta recuperar los horarios y las calificaciones entre dos tomas,
basta con:

```bash
cd back && npm run prisma:seed && npm run demo:pending-review
```

---

## 6. Si algo falla durante la grabación

| Síntoma | Qué hacer |
| --- | --- |
| "No se pudo conectar con el servidor" en el login | La API todavía está compilando. Esperar a que `http://localhost:3000/api/v1/health` responda `200`. |
| **Pendientes por calificar** sale vacío | Falta `npm run demo:pending-review`. |
| El código de verificación no aparece en pantalla | `EXPOSE_DEV_CODES=true` en `back/.env` y reiniciar la API. El código también queda en el log. |
| `429 RATE_LIMITED` al repetir el login | El login admite 10 intentos por minuto. Esperar un minuto; graba los intentos fallidos de la HU 1 de una sola toma. |
| `401 TOKEN_REVOKED` | Cerrar sesión invalida los tokens anteriores. Volver a entrar. |
| No quedan franjas libres para reservar | `npm run prisma:seed` las restablece. |
| `P1000: Authentication failed` al migrar | Otro PostgreSQL ocupa el 5432. Poner `POSTGRES_PORT=5433` en `back/.env` y el mismo puerto en `DATABASE_URL`. |
| El puerto 5173 está bloqueado en Windows | `npm run dev -- --port 3001` en `front/`. |

Más detalles en [`README.md`](../README.md) y [`front/README.md`](../front/README.md).
