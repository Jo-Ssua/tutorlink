/*
 * Deja una sesion completada sin calificar para poder grabar la HU 8.
 *
 * El seed general califica las tres sesiones completadas, asi que la pestana
 * "Pendientes por calificar" aparece vacia. Este script borra la resena de la
 * sesion de Maria con Sofia y recalcula el promedio de Sofia igual que lo hace
 * `reviews.service.ts`, para que el perfil publico no quede con numeros que ya
 * no corresponden a ninguna resena.
 *
 * Es idempotente: correrlo dos veces deja el mismo estado. Para volver atras,
 * `npm run prisma:seed`.
 *
 * Uso: npm run demo:pending-review
 */
// `prisma db seed` carga el .env por su cuenta; un script suelto no, y sin
// DATABASE_URL el adaptador falla con un error de contrasena poco claro.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' }),
});

const BOOKING_ID = '70000000-0000-4000-8000-000000000004';
const TUTOR_USER_ID = '00000000-0000-4000-8000-000000000203';

async function main(): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: BOOKING_ID },
    include: { review: true, subject: true },
  });

  if (!booking) {
    throw new Error(
      'No existe la reserva demo. Corre primero `npm run prisma:seed`.',
    );
  }

  const aggregate = await prisma.$transaction(async (tx) => {
    if (booking.review) {
      await tx.review.delete({ where: { bookingId: BOOKING_ID } });
    }

    const recalculated = await tx.review.aggregate({
      where: { tutorId: TUTOR_USER_ID },
      _avg: { rating: true },
      _count: { _all: true },
    });

    await tx.tutorProfile.update({
      where: { userId: TUTOR_USER_ID },
      data: {
        averageRating: recalculated._avg.rating ?? 0,
        reviewCount: recalculated._count._all,
      },
    });

    return recalculated;
  });

  console.log(
    booking.review
      ? `Resena eliminada de la sesion "${booking.topic}" (${booking.subject.name}).`
      : `La sesion "${booking.topic}" ya estaba sin calificar.`,
  );
  console.log(
    `Sofia Valentina Gomez queda con ${aggregate._count._all} resenas y promedio ${aggregate._avg.rating ?? 0}.`,
  );
  console.log(
    'Entra como estudiante@universidad.edu.co y abre Calificaciones: la sesion de Calculo I esta pendiente.',
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
