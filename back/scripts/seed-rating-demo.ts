import { BookingStatus, Modality, PaymentStatus, PaymentType, PrismaClient, SlotStatus } from '@prisma/client';

const prisma = new PrismaClient();

const IDS = {
  student: '00000000-0000-4000-8000-000000000102',
  tutor: '00000000-0000-4000-8000-000000000202',
  tutorProfile: '50000000-0000-4000-8000-000000000002',
  subject: '30000000-0000-4000-8000-000000000002',
  slot: 'a0000000-0000-4000-8000-000000000091',
  booking: '70000000-0000-4000-8000-000000000091',
  payment: '80000000-0000-4000-8000-000000000091',
} as const;

async function main(): Promise<void> {
  const now = new Date();
  const startAt = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  startAt.setMinutes(0, 0, 0);
  const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);

  await prisma.availabilitySlot.upsert({
    where: { id: IDS.slot },
    update: {
      tutorId: IDS.tutorProfile,
      startAt,
      endAt,
      modality: Modality.VIRTUAL,
      status: SlotStatus.RESERVED,
      heldUntil: null,
    },
    create: {
      id: IDS.slot,
      tutorId: IDS.tutorProfile,
      startAt,
      endAt,
      modality: Modality.VIRTUAL,
      status: SlotStatus.RESERVED,
    },
  });

  await prisma.booking.upsert({
    where: { id: IDS.booking },
    update: {
      studentId: IDS.student,
      tutorId: IDS.tutor,
      subjectId: IDS.subject,
      slotId: IDS.slot,
      requestId: null,
      proposalId: null,
      topic: 'Repaso de normalización y consultas SQL',
      description:
        'Sesión demo de la HU SCRUM-17, completada y pendiente de calificación.',
      modality: Modality.VIRTUAL,
      startAt,
      endAt,
      status: BookingStatus.COMPLETED,
      hourlyRate: 60_000,
      durationMinutes: 60,
      subtotal: 60_000,
      platformFee: 6_000,
      total: 66_000,
      isEmergency: false,
      cancellationReason: null,
      cancelledAt: null,
      completedAt: endAt,
    },
    create: {
      id: IDS.booking,
      studentId: IDS.student,
      tutorId: IDS.tutor,
      subjectId: IDS.subject,
      slotId: IDS.slot,
      topic: 'Repaso de normalización y consultas SQL',
      description:
        'Sesión demo de la HU SCRUM-17, completada y pendiente de calificación.',
      modality: Modality.VIRTUAL,
      startAt,
      endAt,
      status: BookingStatus.COMPLETED,
      hourlyRate: 60_000,
      durationMinutes: 60,
      subtotal: 60_000,
      platformFee: 6_000,
      total: 66_000,
      isEmergency: false,
      completedAt: endAt,
    },
  });

  await prisma.payment.upsert({
    where: { id: IDS.payment },
    update: {
      bookingId: IDS.booking,
      studentId: IDS.student,
      tutorId: IDS.tutor,
      amount: 66_000,
      platformFee: 6_000,
      tutorEarnings: 60_000,
      currency: 'COP',
      type: PaymentType.SIMULATED,
      status: PaymentStatus.APPROVED,
      reference: 'SIM-SEED-RATING-DEMO-001',
      simulated: true,
      paidAt: startAt,
      refundedAt: null,
    },
    create: {
      id: IDS.payment,
      bookingId: IDS.booking,
      studentId: IDS.student,
      tutorId: IDS.tutor,
      amount: 66_000,
      platformFee: 6_000,
      tutorEarnings: 60_000,
      currency: 'COP',
      type: PaymentType.SIMULATED,
      status: PaymentStatus.APPROVED,
      reference: 'SIM-SEED-RATING-DEMO-001',
      simulated: true,
      paidAt: startAt,
    },
  });

  const deleted = await prisma.review.deleteMany({ where: { bookingId: IDS.booking } });
  const aggregate = await prisma.review.aggregate({
    where: { tutorId: IDS.tutor },
    _avg: { rating: true },
    _count: { _all: true },
  });

  await prisma.tutorProfile.update({
    where: { userId: IDS.tutor },
    data: {
      averageRating: aggregate._avg.rating ?? 0,
      reviewCount: aggregate._count._all,
    },
  });

  console.log(
    `Demo SCRUM-17 lista: reserva ${IDS.booking} completada y pendiente de calificación.`,
  );
  console.log(
    `Reseñas previas eliminadas para esta reserva demo: ${deleted.count}.`,
  );
  console.log('Ingresa con juan.estudiante@estudiantes.universidad.edu.co / TutorLink123*.');
}

main()
  .catch((error) => {
    console.error('No fue posible preparar la demo de calificaciones:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
