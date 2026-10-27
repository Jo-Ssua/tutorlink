"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
const PASSWORD = 'TutorLink123*';
const ids = {
    users: {
        admin: '00000000-0000-4000-8000-000000000001',
        studentMaria: '00000000-0000-4000-8000-000000000101',
        studentJuan: '00000000-0000-4000-8000-000000000102',
        tutorAna: '00000000-0000-4000-8000-000000000201',
        tutorDiego: '00000000-0000-4000-8000-000000000202',
        tutorSofia: '00000000-0000-4000-8000-000000000203',
        applicantPedro: '00000000-0000-4000-8000-000000000204',
    },
    faculties: {
        engineering: '10000000-0000-4000-8000-000000000001',
        sciences: '10000000-0000-4000-8000-000000000002',
        economics: '10000000-0000-4000-8000-000000000003',
    },
    programs: {
        systems: '20000000-0000-4000-8000-000000000001',
        industrial: '20000000-0000-4000-8000-000000000002',
        math: '20000000-0000-4000-8000-000000000003',
        business: '20000000-0000-4000-8000-000000000004',
    },
    subjects: {
        dataStructures: '30000000-0000-4000-8000-000000000001',
        databases: '30000000-0000-4000-8000-000000000002',
        calculus: '30000000-0000-4000-8000-000000000003',
        statistics: '30000000-0000-4000-8000-000000000004',
        management: '30000000-0000-4000-8000-000000000005',
        architecture: '30000000-0000-4000-8000-000000000006',
    },
    professors: {
        laura: '40000000-0000-4000-8000-000000000001',
        carlos: '40000000-0000-4000-8000-000000000002',
        patricia: '40000000-0000-4000-8000-000000000003',
        andres: '40000000-0000-4000-8000-000000000004',
    },
    tutors: {
        ana: '50000000-0000-4000-8000-000000000001',
        diego: '50000000-0000-4000-8000-000000000002',
        sofia: '50000000-0000-4000-8000-000000000003',
        pedro: '50000000-0000-4000-8000-000000000004',
    },
    students: {
        maria: '60000000-0000-4000-8000-000000000001',
        juan: '60000000-0000-4000-8000-000000000002',
    },
    bookings: {
        anaCompleted: '70000000-0000-4000-8000-000000000001',
        anaUpcoming: '70000000-0000-4000-8000-000000000002',
        diegoCompleted: '70000000-0000-4000-8000-000000000003',
        sofiaCompleted: '70000000-0000-4000-8000-000000000004',
    },
    payments: {
        anaCompleted: '80000000-0000-4000-8000-000000000001',
        anaUpcoming: '80000000-0000-4000-8000-000000000002',
        diegoCompleted: '80000000-0000-4000-8000-000000000003',
        sofiaCompleted: '80000000-0000-4000-8000-000000000004',
    },
    reviews: {
        ana: '90000000-0000-4000-8000-000000000001',
        diego: '90000000-0000-4000-8000-000000000002',
        sofia: '90000000-0000-4000-8000-000000000003',
    },
    slots: {
        anaPast: 'a0000000-0000-4000-8000-000000000001',
        anaSoon: 'a0000000-0000-4000-8000-000000000002',
        anaUpcoming: 'a0000000-0000-4000-8000-000000000003',
        anaLater: 'a0000000-0000-4000-8000-000000000004',
        diegoPast: 'a0000000-0000-4000-8000-000000000011',
        diegoSoon: 'a0000000-0000-4000-8000-000000000012',
        diegoUpcoming: 'a0000000-0000-4000-8000-000000000013',
        diegoLater: 'a0000000-0000-4000-8000-000000000014',
        sofiaPast: 'a0000000-0000-4000-8000-000000000021',
        sofiaSoon: 'a0000000-0000-4000-8000-000000000022',
        sofiaUpcoming: 'a0000000-0000-4000-8000-000000000023',
        sofiaLater: 'a0000000-0000-4000-8000-000000000024',
    },
    notifications: {
        admin: 'b0000000-0000-4000-8000-000000000001',
        ana: 'b0000000-0000-4000-8000-000000000002',
        maria: 'b0000000-0000-4000-8000-000000000003',
    },
};
const HOUR = 3_600_000;
function addHours(date, hours) {
    return new Date(date.getTime() + hours * HOUR);
}
function roundToHalfHour(date) {
    const rounded = new Date(date);
    rounded.setSeconds(0, 0);
    const remainder = rounded.getMinutes() % 30;
    if (remainder !== 0) {
        rounded.setMinutes(rounded.getMinutes() + (30 - remainder));
    }
    return rounded;
}
async function main() {
    const now = new Date();
    const anchor = roundToHalfHour(now);
    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    const userData = [
        {
            id: ids.users.admin,
            email: 'admin@universidad.edu.co',
            fullName: 'Administrador TutorLink',
            role: client_1.Role.ADMIN,
        },
        {
            id: ids.users.studentMaria,
            email: 'estudiante@universidad.edu.co',
            fullName: 'Maria Fernanda Lopez',
            role: client_1.Role.STUDENT,
        },
        {
            id: ids.users.studentJuan,
            email: 'juan.estudiante@estudiantes.universidad.edu.co',
            fullName: 'Juan Camilo Perez',
            role: client_1.Role.STUDENT,
        },
        {
            id: ids.users.tutorAna,
            email: 'ana.tutor@universidad.edu.co',
            fullName: 'Ana Maria Torres',
            role: client_1.Role.TUTOR,
        },
        {
            id: ids.users.tutorDiego,
            email: 'diego.tutor@universidad.edu.co',
            fullName: 'Diego Alejandro Rios',
            role: client_1.Role.TUTOR,
        },
        {
            id: ids.users.tutorSofia,
            email: 'sofia.tutor@universidad.edu.co',
            fullName: 'Sofia Valentina Gomez',
            role: client_1.Role.TUTOR,
        },
        {
            id: ids.users.applicantPedro,
            email: 'pedro.tutor@universidad.edu.co',
            fullName: 'Pedro Jose Ramirez',
            role: client_1.Role.STUDENT,
        },
    ];
    for (const user of userData) {
        await prisma.user.upsert({
            where: { id: user.id },
            update: {
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                passwordHash,
                status: client_1.UserStatus.ACTIVE,
                emailVerificationCodeHash: null,
                emailVerificationExpiresAt: null,
                emailVerifiedAt: now,
                refreshTokenHash: null,
                lastLoginAt: null,
            },
            create: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                passwordHash,
                status: client_1.UserStatus.ACTIVE,
                emailVerifiedAt: now,
            },
        });
    }
    const faculties = [
        { id: ids.faculties.engineering, name: 'Facultad de Ingenieria', code: 'ING' },
        { id: ids.faculties.sciences, name: 'Facultad de Ciencias', code: 'CIE' },
        { id: ids.faculties.economics, name: 'Facultad de Economia', code: 'ECO' },
    ];
    for (const faculty of faculties) {
        await prisma.faculty.upsert({
            where: { id: faculty.id },
            update: { name: faculty.name, code: faculty.code },
            create: faculty,
        });
    }
    const programs = [
        {
            id: ids.programs.systems,
            facultyId: ids.faculties.engineering,
            name: 'Ingenieria de Sistemas',
            code: 'SIS',
        },
        {
            id: ids.programs.industrial,
            facultyId: ids.faculties.engineering,
            name: 'Ingenieria Industrial',
            code: 'IND',
        },
        {
            id: ids.programs.math,
            facultyId: ids.faculties.sciences,
            name: 'Matematicas',
            code: 'MAT',
        },
        {
            id: ids.programs.business,
            facultyId: ids.faculties.economics,
            name: 'Administracion de Empresas',
            code: 'ADM',
        },
    ];
    for (const program of programs) {
        await prisma.program.upsert({
            where: { id: program.id },
            update: {
                facultyId: program.facultyId,
                name: program.name,
                code: program.code,
            },
            create: program,
        });
    }
    const subjects = [
        {
            id: ids.subjects.dataStructures,
            programId: ids.programs.systems,
            name: 'Estructuras de Datos',
            code: 'SIS201',
            credits: 4,
        },
        {
            id: ids.subjects.databases,
            programId: ids.programs.systems,
            name: 'Bases de Datos',
            code: 'SIS301',
            credits: 3,
        },
        {
            id: ids.subjects.calculus,
            programId: ids.programs.math,
            name: 'Calculo I',
            code: 'MAT101',
            credits: 4,
        },
        {
            id: ids.subjects.statistics,
            programId: ids.programs.industrial,
            name: 'Estadistica Aplicada',
            code: 'IND201',
            credits: 3,
        },
        {
            id: ids.subjects.management,
            programId: ids.programs.business,
            name: 'Fundamentos de Administracion',
            code: 'ADM101',
            credits: 3,
        },
        {
            id: ids.subjects.architecture,
            programId: ids.programs.systems,
            name: 'Arquitectura de Software',
            code: 'SIS401',
            credits: 3,
        },
    ];
    for (const subject of subjects) {
        await prisma.subject.upsert({
            where: { id: subject.id },
            update: {
                programId: subject.programId,
                name: subject.name,
                code: subject.code,
                credits: subject.credits,
            },
            create: subject,
        });
    }
    const professors = [
        {
            id: ids.professors.laura,
            programId: ids.programs.systems,
            fullName: 'Laura Mendez',
            email: 'laura.mendez@universidad.edu.co',
        },
        {
            id: ids.professors.carlos,
            programId: ids.programs.systems,
            fullName: 'Carlos Rojas',
            email: 'carlos.rojas@universidad.edu.co',
        },
        {
            id: ids.professors.patricia,
            programId: ids.programs.math,
            fullName: 'Patricia Gomez',
            email: 'patricia.gomez@universidad.edu.co',
        },
        {
            id: ids.professors.andres,
            programId: ids.programs.industrial,
            fullName: 'Andres Silva',
            email: 'andres.silva@universidad.edu.co',
        },
    ];
    for (const professor of professors) {
        await prisma.professor.upsert({
            where: { id: professor.id },
            update: {
                programId: professor.programId,
                fullName: professor.fullName,
                email: professor.email,
            },
            create: professor,
        });
    }
    const subjectProfessors = [
        [ids.subjects.dataStructures, ids.professors.laura],
        [ids.subjects.databases, ids.professors.carlos],
        [ids.subjects.calculus, ids.professors.patricia],
        [ids.subjects.statistics, ids.professors.andres],
        [ids.subjects.management, ids.professors.andres],
        [ids.subjects.architecture, ids.professors.carlos],
    ];
    for (const [subjectId, professorId] of subjectProfessors) {
        await prisma.subjectProfessor.upsert({
            where: { subjectId_professorId: { subjectId, professorId } },
            update: {},
            create: { subjectId, professorId },
        });
    }
    const studentProfiles = [
        {
            id: ids.students.maria,
            userId: ids.users.studentMaria,
            studentCode: '20231001',
            semester: 7,
            programId: ids.programs.systems,
        },
        {
            id: ids.students.juan,
            userId: ids.users.studentJuan,
            studentCode: '20231002',
            semester: 5,
            programId: ids.programs.industrial,
        },
    ];
    for (const profile of studentProfiles) {
        await prisma.studentProfile.upsert({
            where: { userId: profile.userId },
            update: {
                studentCode: profile.studentCode,
                semester: profile.semester,
                programId: profile.programId,
            },
            create: profile,
        });
    }
    const tutorProfiles = [
        {
            id: ids.tutors.ana,
            userId: ids.users.tutorAna,
            bio: 'Tutora de estructuras de datos, bases de datos y arquitectura de software.',
            experienceYears: 4,
            hourlyRate: 45_000,
            verificationStatus: client_1.VerificationStatus.VERIFIED,
            averageRating: 5,
            reviewCount: 1,
            modalities: [client_1.Modality.VIRTUAL, client_1.Modality.HYBRID],
            maxWeeklySessions: 12,
            isActive: true,
        },
        {
            id: ids.tutors.diego,
            userId: ids.users.tutorDiego,
            bio: 'Tutor de bases de datos y arquitectura de software con enfoque practico.',
            experienceYears: 5,
            hourlyRate: 60_000,
            verificationStatus: client_1.VerificationStatus.VERIFIED,
            averageRating: 4,
            reviewCount: 1,
            modalities: [client_1.Modality.IN_PERSON, client_1.Modality.HYBRID],
            maxWeeklySessions: 10,
            isActive: true,
        },
        {
            id: ids.tutors.sofia,
            userId: ids.users.tutorSofia,
            bio: 'Tutora de matematicas, estadistica y fundamentos de programacion.',
            experienceYears: 3,
            hourlyRate: 50_000,
            verificationStatus: client_1.VerificationStatus.VERIFIED,
            averageRating: 5,
            reviewCount: 1,
            modalities: [client_1.Modality.VIRTUAL],
            maxWeeklySessions: 15,
            isActive: true,
        },
        {
            id: ids.tutors.pedro,
            userId: ids.users.applicantPedro,
            bio: 'Estudiante de ultimo semestre interesado en dictar tutorias de programacion.',
            experienceYears: 1,
            hourlyRate: 35_000,
            verificationStatus: client_1.VerificationStatus.PENDING,
            averageRating: 0,
            reviewCount: 0,
            modalities: [client_1.Modality.VIRTUAL],
            maxWeeklySessions: 6,
            isActive: false,
        },
    ];
    for (const profile of tutorProfiles) {
        await prisma.tutorProfile.upsert({
            where: { userId: profile.userId },
            update: {
                bio: profile.bio,
                experienceYears: profile.experienceYears,
                hourlyRate: profile.hourlyRate,
                verificationStatus: profile.verificationStatus,
                verifiedAt: profile.verificationStatus === client_1.VerificationStatus.VERIFIED ? now : null,
                rejectionReason: null,
                averageRating: profile.averageRating,
                reviewCount: profile.reviewCount,
                modalities: profile.modalities,
                maxWeeklySessions: profile.maxWeeklySessions,
                isActive: profile.isActive,
            },
            create: {
                ...profile,
                verifiedAt: profile.verificationStatus === client_1.VerificationStatus.VERIFIED ? now : null,
            },
        });
    }
    const tutorSubjects = [
        {
            tutorId: ids.tutors.ana,
            subjectId: ids.subjects.dataStructures,
            status: client_1.VerificationStatus.VERIFIED,
            evidenceUrl: 'https://example.com/evidencias/ana-sis201.pdf',
        },
        {
            tutorId: ids.tutors.ana,
            subjectId: ids.subjects.databases,
            status: client_1.VerificationStatus.VERIFIED,
            evidenceUrl: 'https://example.com/evidencias/ana-sis301.pdf',
        },
        {
            tutorId: ids.tutors.ana,
            subjectId: ids.subjects.architecture,
            status: client_1.VerificationStatus.VERIFIED,
            evidenceUrl: 'https://example.com/evidencias/ana-sis401.pdf',
        },
        {
            tutorId: ids.tutors.ana,
            subjectId: ids.subjects.calculus,
            status: client_1.VerificationStatus.PENDING,
            evidenceUrl: 'https://example.com/evidencias/ana-mat101.pdf',
        },
        {
            tutorId: ids.tutors.diego,
            subjectId: ids.subjects.databases,
            status: client_1.VerificationStatus.VERIFIED,
            evidenceUrl: 'https://example.com/evidencias/diego-sis301.pdf',
        },
        {
            tutorId: ids.tutors.diego,
            subjectId: ids.subjects.architecture,
            status: client_1.VerificationStatus.VERIFIED,
            evidenceUrl: 'https://example.com/evidencias/diego-sis401.pdf',
        },
        {
            tutorId: ids.tutors.sofia,
            subjectId: ids.subjects.dataStructures,
            status: client_1.VerificationStatus.VERIFIED,
            evidenceUrl: 'https://example.com/evidencias/sofia-sis201.pdf',
        },
        {
            tutorId: ids.tutors.sofia,
            subjectId: ids.subjects.calculus,
            status: client_1.VerificationStatus.VERIFIED,
            evidenceUrl: 'https://example.com/evidencias/sofia-mat101.pdf',
        },
        {
            tutorId: ids.tutors.sofia,
            subjectId: ids.subjects.statistics,
            status: client_1.VerificationStatus.VERIFIED,
            evidenceUrl: 'https://example.com/evidencias/sofia-ind201.pdf',
        },
        {
            tutorId: ids.tutors.pedro,
            subjectId: ids.subjects.dataStructures,
            status: client_1.VerificationStatus.PENDING,
            evidenceUrl: 'https://example.com/evidencias/pedro-sis201.pdf',
        },
        {
            tutorId: ids.tutors.pedro,
            subjectId: ids.subjects.databases,
            status: client_1.VerificationStatus.PENDING,
            evidenceUrl: 'https://example.com/evidencias/pedro-sis301.pdf',
        },
    ];
    for (const link of tutorSubjects) {
        await prisma.tutorSubject.upsert({
            where: {
                tutorId_subjectId: {
                    tutorId: link.tutorId,
                    subjectId: link.subjectId,
                },
            },
            update: {
                status: link.status,
                evidenceUrl: link.evidenceUrl,
                verifiedAt: link.status === client_1.VerificationStatus.VERIFIED ? now : null,
                rejectionReason: null,
            },
            create: {
                ...link,
                verifiedAt: link.status === client_1.VerificationStatus.VERIFIED ? now : null,
            },
        });
    }
    const tutorProfessors = [
        [ids.tutors.ana, ids.professors.laura],
        [ids.tutors.ana, ids.professors.carlos],
        [ids.tutors.diego, ids.professors.carlos],
        [ids.tutors.diego, ids.professors.laura],
        [ids.tutors.sofia, ids.professors.laura],
        [ids.tutors.sofia, ids.professors.patricia],
        [ids.tutors.sofia, ids.professors.andres],
        [ids.tutors.pedro, ids.professors.laura],
    ];
    for (const [tutorId, professorId] of tutorProfessors) {
        await prisma.tutorProfessor.upsert({
            where: { tutorId_professorId: { tutorId, professorId } },
            update: {},
            create: { tutorId, professorId },
        });
    }
    const slots = [
        {
            id: ids.slots.anaPast,
            tutorId: ids.tutors.ana,
            startAt: addHours(anchor, -7 * 24),
            endAt: addHours(anchor, -7 * 24 + 1),
            modality: client_1.Modality.VIRTUAL,
            status: client_1.SlotStatus.RESERVED,
        },
        {
            id: ids.slots.anaSoon,
            tutorId: ids.tutors.ana,
            startAt: addHours(anchor, 2),
            endAt: addHours(anchor, 3),
            modality: client_1.Modality.VIRTUAL,
            status: client_1.SlotStatus.AVAILABLE,
        },
        {
            id: ids.slots.anaUpcoming,
            tutorId: ids.tutors.ana,
            startAt: addHours(anchor, 26),
            endAt: addHours(anchor, 27),
            modality: client_1.Modality.VIRTUAL,
            status: client_1.SlotStatus.RESERVED,
        },
        {
            id: ids.slots.anaLater,
            tutorId: ids.tutors.ana,
            startAt: addHours(anchor, 50),
            endAt: addHours(anchor, 51),
            modality: client_1.Modality.HYBRID,
            status: client_1.SlotStatus.AVAILABLE,
        },
        {
            id: ids.slots.diegoPast,
            tutorId: ids.tutors.diego,
            startAt: addHours(anchor, -8 * 24),
            endAt: addHours(anchor, -8 * 24 + 1),
            modality: client_1.Modality.IN_PERSON,
            status: client_1.SlotStatus.RESERVED,
        },
        {
            id: ids.slots.diegoSoon,
            tutorId: ids.tutors.diego,
            startAt: addHours(anchor, 4),
            endAt: addHours(anchor, 5),
            modality: client_1.Modality.IN_PERSON,
            status: client_1.SlotStatus.AVAILABLE,
        },
        {
            id: ids.slots.diegoUpcoming,
            tutorId: ids.tutors.diego,
            startAt: addHours(anchor, 28),
            endAt: addHours(anchor, 29),
            modality: client_1.Modality.HYBRID,
            status: client_1.SlotStatus.AVAILABLE,
        },
        {
            id: ids.slots.diegoLater,
            tutorId: ids.tutors.diego,
            startAt: addHours(anchor, 52),
            endAt: addHours(anchor, 53),
            modality: client_1.Modality.IN_PERSON,
            status: client_1.SlotStatus.AVAILABLE,
        },
        {
            id: ids.slots.sofiaPast,
            tutorId: ids.tutors.sofia,
            startAt: addHours(anchor, -6 * 24),
            endAt: addHours(anchor, -6 * 24 + 1),
            modality: client_1.Modality.VIRTUAL,
            status: client_1.SlotStatus.RESERVED,
        },
        {
            id: ids.slots.sofiaSoon,
            tutorId: ids.tutors.sofia,
            startAt: addHours(anchor, 1),
            endAt: addHours(anchor, 2),
            modality: client_1.Modality.VIRTUAL,
            status: client_1.SlotStatus.AVAILABLE,
        },
        {
            id: ids.slots.sofiaUpcoming,
            tutorId: ids.tutors.sofia,
            startAt: addHours(anchor, 25),
            endAt: addHours(anchor, 26),
            modality: client_1.Modality.VIRTUAL,
            status: client_1.SlotStatus.AVAILABLE,
        },
        {
            id: ids.slots.sofiaLater,
            tutorId: ids.tutors.sofia,
            startAt: addHours(anchor, 49),
            endAt: addHours(anchor, 50),
            modality: client_1.Modality.VIRTUAL,
            status: client_1.SlotStatus.AVAILABLE,
        },
    ];
    for (const slot of slots) {
        await prisma.availabilitySlot.upsert({
            where: { id: slot.id },
            update: {
                tutorId: slot.tutorId,
                startAt: slot.startAt,
                endAt: slot.endAt,
                modality: slot.modality,
                status: slot.status,
                heldUntil: null,
            },
            create: slot,
        });
    }
    const bookings = [
        {
            id: ids.bookings.anaCompleted,
            studentId: ids.users.studentMaria,
            tutorId: ids.users.tutorAna,
            subjectId: ids.subjects.dataStructures,
            slotId: ids.slots.anaPast,
            topic: 'Repaso de arboles binarios',
            description: 'Preparacion para el parcial de estructuras de datos.',
            modality: client_1.Modality.VIRTUAL,
            startAt: addHours(anchor, -7 * 24),
            endAt: addHours(anchor, -7 * 24 + 1),
            status: client_1.BookingStatus.COMPLETED,
            hourlyRate: 45_000,
            durationMinutes: 60,
            subtotal: 45_000,
            platformFee: 4_500,
            total: 49_500,
            completedAt: addHours(anchor, -7 * 24 + 1),
        },
        {
            id: ids.bookings.anaUpcoming,
            studentId: ids.users.studentJuan,
            tutorId: ids.users.tutorAna,
            subjectId: ids.subjects.databases,
            slotId: ids.slots.anaUpcoming,
            topic: 'Modelado relacional',
            description: 'Normalizacion y consultas SQL.',
            modality: client_1.Modality.VIRTUAL,
            startAt: addHours(anchor, 26),
            endAt: addHours(anchor, 27),
            status: client_1.BookingStatus.CONFIRMED,
            hourlyRate: 45_000,
            durationMinutes: 60,
            subtotal: 45_000,
            platformFee: 4_500,
            total: 49_500,
            completedAt: null,
        },
        {
            id: ids.bookings.diegoCompleted,
            studentId: ids.users.studentJuan,
            tutorId: ids.users.tutorDiego,
            subjectId: ids.subjects.databases,
            slotId: ids.slots.diegoPast,
            topic: 'Optimizacion de indices',
            description: 'Analisis de planes de ejecucion y indices compuestos.',
            modality: client_1.Modality.IN_PERSON,
            startAt: addHours(anchor, -8 * 24),
            endAt: addHours(anchor, -8 * 24 + 1),
            status: client_1.BookingStatus.COMPLETED,
            hourlyRate: 60_000,
            durationMinutes: 60,
            subtotal: 60_000,
            platformFee: 6_000,
            total: 66_000,
            completedAt: addHours(anchor, -8 * 24 + 1),
        },
        {
            id: ids.bookings.sofiaCompleted,
            studentId: ids.users.studentMaria,
            tutorId: ids.users.tutorSofia,
            subjectId: ids.subjects.calculus,
            slotId: ids.slots.sofiaPast,
            topic: 'Limites y continuidad',
            description: 'Ejercicios de limites laterales y continuidad.',
            modality: client_1.Modality.VIRTUAL,
            startAt: addHours(anchor, -6 * 24),
            endAt: addHours(anchor, -6 * 24 + 1),
            status: client_1.BookingStatus.COMPLETED,
            hourlyRate: 50_000,
            durationMinutes: 60,
            subtotal: 50_000,
            platformFee: 5_000,
            total: 55_000,
            completedAt: addHours(anchor, -6 * 24 + 1),
        },
    ];
    for (const booking of bookings) {
        await prisma.booking.upsert({
            where: { id: booking.id },
            update: {
                studentId: booking.studentId,
                tutorId: booking.tutorId,
                subjectId: booking.subjectId,
                slotId: booking.slotId,
                requestId: null,
                proposalId: null,
                topic: booking.topic,
                description: booking.description,
                modality: booking.modality,
                startAt: booking.startAt,
                endAt: booking.endAt,
                status: booking.status,
                hourlyRate: booking.hourlyRate,
                durationMinutes: booking.durationMinutes,
                subtotal: booking.subtotal,
                platformFee: booking.platformFee,
                total: booking.total,
                isEmergency: false,
                cancellationReason: null,
                cancelledAt: null,
                completedAt: booking.completedAt,
            },
            create: booking,
        });
    }
    const payments = [
        {
            id: ids.payments.anaCompleted,
            bookingId: ids.bookings.anaCompleted,
            studentId: ids.users.studentMaria,
            tutorId: ids.users.tutorAna,
            amount: 49_500,
            platformFee: 4_500,
            tutorEarnings: 45_000,
            reference: 'SIM-SEED-COMPLETED-ANA-001',
            paidAt: addHours(anchor, -7 * 24),
        },
        {
            id: ids.payments.anaUpcoming,
            bookingId: ids.bookings.anaUpcoming,
            studentId: ids.users.studentJuan,
            tutorId: ids.users.tutorAna,
            amount: 49_500,
            platformFee: 4_500,
            tutorEarnings: 45_000,
            reference: 'SIM-SEED-UPCOMING-ANA-002',
            paidAt: now,
        },
        {
            id: ids.payments.diegoCompleted,
            bookingId: ids.bookings.diegoCompleted,
            studentId: ids.users.studentJuan,
            tutorId: ids.users.tutorDiego,
            amount: 66_000,
            platformFee: 6_000,
            tutorEarnings: 60_000,
            reference: 'SIM-SEED-COMPLETED-DIEGO-001',
            paidAt: addHours(anchor, -8 * 24),
        },
        {
            id: ids.payments.sofiaCompleted,
            bookingId: ids.bookings.sofiaCompleted,
            studentId: ids.users.studentMaria,
            tutorId: ids.users.tutorSofia,
            amount: 55_000,
            platformFee: 5_000,
            tutorEarnings: 50_000,
            reference: 'SIM-SEED-COMPLETED-SOFIA-001',
            paidAt: addHours(anchor, -6 * 24),
        },
    ];
    for (const payment of payments) {
        await prisma.payment.upsert({
            where: { id: payment.id },
            update: {
                bookingId: payment.bookingId,
                studentId: payment.studentId,
                tutorId: payment.tutorId,
                amount: payment.amount,
                platformFee: payment.platformFee,
                tutorEarnings: payment.tutorEarnings,
                currency: 'COP',
                type: client_1.PaymentType.SIMULATED,
                status: client_1.PaymentStatus.APPROVED,
                reference: payment.reference,
                simulated: true,
                paidAt: payment.paidAt,
                refundedAt: null,
            },
            create: {
                ...payment,
                currency: 'COP',
                type: client_1.PaymentType.SIMULATED,
                status: client_1.PaymentStatus.APPROVED,
                simulated: true,
            },
        });
    }
    const reviews = [
        {
            id: ids.reviews.ana,
            bookingId: ids.bookings.anaCompleted,
            studentId: ids.users.studentMaria,
            tutorId: ids.users.tutorAna,
            rating: 5,
            comment: 'Explico los recorridos con ejemplos muy claros.',
        },
        {
            id: ids.reviews.diego,
            bookingId: ids.bookings.diegoCompleted,
            studentId: ids.users.studentJuan,
            tutorId: ids.users.tutorDiego,
            rating: 4,
            comment: 'Muy buen dominio del tema y ejercicios practicos.',
        },
        {
            id: ids.reviews.sofia,
            bookingId: ids.bookings.sofiaCompleted,
            studentId: ids.users.studentMaria,
            tutorId: ids.users.tutorSofia,
            rating: 5,
            comment: 'Paciente y clara para resolver dudas de calculo.',
        },
    ];
    for (const review of reviews) {
        await prisma.review.upsert({
            where: { bookingId: review.bookingId },
            update: {
                studentId: review.studentId,
                tutorId: review.tutorId,
                rating: review.rating,
                comment: review.comment,
                isAnonymous: true,
            },
            create: { ...review, isAnonymous: true },
        });
    }
    const notifications = [
        {
            id: ids.notifications.admin,
            userId: ids.users.admin,
            type: client_1.NotificationType.TUTOR_APPLICATION_SUBMITTED,
            title: 'Postulacion pendiente',
            message: 'Pedro Jose Ramirez envio una postulacion de tutor para revision.',
            data: { tutorProfileId: ids.tutors.pedro },
        },
        {
            id: ids.notifications.ana,
            userId: ids.users.tutorAna,
            type: client_1.NotificationType.BOOKING_STATUS_CHANGED,
            title: 'Nueva sesion confirmada',
            message: 'Tienes una sesion confirmada con un estudiante para Bases de Datos.',
            data: { bookingId: ids.bookings.anaUpcoming },
        },
        {
            id: ids.notifications.maria,
            userId: ids.users.studentMaria,
            type: client_1.NotificationType.SYSTEM,
            title: 'Bienvenida a TutorLink',
            message: 'Ya puedes buscar tutores o crear una solicitud StudyMatch.',
            data: { source: 'seed' },
        },
    ];
    for (const notification of notifications) {
        await prisma.notification.upsert({
            where: { id: notification.id },
            update: {
                userId: notification.userId,
                type: notification.type,
                title: notification.title,
                message: notification.message,
                data: notification.data,
                readAt: null,
            },
            create: notification,
        });
    }
    const [users, tutors, slotsCount, bookingsCount] = await Promise.all([
        prisma.user.count(),
        prisma.tutorProfile.count(),
        prisma.availabilitySlot.count(),
        prisma.booking.count(),
    ]);
    console.log('Seed completado.');
    console.log(`Usuarios: ${users}, tutores: ${tutors}, slots: ${slotsCount}, reservas: ${bookingsCount}`);
    console.log(`Credenciales demo: todos usan la contrasena ${PASSWORD}`);
    console.log('Admin: admin@universidad.edu.co');
    console.log('Estudiante: estudiante@universidad.edu.co');
    console.log('Tutores: ana.tutor@universidad.edu.co, diego.tutor@universidad.edu.co, sofia.tutor@universidad.edu.co');
    console.log('Postulante pendiente: pedro.tutor@universidad.edu.co');
}
main()
    .catch((error) => {
    console.error('Error ejecutando el seed:', error);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma.$disconnect();
});
