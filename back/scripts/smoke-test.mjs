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
