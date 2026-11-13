import { ConflictException, NotFoundException } from '@nestjs/common';
import { Role, UserStatus, VerificationStatus } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminService } from './admin.service';
import { RejectTutorApplicationDto } from './dto/admin.dto';

const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const PROFILE_ID = UUID(10);
const USER_ID = UUID(1);
const SUBJECT_LINK_ID = UUID(20);

interface ProfileOverrides {
  verificationStatus?: VerificationStatus;
  userStatus?: UserStatus;
  subjects?: Array<{ id: string; subjectId: string; status: VerificationStatus }>;
}

function buildProfile(overrides: ProfileOverrides = {}) {
  return {
    id: PROFILE_ID,
    userId: USER_ID,
    verificationStatus: overrides.verificationStatus ?? VerificationStatus.PENDING,
    user: {
      id: USER_ID,
      fullName: 'Ana Torres',
      email: 'ana.torres@universidad.edu.co',
      status: overrides.userStatus ?? UserStatus.ACTIVE,
    },
    subjects: overrides.subjects ?? [
      {
        id: SUBJECT_LINK_ID,
        subjectId: UUID(30),
        status: VerificationStatus.PENDING,
      },
    ],
  };
}

/**
 * Doble de Prisma con las dos formas de `$transaction` que usa el servicio:
 * `approve` pasa una devolucion de llamada y `reject` pasa un arreglo.
 */
function buildService(profile: ReturnType<typeof buildProfile> | null) {
  const updatedProfile = {
    id: PROFILE_ID,
    userId: USER_ID,
    verificationStatus: VerificationStatus.VERIFIED,
    verifiedAt: new Date(),
    user: {
      id: USER_ID,
      fullName: 'Ana Torres',
      email: 'ana.torres@universidad.edu.co',
    },
    subjects: [],
    professors: [],
  };

  const tx = {
    user: { update: jest.fn().mockResolvedValue({ id: USER_ID, role: Role.TUTOR }) },
    tutorSubject: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    tutorProfile: { update: jest.fn().mockResolvedValue(updatedProfile) },
  };

  const prisma = {
    tutorProfile: {
      findUnique: jest.fn().mockResolvedValue(profile),
      update: jest.fn().mockResolvedValue(updatedProfile),
    },
    tutorSubject: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    $transaction: jest.fn((arg: unknown) =>
      Array.isArray(arg)
        ? Promise.all(arg)
        : (arg as (client: typeof tx) => unknown)(tx),
    ),
  };

  const notifications = { create: jest.fn().mockResolvedValue(undefined) };
  const service = new AdminService(prisma as never, notifications as never);

  return { service, prisma, tx, notifications };
}

describe('AdminService.approveTutorApplication', () => {
  it('asigna el rol TUTOR, verifica el perfil y sus materias', async () => {
    const { service, tx, notifications } = buildService(buildProfile());

    const result = await service.approveTutorApplication(PROFILE_ID);

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { role: Role.TUTOR },
    });
    expect(tx.tutorSubject.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tutorId: PROFILE_ID },
        data: expect.objectContaining({ status: VerificationStatus.VERIFIED }),
      }),
    );
    expect(tx.tutorProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          verificationStatus: VerificationStatus.VERIFIED,
          rejectionReason: null,
          isActive: true,
        }),
      }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        type: 'TUTOR_APPLICATION_APPROVED',
      }),
    );
    expect(result.application.verificationStatus).toBe(VerificationStatus.VERIFIED);
  });

  it('no aprueba una postulacion que no existe', async () => {
    const { service, tx } = buildService(null);

    await expect(service.approveTutorApplication(PROFILE_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('no aprueba dos veces la misma postulacion', async () => {
    const { service, tx } = buildService(
      buildProfile({ verificationStatus: VerificationStatus.VERIFIED }),
    );

    await expect(service.approveTutorApplication(PROFILE_ID)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('no aprueba a un postulante sin cuenta activa', async () => {
    const { service, tx } = buildService(
      buildProfile({ userStatus: UserStatus.PENDING_VERIFICATION }),
    );

    await expect(service.approveTutorApplication(PROFILE_ID)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('no aprueba una postulacion sin materias declaradas', async () => {
    const { service, tx } = buildService(buildProfile({ subjects: [] }));

    await expect(service.approveTutorApplication(PROFILE_ID)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});

describe('AdminService.rejectTutorApplication', () => {
  const reason = 'La evidencia academica no corresponde a la materia declarada';

  it('guarda el motivo y lo notifica al solicitante', async () => {
    const { service, prisma, notifications } = buildService(buildProfile());

    const result = await service.rejectTutorApplication(PROFILE_ID, { reason });

    expect(prisma.tutorProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PROFILE_ID },
        data: expect.objectContaining({
          verificationStatus: VerificationStatus.REJECTED,
          rejectionReason: reason,
          verifiedAt: null,
        }),
      }),
    );
    expect(prisma.tutorSubject.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: VerificationStatus.REJECTED,
          rejectionReason: reason,
        }),
      }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        type: 'TUTOR_APPLICATION_REJECTED',
        message: expect.stringContaining(reason),
        data: expect.objectContaining({ reason }),
      }),
    );
    expect(result.reason).toBe(reason);
  });

  it('no rechaza una postulacion ya aprobada', async () => {
    const { service, prisma } = buildService(
      buildProfile({ verificationStatus: VerificationStatus.VERIFIED }),
    );

    await expect(
      service.rejectTutorApplication(PROFILE_ID, { reason }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.tutorProfile.update).not.toHaveBeenCalled();
  });

  it('no rechaza una postulacion que no existe', async () => {
    const { service, prisma } = buildService(null);

    await expect(
      service.rejectTutorApplication(PROFILE_ID, { reason }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.tutorProfile.update).not.toHaveBeenCalled();
  });
});

describe('RejectTutorApplicationDto', () => {
  async function errorsFor(payload: unknown) {
    return validate(plainToInstance(RejectTutorApplicationDto, payload));
  }

  it('exige un motivo con contenido', async () => {
    expect(await errorsFor({})).not.toHaveLength(0);
    expect(await errorsFor({ reason: '   ' })).not.toHaveLength(0);
    expect(await errorsFor({ reason: 'no' })).not.toHaveLength(0);
  });

  it('acepta un motivo valido y le quita los espacios de los extremos', async () => {
    const dto = plainToInstance(RejectTutorApplicationDto, {
      reason: '  Falta el soporte de la materia  ',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.reason).toBe('Falta el soporte de la materia');
  });
});
