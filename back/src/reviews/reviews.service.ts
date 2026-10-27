import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { roundMoney } from '../common/utils/money';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/reviews.dto';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(user: AuthenticatedUser, bookingId: string, dto: CreateReviewDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { subject: true, review: true },
    });

    if (!booking || booking.studentId !== user.id) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: 'La reserva no existe',
      });
    }

    if (booking.status !== BookingStatus.COMPLETED) {
      throw new ForbiddenException({
        code: 'BOOKING_NOT_COMPLETED',
        message: 'Solo puedes calificar una sesion completada',
      });
    }

    if (booking.review) {
      throw new ConflictException({
        code: 'REVIEW_ALREADY_EXISTS',
        message: 'Ya calificaste esta reserva',
      });
    }

    const { review, aggregate } = await this.prisma.$transaction(async (tx) => {
      const createdReview = await tx.review.create({
        data: {
          bookingId: booking.id,
          studentId: user.id,
          tutorId: booking.tutorId,
          rating: dto.rating,
          comment: dto.comment,
          isAnonymous: dto.isAnonymous ?? true,
        },
      });

      const reviewAggregate = await tx.review.aggregate({
        where: { tutorId: booking.tutorId },
        _avg: { rating: true },
        _count: { _all: true },
      });

      await tx.tutorProfile.update({
        where: { userId: booking.tutorId },
        data: {
          averageRating: reviewAggregate._avg.rating ?? 0,
          reviewCount: reviewAggregate._count._all,
        },
      });

      return { review: createdReview, aggregate: reviewAggregate };
    });

    await this.notifications.create({
      userId: booking.tutorId,
      type: 'REVIEW_RECEIVED',
      title: 'Nueva resena recibida',
      message: `Recibiste una calificacion de ${dto.rating} estrellas en ${booking.subject.name}.`,
      data: {
        reviewId: review.id,
        bookingId: booking.id,
        rating: review.rating,
        isAnonymous: review.isAnonymous,
      },
    });

    return {
      review: {
        id: review.id,
        bookingId: review.bookingId,
        rating: review.rating,
        comment: review.comment,
        isAnonymous: review.isAnonymous,
        createdAt: review.createdAt,
      },
      tutorRating: {
        averageRating: roundMoney(aggregate._avg.rating ?? 0),
        reviewCount: aggregate._count._all,
      },
      message: 'Resena registrada. El promedio del tutor fue actualizado.',
    };
  }
}
