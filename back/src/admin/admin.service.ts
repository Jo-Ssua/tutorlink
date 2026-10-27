import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  Prisma,
  Role,
  UserStatus,
  VerificationStatus,
} from '@prisma/client';
import { buildPaginationMeta, getPaginationSkip } from '../common/dto/pagination.dto';
import { money } from '../common/utils/money';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminApplicationsQueryDto,
  AdminSubjectsQueryDto,
  AdminUsersQueryDto,
  RejectTutorApplicationDto,
  RejectTutorSubjectDto,
} from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async listTutorApplications(query: AdminApplicationsQueryDto) {
    const where: Prisma.TutorProfileWhereInput = {
      verificationStatus: query.status,
      ...(query.search
        ? {
            user: {
              OR: [
                { fullName: { contains: query.search, mode: 'insensitive' } },
                { email: { contains: query.search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.tutorProfile.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: getPaginationSkip(query.page, query.limit),
        take: query.limit,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              status: true,
              role: true,
              emailVerifiedAt: true,
            },
          },
          subjects: { include: { subject: true } },
          professors: { include: { professor: true } },
        },
      }),
      this.prisma.tutorProfile.count({ where }),
    ]);

    return {
      items: items.map((profile) => ({
        id: profile.id,
        userId: profile.userId,
        fullName: profile.user.fullName,
        institutionalEmail: profile.user.email,
        userStatus: profile.user.status,
        role: profile.user.role,
        emailVerifiedAt: profile.user.emailVerifiedAt,
        bio: profile.bio,
        experienceYears: profile.experienceYears,
        hourlyRate: money(profile.hourlyRate),
        modalities: profile.modalities,
        verificationStatus: profile.verificationStatus,
        rejectionReason: profile.rejectionReason,
        createdAt: profile.createdAt,
        subjects: profile.subjects.map((link) => ({
          id: link.id,
          status: link.status,
          evidenceUrl: link.evidenceUrl,
          rejectionReason: link.rejectionReason,
          subject: link.subject,
        })),
        professors: profile.professors.map((link) => link.professor),
      })),
      pagination: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async approveTutorApplication(applicationId: string) {
    const profile = await this.prisma.tutorProfile.findUnique({
      where: { id: applicationId },
      include: {
        user: { select: { id: true, fullName: true, email: true, status: true } },
        subjects: true,
      },
    });

    if (!profile) {
      throw new NotFoundException({
        code: 'TUTOR_APPLICATION_NOT_FOUND',
        message: 'La postulacion no existe',
      });
    }

    if (profile.verificationStatus === VerificationStatus.VERIFIED) {
      throw new ConflictException({
        code: 'TUTOR_ALREADY_VERIFIED',
        message: 'La postulacion ya fue aprobada',
      });
    }

    if (profile.user.status !== UserStatus.ACTIVE) {
      throw new ConflictException({
        code: 'APPLICANT_NOT_ACTIVE',
        message: 'El postulante no tiene una cuenta activa',
      });
    }

    if (profile.subjects.length === 0) {
      throw new ConflictException({
        code: 'APPLICATION_WITHOUT_SUBJECTS',
        message: 'La postulacion no tiene materias declaradas',
      });
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: profile.userId },
        data: { role: Role.TUTOR },
      });

      await tx.tutorSubject.updateMany({
        where: { tutorId: profile.id },
        data: {
          status: VerificationStatus.VERIFIED,
          verifiedAt: now,
          rejectionReason: null,
        },
      });

      return tx.tutorProfile.update({
        where: { id: profile.id },
        data: {
          verificationStatus: VerificationStatus.VERIFIED,
          verifiedAt: now,
          rejectionReason: null,
          isActive: true,
        },
        include: {
          user: { select: { id: true, fullName: true, email: true } },
          subjects: { include: { subject: true } },
          professors: { include: { professor: true } },
        },
      });
    });

    await this.notifications.create({
      userId: profile.userId,
      type: 'TUTOR_APPLICATION_APPROVED',
      title: 'Postulacion aprobada',
      message:
        'Tu perfil de tutor fue verificado. Ya puedes configurar disponibilidad y recibir solicitudes.',
      data: { tutorProfileId: profile.id, role: Role.TUTOR },
    });

    return {
      application: {
        id: updated.id,
        userId: updated.userId,
        fullName: updated.user.fullName,
        institutionalEmail: updated.user.email,
        verificationStatus: updated.verificationStatus,
        verifiedAt: updated.verifiedAt,
        subjects: updated.subjects,
        professors: updated.professors.map((link) => link.professor),
      },
      message: 'Postulacion aprobada. El usuario ahora tiene el rol TUTOR.',
    };
  }

  async rejectTutorApplication(
    applicationId: string,
    dto: RejectTutorApplicationDto,
  ) {
    const profile = await this.prisma.tutorProfile.findUnique({
      where: { id: applicationId },
      include: { subjects: true },
    });

    if (!profile) {
      throw new NotFoundException({
        code: 'TUTOR_APPLICATION_NOT_FOUND',
        message: 'La postulacion no existe',
      });
    }

    if (profile.verificationStatus === VerificationStatus.VERIFIED) {
      throw new ConflictException({
        code: 'TUTOR_ALREADY_VERIFIED',
        message: 'No se puede rechazar una postulacion ya aprobada',
      });
    }

    await this.prisma.$transaction([
      this.prisma.tutorSubject.updateMany({
        where: {
          tutorId: profile.id,
          status: { not: VerificationStatus.VERIFIED },
        },
        data: {
          status: VerificationStatus.REJECTED,
          rejectionReason: dto.reason,
          verifiedAt: null,
        },
      }),
      this.prisma.tutorProfile.update({
        where: { id: profile.id },
        data: {
          verificationStatus: VerificationStatus.REJECTED,
          rejectionReason: dto.reason,
          verifiedAt: null,
        },
      }),
    ]);

    await this.notifications.create({
      userId: profile.userId,
      type: 'TUTOR_APPLICATION_REJECTED',
      title: 'Postulacion rechazada',
      message: `Tu postulacion fue rechazada: ${dto.reason}`,
      data: { tutorProfileId: profile.id, reason: dto.reason },
    });

    return {
      id: profile.id,
      verificationStatus: VerificationStatus.REJECTED,
      reason: dto.reason,
      message: 'Postulacion rechazada. El motivo es visible para el solicitante.',
    };
  }

  async listTutorSubjects(query: AdminSubjectsQueryDto) {
    const where: Prisma.TutorSubjectWhereInput = { status: query.status };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.tutorSubject.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: getPaginationSkip(query.page, query.limit),
        take: query.limit,
        include: {
          subject: true,
          tutor: {
            include: {
              user: { select: { id: true, fullName: true, email: true } },
            },
          },
        },
      }),
      this.prisma.tutorSubject.count({ where }),
    ]);

    return {
      items: items.map((link) => ({
        id: link.id,
        status: link.status,
        evidenceUrl: link.evidenceUrl,
        rejectionReason: link.rejectionReason,
        createdAt: link.createdAt,
        subject: link.subject,
        tutor: {
          id: link.tutor.id,
          userId: link.tutor.userId,
          fullName: link.tutor.user.fullName,
          email: link.tutor.user.email,
          verificationStatus: link.tutor.verificationStatus,
        },
      })),
      pagination: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async verifyTutorSubject(tutorSubjectId: string) {
    const link = await this.prisma.tutorSubject.findUnique({
      where: { id: tutorSubjectId },
      include: {
        subject: true,
        tutor: { include: { user: { select: { id: true } } } },
      },
    });

    if (!link) {
      throw new NotFoundException({
        code: 'TUTOR_SUBJECT_NOT_FOUND',
        message: 'La materia del tutor no existe',
      });
    }

    if (link.tutor.verificationStatus !== VerificationStatus.VERIFIED) {
      throw new ConflictException({
        code: 'TUTOR_NOT_VERIFIED',
        message: 'Aprueba primero la postulacion del tutor',
      });
    }

    const updated = await this.prisma.tutorSubject.update({
      where: { id: link.id },
      data: {
        status: VerificationStatus.VERIFIED,
        verifiedAt: new Date(),
        rejectionReason: null,
      },
      include: { subject: true },
    });

    await this.notifications.create({
      userId: link.tutor.userId,
      type: 'TUTOR_SUBJECT_VERIFIED',
      title: 'Materia verificada',
      message: `La materia ${link.subject.name} fue verificada y ya aparece en tu perfil publico.`,
      data: { tutorSubjectId: link.id, subjectId: link.subjectId },
    });

    return {
      id: updated.id,
      status: updated.status,
      subject: updated.subject,
      verifiedAt: updated.verifiedAt,
      message: 'Materia verificada y visible en el perfil publico.',
    };
  }

  async rejectTutorSubject(
    tutorSubjectId: string,
    dto: RejectTutorSubjectDto,
  ) {
    const link = await this.prisma.tutorSubject.findUnique({
      where: { id: tutorSubjectId },
      include: {
        subject: true,
        tutor: { include: { user: { select: { id: true } } } },
      },
    });

    if (!link) {
      throw new NotFoundException({
        code: 'TUTOR_SUBJECT_NOT_FOUND',
        message: 'La materia del tutor no existe',
      });
    }

    const updated = await this.prisma.tutorSubject.update({
      where: { id: link.id },
      data: {
        status: VerificationStatus.REJECTED,
        verifiedAt: null,
        rejectionReason: dto.reason ?? 'Evidencia no valida',
      },
      include: { subject: true },
    });

    await this.notifications.create({
      userId: link.tutor.userId,
      type: 'TUTOR_SUBJECT_REJECTED',
      title: 'Materia rechazada',
      message: `La materia ${link.subject.name} no pudo verificarse: ${
        dto.reason ?? 'Evidencia no valida'
      }`,
      data: { tutorSubjectId: link.id, subjectId: link.subjectId },
    });

    return {
      id: updated.id,
      status: updated.status,
      subject: updated.subject,
      reason: updated.rejectionReason,
      message: 'Materia rechazada.',
    };
  }

  async listUsers(query: AdminUsersQueryDto) {
    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { fullName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: getPaginationSkip(query.page, query.limit),
        take: query.limit,
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          status: true,
          emailVerifiedAt: true,
          lastLoginAt: true,
          createdAt: true,
          studentProfile: {
            select: {
              studentCode: true,
              semester: true,
              program: { select: { id: true, name: true, code: true } },
            },
          },
          tutorProfile: {
            select: {
              id: true,
              verificationStatus: true,
              averageRating: true,
              reviewCount: true,
              isActive: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items,
      pagination: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async stats() {
    const [
      students,
      tutors,
      admins,
      pendingApplications,
      pendingSubjects,
      pendingBookings,
      confirmedBookings,
      completedBookings,
      cancelledBookings,
      earnings,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: Role.STUDENT } }),
      this.prisma.user.count({ where: { role: Role.TUTOR } }),
      this.prisma.user.count({ where: { role: Role.ADMIN } }),
      this.prisma.tutorProfile.count({
        where: { verificationStatus: VerificationStatus.PENDING },
      }),
      this.prisma.tutorSubject.count({
        where: { status: VerificationStatus.PENDING },
      }),
      this.prisma.booking.count({ where: { status: BookingStatus.PENDING } }),
      this.prisma.booking.count({ where: { status: BookingStatus.CONFIRMED } }),
      this.prisma.booking.count({ where: { status: BookingStatus.COMPLETED } }),
      this.prisma.booking.count({ where: { status: BookingStatus.CANCELLED } }),
      this.prisma.payment.aggregate({
        where: { status: 'APPROVED', booking: { status: BookingStatus.COMPLETED } },
        _sum: { amount: true, platformFee: true, tutorEarnings: true },
      }),
    ]);

    return {
      users: { students, tutors, admins },
      applications: { pendingTutorApplications: pendingApplications, pendingSubjects },
      bookings: {
        pending: pendingBookings,
        confirmed: confirmedBookings,
        completed: completedBookings,
        cancelled: cancelledBookings,
      },
      simulatedRevenue: {
        gross: money(earnings._sum.amount ?? 0),
        platformFees: money(earnings._sum.platformFee ?? 0),
        tutorEarnings: money(earnings._sum.tutorEarnings ?? 0),
        currency: 'COP',
        simulated: true,
      },
    };
  }
}
