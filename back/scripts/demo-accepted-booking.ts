/*
 * Deja una reserva aceptada por el tutor y sin pagar, para poder probar y
 * grabar el pago simulado del estudiante.
 *
 * El seed solo crea reservas COMPLETED y CONFIRMED, asi que la pantalla de
 * pagos aparece sin nada por confirmar: `POST /bookings/:id/payment` exige una
 * reserva en ACCEPTED, y hoy aceptar solicitudes no tiene pantalla de tutor.
 *
 * Reserva a Maria con Ana en la franja libre de Ana (`anaLater`), la deja en
 * ACCEPTED y borra cualquier pago que tuviera, para que el flujo se pueda
 * repetir cuantas veces haga falta.
 *
 * Es idempotente: correrlo dos veces deja el mismo estado. Para volver atras,
 * `npm run prisma:seed`.
 *
 * Uso: npm run demo:accepted-booking
 */
// `prisma db seed` carga el .env por su cuenta; un script suelto no, y sin
// DATABASE_URL el adaptador falla con un error de contrasena poco claro.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { BookingStatus, Modality, PrismaClient, SlotStatus } from '@prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' }),
});

const BOOKING_ID = '70000000-0000-4000-8000-000000000005';
const STUDENT_USER_ID = '00000000-0000-4000-8000-000000000101';
const TUTOR_USER_ID = '00000000-0000-4000-8000-000000000201';
const TUTOR_PROFILE_ID = '50000000-0000-4000-8000-000000000001';
const SUBJECT_ID = '30000000-0000-4000-8000-000000000001';
const SLOT_ID = 'a0000000-0000-4000-8000-000000000004';

const FEE_PERCENT = Number.parseFloat(process.env.PLATFORM_FEE_PERCENT ?? '10');

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function main(): Promise<void> {
  const [slot, profile] = await Promise.all([
    prisma.availabilitySlot.findUnique({ where: { id: SLOT_ID } }),
    prisma.tutorProfile.findUnique({
      where: { id: TUTOR_PROFILE_ID },
      include: { user: { select: { fullName: true } } },
    }),
  ]);

  if (!slot || !profile) {
    throw new Error('No existen los datos demo. Corre primero `npm run prisma:seed`.');
  }

  const durationMinutes = Math.round((slot.endAt.getTime() - slot.startAt.getTime()) / 60_000);
  const hourlyRate = profile.hourlyRate.toNumber();
  const subtotal = round((hourlyRate * durationMinutes) / 60);
  const platformFee = round((subtotal * FEE_PERCENT) / 100);
  const total = round(subtotal + platformFee);

  const booking = await prisma.$transaction(async (tx) => {
    // Un pago anterior dejaria la reserva como ya cobrada.
    await tx.payment.deleteMany({ where: { bookingId: BOOKING_ID } });

    await tx.availabilitySlot.update({
      where: { id: SLOT_ID },
      data: { status: SlotStatus.RESERVED, heldUntil: null },
    });

    const data = {
      studentId: STUDENT_USER_ID,
      tutorId: TUTOR_USER_ID,
      subjectId: SUBJECT_ID,
      slotId: SLOT_ID,
      topic: 'Repaso de grafos antes del parcial',
      description: 'Recorridos BFS y DFS, y rutas minimas.',
      modality: Modality.VIRTUAL,
      startAt: slot.startAt,
      endAt: slot.endAt,
      status: BookingStatus.ACCEPTED,
      hourlyRate,
      durationMinutes,
      subtotal,
      platformFee,
      total,
      isEmergency: false,
      cancellationReason: null,
      cancelledAt: null,
      completedAt: null,
    };

    return tx.booking.upsert({
      where: { id: BOOKING_ID },
      update: data,
      create: { id: BOOKING_ID, ...data },
      include: { subject: true },
    });
  });

  console.log(
    `Reserva "${booking.topic}" (${booking.subject.name}) con ${profile.user.fullName} en estado ACCEPTED.`,
  );
  console.log(
    `Tarifa ${hourlyRate} COP/hora · ${durationMinutes} min · comision ${FEE_PERCENT}% (${platformFee}) · total ${total} COP.`,
  );
  console.log(
    'Entra como estudiante@universidad.edu.co y abre Pagos: la sesion espera el pago simulado.',
  );
}

main()
  .catch((error) => {
    console.error('Error preparando los datos de la demo:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
