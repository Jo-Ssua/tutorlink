# Plan de desarrollo · Sprint 2

Dos historias de usuario, una rama por HU, ambas salen de `dev`.

| HU | Rama | Backend | Frontend |
|----|------|---------|----------|
| Aprobación de tutor | `feature/tutor-approval` | ya existe (verificar + tests) | pantalla nueva |
| Transparencia de tarifa y pago simulado | `feature/price-transparency` | ya existe (verificar + tests) | pantalla nueva + ajustes al flujo |

## 0. Hallazgo que condiciona el plan

Los dos endpoints centrales **ya están implementados** en el Sprint 1:

- `GET /admin/tutor-applications`, `PATCH /admin/tutor-applications/:id/approve`,
  `PATCH /admin/tutor-applications/:id/reject` → `back/src/admin/admin.service.ts`
- `POST /bookings/quote`, `POST /bookings/:id/payment` → `back/src/bookings/bookings.service.ts`

Lo que falta es **interfaz**: `AdminHome.tsx` es de solo lectura (su propio comentario lo dice) y
el estudiante no tiene ninguna pantalla donde confirmar el pago simulado de una reserva aceptada.

Por eso el trabajo de ambas HU es ~75 % frontend + tests, y en backend solo cierre de huecos y
pruebas unitarias que respalden los criterios de aceptación.

### Dependencia a resolver en HU2

`POST /bookings/:id/payment` exige que la reserva esté en `ACCEPTED`, y **el tutor no tiene botón
para aceptar reservas** (`TutorHome.tsx` solo acepta propuestas de StudyMatch; las reservas se
listan de solo lectura). Aceptar/rechazar solicitudes es otra HU, no las mías. Opciones:

- **(a) Recomendada:** script `npm run demo:accepted-booking` en `back/scripts/`, igual al
  existente `demo:pending-review`, que deja una reserva en `ACCEPTED` para probar y grabar. Costo: ~30 min, cero deuda en código de producción.
- (b) Agregar los botones aceptar/rechazar en `TutorHome` → invade la HU de otra persona.
- (c) Aceptar por `curl`/Swagger durante la demo → frágil en video.

Voy con (a) salvo que me digas otra cosa.

---

## HU1 · `feature/tutor-approval`

### Backend (cierre + pruebas)

1. Verificar contra los criterios lo que ya devuelve `listTutorApplications`: correo
   institucional, materias declaradas (código, nombre, nota, semestre aprobado) y soportes
   (`evidenceUrl`), más profesores, bio, tarifa y modalidades. No requiere cambios previstos.
2. `admin.service.spec.ts` (nuevo, mock de Prisma al estilo de `bookings.service.spec.ts`):
   - aprobar → `user.role = TUTOR`, `tutorProfile.verificationStatus = VERIFIED`, materias a
     `VERIFIED`, notificación `TUTOR_APPLICATION_APPROVED`.
   - conflictos: `TUTOR_ALREADY_VERIFIED`, `APPLICANT_NOT_ACTIVE`, `APPLICATION_WITHOUT_SUBJECTS`.
   - rechazar → `rejectionReason` persistido + notificación `TUTOR_APPLICATION_REJECTED`; motivo
     vacío o de menos de 3 caracteres lo bloquea el DTO.
3. Soportes = URL (`evidenceUrl`). **No** habrá carga de archivos en el MVP; queda escrito.

### Frontend

4. `front/src/api.ts`: `getTutorApplications({ status, search, page })`,
   `approveTutorApplication(id)`, `rejectTutorApplication(id, reason)`.
5. `front/src/types.ts`: completar `TutorApplication` con los campos que ya manda el backend y
   que el tipo omite (`evidenceUrl`, `grade`, `approvedSemester`, `rejectionReason`, `bio`,
   `modalities`, `professors`, `emailVerifiedAt`).
6. Pantalla nueva `front/src/screens/AdminTutorApplications.tsx`:
   - filtro por estado (Pendientes / Aprobadas / Rechazadas) y búsqueda por nombre o correo;
   - ficha por postulante con correo institucional, materias declaradas y enlace al soporte de
     cada materia, bio, tarifa, experiencia y modalidades;
   - **Aprobar** con confirmación; al volver muestra que el usuario quedó con rol tutor verificado;
   - **Rechazar** abre diálogo con motivo obligatorio (3–1000 caracteres, el mismo rango del DTO),
     no deja enviar vacío y avisa que el motivo queda visible para el solicitante;
   - errores de la API con el `FormError`/`LoadError` que ya usa el resto de la app.
7. Ruta `/app/admin/postulaciones` bajo `RoleRoute roles={['ADMIN']}` en `routes.tsx`;
   ítem "Tutores" en `navigation.ts` para ADMIN.
8. `AdminHome.tsx`: el bloque de postulaciones pendientes enlaza a la pantalla nueva y se le
   quita el comentario de "tendrá su propia pantalla".
9. Tests `AdminTutorApplications.test.tsx` (vitest + RTL, como `TutorProfileSettings.test.tsx`):
   pinta correo/materias/soportes; aprobar llama a la API y saca la ficha de la lista; rechazar
   sin motivo no envía; rechazar con motivo manda el texto; error de API visible.

### Verificación

```bash
cd back && npm run lint && npm test
```

```bash
cd front && npm run typecheck && npm test
```

### Commits previstos

1. `test(admin): cover tutor application approval and rejection`
2. `feat(admin): add tutor application review screen`
3. `feat(admin): link pending applications from admin home`

---

## HU2 · `feature/price-transparency`

Sale de `dev` **después** de integrar HU1, porque las dos tocan `api.ts`, `types.ts`,
`routes.tsx` y `navigation.ts` (conflictos pequeños pero evitables).

### Backend (cierre + pruebas)

1. Confirmar que `POST /bookings/quote` ya devuelve tarifa/hora, duración, subtotal, comisión
   (`platformFeePercent` + `platformFee`), total, moneda, `simulated: true` y el aviso de que no
   se procesan datos bancarios reales. Sin cambios previstos.
2. Exponer `platformFeePercent` en el detalle de la reserva (`mapBooking`) si no está: la pantalla
   de pago debe mostrar el % sin volver a cotizar.
3. Casos nuevos en `bookings.service.spec.ts`:
   - `quote` → aritmética del desglose (subtotal por minutos, comisión por porcentaje, total);
   - `confirmPayment` con `simulatePayment: false` → `SIMULATED_PAYMENT_REQUIRED`;
   - reserva fuera de `ACCEPTED` → `BOOKING_NOT_READY_FOR_PAYMENT`;
   - segundo pago → `PAYMENT_ALREADY_CONFIRMED`;
   - pago exitoso → `Payment` con `status APPROVED`, `simulated: true`, referencia y reserva en
     `CONFIRMED`, con notificación a estudiante y tutor.
4. Script `back/scripts/demo-accepted-booking.ts` + `npm run demo:accepted-booking` (ver §0).

### Frontend

5. `front/src/api.ts`: `getMyBookings({ status, page })` y
   `confirmSimulatedPayment(bookingId)` → `POST /bookings/:id/payment` con `simulatePayment: true`.
6. `DetailsScreen.tsx` (paso 2 de la reserva):
   - si la cotización falla, mostrar error con reintento en vez de caer en silencio al subtotal
     calculado en el cliente — un total aproximado sin avisar es justo el costo oculto que la HU
     prohíbe;
   - botón **Cancelar** explícito que sale del flujo sin crear reserva, con el aviso de que no
     quedó nada reservado ni cobrado.
7. Pantalla nueva `front/src/screens/StudentPayments.tsx` ("Pagos", wireframe HU-03):
   - reservas del estudiante agrupadas por estado;
   - en `ACCEPTED`, resumen de pago: tarifa por sesión, duración, comisión simulada con su % y
     total, más el aviso de que no se piden datos bancarios reales;
   - **Confirmar pago simulado** → al volver muestra "pago simulado aprobado", la referencia de la
     transacción y la reserva en `CONFIRMED`;
   - **Cancelar** cierra el resumen sin llamar a la API;
   - en `CONFIRMED`, referencia y estado del pago ya registrado.
8. Ruta `/app/pagos` bajo `RoleRoute roles={['STUDENT']}` + ítem "Pagos" en `navigation.ts`.
9. Tests:
   - `DetailsScreen.test.tsx`: el desglose usa los números de la cotización (no los del cliente);
     fallo de cotización muestra error; cancelar no llama a `createBooking`.
   - `StudentPayments.test.tsx`: una reserva `ACCEPTED` muestra el resumen completo; confirmar
     envía `simulatePayment: true` y pinta "pago simulado aprobado" + referencia; cancelar no
     hace ninguna petición; no se renderiza ningún campo de tarjeta, cuenta o banco.

### Verificación

```bash
cd back && npm run lint && npm test
```

```bash
cd front && npm run typecheck && npm test
```

### Commits previstos

1. `test(bookings): cover quote breakdown and simulated payment`
2. `feat(bookings): expose fee percent in booking detail`
3. `feat(payments): add student simulated payment screen`
4. `feat(bookings): make quote failure and cancel explicit in booking details`
5. `chore(scripts): add demo script for an accepted booking`

---

## Trazabilidad de criterios de aceptación

| Criterio | Dónde queda cubierto |
|----------|----------------------|
| HU1 · consultar correo, materias y soportes | ficha de `AdminTutorApplications` + test |
| HU1 · aprobar ⇒ rol tutor verificado | `approveTutorApplication` + `admin.service.spec.ts` |
| HU1 · rechazar ⇒ motivo visible | diálogo de motivo obligatorio + `TutorApplicationScreen` (ya muestra el motivo) |
| HU2 · resumen con tarifa, duración, cargos y total | desglose de `DetailsScreen` y de `StudentPayments` |
| HU2 · pago confirmado ⇒ "pago simulado aprobado" | `confirmSimulatedPayment` + spec de `confirmPayment` |
| HU2 · cancelar antes de confirmar ⇒ sin reserva ni cobro | botón Cancelar en los dos pasos + tests que verifican que no hay petición |
| HU2 · sin datos bancarios reales | aviso en pantalla + test que exige que no exista campo bancario |

## Orden de trabajo

1. `feature/tutor-approval` desde `dev` → PR a `dev`.
2. Integrar HU1 en `dev`.
3. `feature/price-transparency` desde `dev` actualizado → PR a `dev`.

Commits sin `Co-Authored-By`, según lo acordado.
