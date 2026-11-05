import assert from 'node:assert/strict';

const baseUrl = process.env.API_URL ?? 'http://localhost:3000/api/v1';
const password = process.env.DEMO_PASSWORD ?? 'TutorLink123*';

async function api(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(
      `${options.method ?? 'GET'} ${path} -> ${response.status}: ${JSON.stringify(body.error ?? body)}`,
    );
  }

  return body.data;
}

async function login(email) {
  return api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

function bearer(token) {
  return { authorization: `Bearer ${token}` };
}

/** Llama la API esperando un fallo concreto, sin que el helper `api` lo lance. */
async function expectError(path, options, status, code) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json();

  assert.equal(response.status, status, `${path} deberia responder ${status}`);
  assert.equal(body.success, false);
  assert.equal(body.error.code, code, `${path} deberia fallar con ${code}`);

  return body.error;
}

/**
 * Registro con correo institucional, verificacion, inicio y cierre de sesion.
 *
 * La parte de verificacion necesita EXPOSE_DEV_CODES=true, porque el codigo
 * llega por correo y el smoke test no lee buzones; sin la bandera se salta esa
 * mitad y avisa.
 */
async function authFlow() {
  const external = await expectError(
    '/auth/register',
    {
      method: 'POST',
      body: JSON.stringify({
        email: 'smoke@gmail.com',
        password,
        fullName: 'Correo Externo',
      }),
    },
    400,
    'NON_INSTITUTIONAL_EMAIL',
  );
  assert.match(external.message, /universidad/i, 'El error debe informar el formato aceptado');
  console.log('OK registro rechaza correo no institucional');

  const email = `smoke.${Date.now()}@universidad.edu.co`;
  const pending = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, fullName: 'Smoke Test' }),
  });
  assert.equal(pending.verificationRequired, true);
  assert.equal(pending.user, undefined, 'El registro no debe devolver datos de la cuenta');
  console.log(`OK registro de ${email}`);

  await expectError(
    '/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
    403,
    'EMAIL_NOT_VERIFIED',
  );
  console.log('OK login bloqueado antes de verificar');

  if (!pending.devVerificationCode) {
    console.log('SKIP verificacion: enciende EXPOSE_DEV_CODES=true para probarla');
    return;
  }

  await expectError(
    '/auth/verify-email',
    { method: 'POST', body: JSON.stringify({ email, code: '000000' }) },
    400,
    'INVALID_VERIFICATION_CODE',
  );

  const verified = await api('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ email, code: pending.devVerificationCode }),
  });
  assert.equal(verified.verified, true);
  assert.equal(verified.user.status, 'ACTIVE');
  console.log('OK cuenta verificada con el codigo');

  const invalid = await expectError(
    '/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password: 'NoEsLaClave1' }) },
    401,
    'INVALID_CREDENTIALS',
  );
  assert.equal(invalid.details?.length ?? 0, 0, 'El error de credenciales no debe dar detalles');
  console.log('OK error de credenciales uniforme');

  const session = await login(email);
  assert.equal(session.user.role, 'STUDENT');
  const profile = await api('/auth/me', { headers: bearer(session.accessToken) });
  assert.equal(profile.email, email);

  const loggedOut = await api('/auth/logout', {
    method: 'POST',
    headers: bearer(session.accessToken),
  });
  assert.equal(loggedOut.loggedOut, true);

  // El access token deja de valer de inmediato, sin esperar a que expire.
  await expectError('/auth/me', { headers: bearer(session.accessToken) }, 401, 'TOKEN_REVOKED');
  console.log('OK cierre de sesion invalida el access token');
}

async function main() {
  console.log(`Smoke test contra ${baseUrl}`);

  const health = await api('/health');
  assert.equal(health.status, 'ok');
  assert.equal(health.database, 'up');
  console.log('OK health');

  const student = await login('estudiante@universidad.edu.co');
  const admin = await login('admin@universidad.edu.co');
  assert.equal(student.user.role, 'STUDENT');
  assert.equal(admin.user.role, 'ADMIN');
  console.log('OK login estudiante/admin');

  const tutorAccounts = await Promise.all(
    [
      'ana.tutor@universidad.edu.co',
      'diego.tutor@universidad.edu.co',
      'sofia.tutor@universidad.edu.co',
    ].map((email) => login(email)),
  );

  const subjects = await api('/catalog/subjects?search=SIS201');
  assert.ok(subjects.length > 0, 'La materia SIS201 debe existir');
  const subject = subjects[0];
  const professor = subject.subjectProfessors[0]?.professor ?? null;

  const tutors = await api(
    `/tutors?subjectId=${subject.id}&modality=VIRTUAL&sortBy=AVAILABILITY`,
  );
  assert.ok(tutors.items.length > 0, 'Debe haber tutores para SIS201');
  console.log(`OK catalogo y busqueda (${tutors.items.length} tutores)`);

  const now = Date.now();
  const studyMatch = await api('/studymatch/requests', {
    method: 'POST',
    headers: bearer(student.accessToken),
    body: JSON.stringify({
      subjectId: subject.id,
      professorId: professor?.id,
      topic: 'Smoke test de estructuras de datos',
      description: 'Validacion automatizada del flujo StudyMatch',
      urgency: 'CRITICAL',
      modality: 'VIRTUAL',
      availableFrom: new Date(now).toISOString(),
      availableTo: new Date(now + 7 * 24 * 3_600_000).toISOString(),
    }),
  });

  assert.ok(studyMatch.proposal, 'StudyMatch debe asignar una propuesta');
  assert.equal(studyMatch.request.status, 'PROPOSAL_SENT');
  const proposal = studyMatch.proposal;
  console.log(`OK StudyMatch propuesta a ${proposal.tutor.fullName}`);

  const assignedTutor = tutorAccounts.find(
    (account) => account.user.id === proposal.tutor.userId,
  );
  assert.ok(assignedTutor, 'El tutor propuesto debe ser una cuenta demo');

  const pending = await api('/studymatch/proposals/pending', {
    headers: bearer(assignedTutor.accessToken),
  });
  assert.ok(
    pending.items.some((item) => item.id === proposal.id),
    'La propuesta debe aparecer en la bandeja del tutor',
  );

  const accepted = await api(`/studymatch/proposals/${proposal.id}/respond`, {
    method: 'POST',
    headers: bearer(assignedTutor.accessToken),
    body: JSON.stringify({ action: 'ACCEPT' }),
  });
  assert.equal(accepted.proposal.status, 'TUTOR_ACCEPTED');
  assert.equal(accepted.booking.status, 'ACCEPTED');
  console.log('OK tutor acepta propuesta');

  const confirmed = await api(`/studymatch/proposals/${proposal.id}/confirm`, {
    method: 'POST',
    headers: bearer(student.accessToken),
    body: JSON.stringify({ accept: true, simulatePayment: true }),
  });
  assert.equal(confirmed.proposal.status, 'CONFIRMED');
  assert.equal(confirmed.booking.status, 'CONFIRMED');
  assert.equal(confirmed.payment.status, 'APPROVED');
  assert.equal(confirmed.booking.payment.status, 'APPROVED');
  console.log('OK estudiante confirma y pago simulado aprobado');

  const otherTutor = tutors.items.find((item) => item.id !== proposal.tutor.profileId) ??
    tutors.items[0];
  const slots = await api(`/tutors/${otherTutor.id}/availability`);
  assert.ok(slots.length > 0, 'El tutor debe tener disponibilidad');

  const cancellableSlot =
    slots.find(
      (slot) => new Date(slot.startAt).getTime() > Date.now() + 26 * 3_600_000,
    ) ?? slots[0];
  const booking = await api('/bookings', {
    method: 'POST',
    headers: bearer(student.accessToken),
    body: JSON.stringify({
      tutorProfileId: otherTutor.id,
      slotId: cancellableSlot.id,
      subjectId: subject.id,
      topic: 'Smoke test de reserva directa',
      modality: cancellableSlot.modality === 'IN_PERSON' ? 'IN_PERSON' : 'VIRTUAL',
      description: 'Validacion del flujo de reserva tradicional',
    }),
  });
  assert.equal(booking.booking.status, 'PENDING');
  console.log('OK reserva directa creada');

  const bookingTutor = tutorAccounts.find(
    (account) => account.user.id === otherTutor.userId,
  );
  assert.ok(bookingTutor, 'El tutor de la reserva debe ser una cuenta demo');

  const bookingAccepted = await api(`/bookings/${booking.booking.id}/accept`, {
    method: 'POST',
    headers: bearer(bookingTutor.accessToken),
  });
  assert.equal(bookingAccepted.booking.status, 'ACCEPTED');

  const paid = await api(`/bookings/${booking.booking.id}/payment`, {
    method: 'POST',
    headers: bearer(student.accessToken),
    body: JSON.stringify({ simulatePayment: true }),
  });
  assert.equal(paid.booking.status, 'CONFIRMED');
  assert.equal(paid.payment.status, 'APPROVED');
  assert.equal(paid.booking.payment.status, 'APPROVED');
  console.log('OK reserva directa aceptada y pagada');

  if (new Date(cancellableSlot.startAt).getTime() > Date.now() + 24 * 3_600_000) {
    const cancelled = await api(`/bookings/${booking.booking.id}/cancel`, {
      method: 'POST',
      headers: bearer(student.accessToken),
      body: JSON.stringify({ reason: 'Cancelacion del smoke test' }),
    });
    assert.equal(cancelled.booking.status, 'CANCELLED');
    assert.equal(cancelled.booking.payment.status, 'REFUNDED');
    console.log('OK cancelacion y reembolso simulado');
  }

  const stats = await api('/admin/stats', {
    headers: bearer(admin.accessToken),
  });
  assert.ok(stats.users.students > 0);
  assert.ok(stats.bookings.completed > 0);
  console.log('OK metricas de administrador');

  const notifications = await api('/notifications?limit=5', {
    headers: bearer(student.accessToken),
  });
  assert.ok(Array.isArray(notifications.items));
  console.log(`OK notificaciones (${notifications.items.length})`);

  const refreshed = await api('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: student.refreshToken }),
  });
  assert.ok(refreshed.accessToken);
  const me = await api('/auth/me', { headers: bearer(refreshed.accessToken) });
  assert.equal(me.id, student.user.id);
  console.log('OK refresh token y /auth/me');

  await authFlow();

  const openapi = await fetch('http://localhost:3000/docs-json').then((response) =>
    response.json(),
  );
  assert.ok(Object.keys(openapi.paths).length > 0);
  console.log(`OK OpenAPI (${Object.keys(openapi.paths).length} rutas)`);

  console.log('Smoke test completado correctamente.');
}

main().catch((error) => {
  console.error('Smoke test fallido:', error);
  process.exitCode = 1;
});
