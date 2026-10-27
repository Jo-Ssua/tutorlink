import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogQueryDto } from './dto/catalog-query.dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async faculties() {
    return this.prisma.faculty.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { programs: true } },
      },
    });
  }

  async programs(query: CatalogQueryDto) {
    return this.prisma.program.findMany({
      where: {
        ...(query.facultyId ? { facultyId: query.facultyId } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { code: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
      include: {
        faculty: true,
        _count: { select: { subjects: true } },
      },
    });
  }

  async subjects(query: CatalogQueryDto) {
    return this.prisma.subject.findMany({
      where: {
        ...(query.programId ? { programId: query.programId } : {}),
        ...(query.facultyId ? { program: { facultyId: query.facultyId } } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { code: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ code: 'asc' }],
      include: {
        program: { include: { faculty: true } },
        subjectProfessors: { include: { professor: true } },
      },
    });
  }

  async professors(query: CatalogQueryDto) {
    return this.prisma.professor.findMany({
      where: {
        ...(query.programId ? { programId: query.programId } : {}),
        ...(query.facultyId ? { program: { facultyId: query.facultyId } } : {}),
        ...(query.subjectId ? { subjectLinks: { some: { subjectId: query.subjectId } } } : {}),
        ...(query.search
          ? { fullName: { contains: query.search, mode: 'insensitive' } }
          : {}),
      },
      orderBy: { fullName: 'asc' },
      include: {
        program: { include: { faculty: true } },
        subjectLinks: { include: { subject: true } },
      },
    });
  }

  async pensum(programId: string) {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
      include: {
        faculty: true,
        subjects: {
          orderBy: { code: 'asc' },
          include: {
            subjectProfessors: { include: { professor: true } },
          },
        },
      },
    });

    return program;
  }
}
